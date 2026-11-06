'use client';
// 재생기 — 오디오 시계 하나로 박을 계산하고 클릭음을 미리 예약한다 (설계문서 8.3 · 8.8, 6.4).
// 화면은 player.beat()만 본다. setInterval로 박을 세지 않는다(타이머는 '예약'에만 쓴다).
import { create } from 'zustand';
import { createScheduler, makeClickPlan, type ClickKind, type Scheduler } from '@/engine/scheduler';
import { createClickSynth, type ClickSynth } from '@/engine/clickSynth';
import { beatAt, countAt, leadBeats, resumeT0, retimeT0, secPerBeat } from '@/engine/timeline';
import type { Track } from '@/engine/track';

export type PlayStatus = 'stopped' | 'playing' | 'paused' | 'stepping' | 'ended';
export type AudioState = 'idle' | 'running' | 'blocked' | 'unsupported';
export type ClickMode = 'on' | 'noAnd' | 'off';

export interface PlayerConfig {
  key: string;
  track: Track;
  mirrorTrack: Track | null;
  bpm: number;
  countInBeats: 0 | 4 | 8;
  clickMode: ClickMode;
}

export interface PlayerState {
  status: PlayStatus;
  bpm: number;
  countInBeats: 0 | 4 | 8;
  muted: boolean;
  audio: AudioState;
  key: string;
  clockKind: 'audio' | 'silent';
}

export const usePlayerState = create<PlayerState>(() => ({
  status: 'stopped',
  bpm: 80,
  countInBeats: 4,
  muted: false,
  audio: 'idle',
  key: '',
  clockKind: 'silent',
}));

export const BPM_MIN = 10;
export const BPM_MAX = 160;
const READY_BEAT = -1;

const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)));

interface Ticker {
  start(): void;
  stop(): void;
}

function createTicker(fn: () => void): Ticker {
  let worker: Worker | null = null;
  let id: ReturnType<typeof setInterval> | null = null;
  try {
    const src = "let id=null;onmessage=function(e){if(e.data==='start'){if(id)clearInterval(id);id=setInterval(function(){postMessage(0)},25)}else{clearInterval(id);id=null}}";
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = () => fn();
  } catch {
    worker = null; // CSP 등으로 Worker를 못 쓰면 setInterval로 대신한다
  }
  return {
    start() {
      if (worker) worker.postMessage('start');
      else if (!id) id = setInterval(fn, 25);
    },
    stop() {
      if (worker) worker.postMessage('stop');
      if (id) {
        clearInterval(id);
        id = null;
      }
    },
  };
}

type AudioCtor = typeof AudioContext;

class Player {
  private ctx: AudioContext | null = null;
  private synth: ClickSynth | null = null;
  private scheduler: Scheduler | null = null;
  private ticker: Ticker | null = null;
  private cfg: PlayerConfig | null = null;
  private t0 = 0;
  private lead = 4;
  private pausedBeat = READY_BEAT;
  private clockKind: 'audio' | 'silent' = 'silent';
  private anim: { from: number; to: number; start: number; dur: number } | null = null;
  private offsetMs = 0;
  private listeners = new Set<() => void>();

  get state(): PlayerState {
    return usePlayerState.getState();
  }

  private patch(p: Partial<PlayerState>) {
    usePlayerState.setState(p);
    this.listeners.forEach((l) => l());
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get track(): Track | null {
    return this.cfg?.track ?? null;
  }

  get mirrorTrack(): Track | null {
    return this.cfg?.mirrorTrack ?? null;
  }

  get leadBeats(): number {
    return this.lead;
  }

  /** 사용자의 터치 · 클릭 안에서 불러야 한다 (모바일 자동재생 정책) */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) {
        this.patch({ audio: 'unsupported' });
        return;
      }
      try {
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.synth = createClickSynth(this.ctx);
        this.synth.setMuted(this.state.muted);
        this.ctx.onstatechange = () => this.patch({ audio: this.ctx?.state === 'running' ? 'running' : 'blocked' });
      } catch {
        this.patch({ audio: 'unsupported' });
        return;
      }
    }
    const ctx = this.ctx;
    try {
      // iOS: 소리 없는 아주 짧은 버퍼를 한 번 재생해 잠금을 푼다
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* 무시 */
    }
    if (ctx.state !== 'running') {
      ctx.resume().then(
        () => this.patch({ audio: ctx.state === 'running' ? 'running' : 'blocked' }),
        () => this.patch({ audio: 'blocked' }),
      );
    } else if (this.state.audio !== 'running') this.patch({ audio: 'running' });
  }

  private clockNow(): number {
    if (this.clockKind === 'audio' && this.ctx) return this.ctx.currentTime;
    return performance.now() / 1000;
  }

  /** 지금 스피커에서 나오고 있는 소리의 시각 (그림은 이 시각으로 박을 센다) */
  private heardNow(): number {
    const ctx = this.ctx;
    if (this.clockKind === 'audio' && ctx) {
      const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
      if (ts && ts.contextTime && ts.performanceTime) {
        const t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
        return Math.min(ctx.currentTime, Math.max(ctx.currentTime - 0.5, t));
      }
      return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    }
    return performance.now() / 1000;
  }

  private ensureScheduler() {
    if (this.scheduler) return;
    this.scheduler = createScheduler(
      { now: () => this.clockNow() },
      {
        play: (time, kind) => {
          if (this.clockKind === 'audio' && this.synth) this.synth.play(time, kind);
        },
        cancelAfter: (time) => {
          this.synth?.cancelAfter(time);
        },
      },
    );
    this.ticker = createTicker(() => {
      this.scheduler?.tick();
      if (this.state.status === 'playing') this.beat(); // 끝 검사
    });
  }

  private plan() {
    const cfg = this.cfg!;
    return makeClickPlan(cfg.track, { countInBeats: cfg.countInBeats, clickMode: cfg.clickMode === 'off' ? 'noAnd' : cfg.clickMode });
  }

  load(cfg: PlayerConfig, opts: { keepPosition?: boolean } = {}): void {
    const prev = this.cfg;
    const beatNow = prev ? this.beat() : READY_BEAT;
    const wasPlaying = this.state.status === 'playing';
    this.cfg = cfg;
    this.lead = leadBeats(cfg.countInBeats);
    this.ensureScheduler();
    if (opts.keepPosition && prev) {
      if (wasPlaying) {
        if (beatNow >= cfg.track.totalBeats) {
          this.endAt(cfg.track.totalBeats);
        } else {
          const sb = this.scheduleBeat();
          this.scheduler!.stop();
          this.scheduler!.start(this.t0, this.state.bpm, this.lead, this.clickOff() ? silentPlan() : this.plan(), sb);
        }
      } else {
        this.pausedBeat = Math.min(beatNow, cfg.track.totalBeats);
      }
      this.patch({ key: cfg.key, countInBeats: cfg.countInBeats });
      return;
    }
    this.scheduler!.stop();
    this.ticker?.stop();
    this.anim = null;
    this.pausedBeat = READY_BEAT;
    this.patch({ status: 'stopped', key: cfg.key, bpm: cfg.bpm, countInBeats: cfg.countInBeats });
  }

  private clickOff() {
    return this.cfg?.clickMode === 'off';
  }

  /** 지금 박 (그리는 쪽에서 쓰는 값, 지연 보정 포함) */
  beat(): number {
    const st = this.state;
    if (!this.cfg) return READY_BEAT;
    if (st.status === 'playing') {
      const spb = secPerBeat(st.bpm);
      const b = beatAt(this.heardNow(), this.t0, st.bpm, this.lead) - this.offsetMs / 1000 / spb;
      if (b >= this.cfg.track.totalBeats) {
        this.endAt(this.cfg.track.totalBeats);
        return this.cfg.track.totalBeats;
      }
      return b;
    }
    if (st.status === 'stepping' && this.anim) {
      const p = (performance.now() - this.anim.start) / (this.anim.dur * 1000);
      if (p >= 1) {
        const to = this.anim.to;
        this.anim = null;
        this.pausedBeat = to;
        queueMicrotask(() => this.patch({ status: 'paused' }));
        return to;
      }
      return this.anim.from + (this.anim.to - this.anim.from) * easeInOut(p);
    }
    return this.pausedBeat;
  }

  /** 소리 예약 기준의 박 (지연 보정 없음) */
  private scheduleBeat(): number {
    return beatAt(this.clockNow(), this.t0, this.state.bpm, this.lead);
  }

  private endAt(b: number) {
    this.scheduler?.stop();
    this.ticker?.stop();
    this.pausedBeat = b;
    this.patch({ status: 'ended' });
  }

  play(): void {
    if (!this.cfg) return;
    this.unlock();
    this.ensureScheduler();
    const st = this.state;
    this.clockKind = this.ctx && this.ctx.state === 'running' ? 'audio' : 'silent';
    // resume()이 아직 끝나지 않았으면(첫 터치) 시계가 멈춰 있으므로 잠시 뒤 다시 맞춘다
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().then(
        () => {
          if (this.state.status === 'playing' && this.clockKind === 'silent' && this.ctx?.state === 'running') {
            const b = this.beat();
            this.clockKind = 'audio';
            this.t0 = resumeT0(this.ctx.currentTime, b, this.state.bpm, this.lead, 0.05);
            this.scheduler!.stop();
            this.scheduler!.start(this.t0, this.state.bpm, this.lead, this.clickOff() ? silentPlan() : this.plan(), b);
            this.patch({ clockKind: 'audio' });
          }
        },
        () => undefined,
      );
    }
    const now = this.clockNow();
    let from: number;
    if (st.status === 'paused' || st.status === 'stepping') {
      from = st.status === 'stepping' ? this.beat() : this.pausedBeat;
      this.anim = null;
      if (from < -this.lead) from = -this.lead;
      // 멈춘 그림에서 그대로 이어지도록 지연 보정만큼 소리를 앞당긴다
      from += this.offsetMs / 1000 / secPerBeat(st.bpm);
      this.t0 = resumeT0(now, from, st.bpm, this.lead, 0.1);
    } else {
      from = -this.lead;
      this.t0 = now + 0.1;
    }
    this.scheduler!.start(this.t0, st.bpm, this.lead, this.clickOff() ? silentPlan() : this.plan(), from);
    this.ticker!.start();
    this.patch({ status: 'playing', clockKind: this.clockKind });
  }

  pause(): void {
    if (this.state.status !== 'playing' && this.state.status !== 'stepping') return;
    this.pausedBeat = this.beat(); // 보이는 박에서 멈춘다
    this.anim = null;
    this.scheduler?.stop();
    this.ticker?.stop();
    this.patch({ status: 'paused' });
  }

  toggle(): void {
    if (this.state.status === 'playing') this.pause();
    else this.play();
  }

  stop(): void {
    this.scheduler?.stop();
    this.ticker?.stop();
    this.anim = null;
    this.pausedBeat = READY_BEAT;
    this.patch({ status: 'stopped' });
  }

  /** 정지 상태로 박 b의 자세로 옮긴다 (dur초에 걸쳐) */
  goTo(b: number, dur = 0.8, click: ClickKind | null = null, clickAtBeat?: number): void {
    if (!this.cfg) return;
    const from = this.beat();
    this.scheduler?.stop();
    this.ticker?.stop();
    const target = Math.max(-this.lead, Math.min(b, this.cfg.track.totalBeats));
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const d = reduce ? Math.min(dur, 0.25) : dur;
    if (d <= 0 || Math.abs(target - from) < 1e-6) {
      this.anim = null;
      this.pausedBeat = target;
      this.patch({ status: 'paused' });
    } else {
      this.anim = { from, to: target, start: performance.now(), dur: d };
      this.patch({ status: 'stepping' });
    }
    if (click && this.ctx && this.synth && this.ctx.state === 'running') {
      let delay = 0;
      if (clickAtBeat !== undefined && Math.abs(target - from) > 1e-6) {
        const x = (clickAtBeat - from) / (target - from);
        if (x > 0 && x < 1) delay = (Math.acos(1 - 2 * x) / Math.PI) * d;
      }
      this.synth.play(this.ctx.currentTime + 0.01 + delay, click);
    }
  }

  stepNext(): void {
    this.unlock();
    const t = this.track;
    if (!t) return;
    const cur = this.beat();
    const r = nextRest(t, cur);
    if (r) this.goTo(r.rest, 0.8, clickKindAt(r.landing), r.landing);
  }

  stepPrev(): void {
    this.unlock();
    const t = this.track;
    if (!t) return;
    const cur = this.beat();
    const r = prevRest(t, cur);
    this.goTo(r ? r.rest : READY_BEAT, 0.8, r ? clickKindAt(r.landing) : null, r?.landing);
  }

  setBpm(bpm: number): void {
    const b = Math.round(Math.max(BPM_MIN, Math.min(BPM_MAX, bpm)));
    const st = this.state;
    if (b === st.bpm) return;
    if (st.status === 'playing' && this.scheduler) {
      const now = this.clockNow();
      const beatNow = beatAt(now, this.t0, st.bpm, this.lead);
      this.t0 = retimeT0(now, beatNow, b, this.lead);
      this.patch({ bpm: b });
      this.scheduler.retime(this.t0, b);
    } else {
      this.patch({ bpm: b });
    }
  }

  setCountIn(n: 0 | 4 | 8): void {
    if (!this.cfg) return;
    this.cfg = { ...this.cfg, countInBeats: n };
    if (this.state.status === 'playing') {
      // 재생 중에는 지금 박을 유지한 채 준비 구간 길이만 바꾼다
      const now = this.clockNow();
      const beatNow = beatAt(now, this.t0, this.state.bpm, this.lead);
      this.lead = leadBeats(n);
      this.t0 = retimeT0(now, beatNow, this.state.bpm, this.lead);
      this.scheduler?.stop();
      this.scheduler?.start(this.t0, this.state.bpm, this.lead, this.clickOff() ? silentPlan() : this.plan(), beatNow);
    } else {
      this.lead = leadBeats(n);
      if (this.state.status === 'stopped') this.pausedBeat = READY_BEAT;
    }
    this.patch({ countInBeats: n });
  }

  setClickMode(mode: ClickMode): void {
    if (!this.cfg) return;
    this.cfg = { ...this.cfg, clickMode: mode };
    this.scheduler?.setPlan(mode === 'off' ? silentPlan() : this.plan());
  }

  setMuted(m: boolean): void {
    this.synth?.setMuted(m);
    this.patch({ muted: m });
  }

  setAudioOffset(ms: number): void {
    this.offsetMs = ms;
  }

  playClick(kind: ClickKind): void {
    this.unlock();
    if (this.ctx && this.synth && this.ctx.state === 'running') this.synth.play(this.ctx.currentTime + 0.02, kind);
  }

  /** 지연 보정 도우미: 지금부터 n번, 간격 sec로 클릭을 예약하고 각 시각(heardNow 기준)을 돌려준다 */
  calibrationClicks(n: number, sec: number): number[] {
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || !this.synth) return [];
    const start = ctx.currentTime + 0.3;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      this.synth.play(start + i * sec, i % 4 === 0 ? 'strong' : 'weak');
      out.push(start + i * sec);
    }
    return out;
  }

  audioTimeNow(): number {
    return this.ctx ? this.heardNowAudio() : performance.now() / 1000;
  }

  private heardNowAudio(): number {
    const prev = this.clockKind;
    this.clockKind = 'audio';
    const t = this.heardNow();
    this.clockKind = prev;
    return t;
  }

  /** 지금까지 끝낸 재생 단위 수 (따라하기 진도용) */
  loopsDone(): number {
    const t = this.track;
    if (!t) return 0;
    return Math.max(0, Math.floor(this.beat() / t.unitLength + 1e-9));
  }

  release(key: string): void {
    if (this.cfg?.key !== key) return;
    this.stop();
  }
}

function silentPlan() {
  return { clickAt: () => null, endBeat: Infinity };
}

export function clickKindAt(beat: number): ClickKind {
  const c = countAt(beat);
  if (c.half) return 'and';
  return c.count === 1 || c.count === 5 ? 'strong' : 'weak';
}

interface RestHit {
  rest: number;
  landing: number;
  index: number;
}

function* restCandidates(track: Track, around: number): Generator<RestHit> {
  const { steps, timing } = track;
  if (!track.loop) {
    for (let i = 0; i < steps.length; i++) if (steps[i].beat < track.totalBeats - 1e-9) yield { rest: timing.rest[i], landing: steps[i].beat, index: i };
    return;
  }
  const L = track.loopBeats;
  for (let i = 0; i < steps.length; i++) if (steps[i].beat < L - 1e-9) yield { rest: timing.rest[i], landing: steps[i].beat, index: i };
  const k0 = Math.max(1, Math.floor(around / L) - 1);
  for (let k = k0; k <= k0 + 3; k++) {
    for (let i = 0; i < steps.length; i++) {
      const T = steps[i].beat;
      if (T >= L - 1e-9 && T < 2 * L - 1e-9) yield { rest: timing.rest[i] + (k - 1) * L, landing: T + (k - 1) * L, index: i };
    }
  }
}

export function nextRest(track: Track, beat: number): RestHit | null {
  let best: RestHit | null = null;
  for (const c of restCandidates(track, beat)) if (c.rest > beat + 1e-4 && (!best || c.rest < best.rest)) best = c;
  return best;
}

export function prevRest(track: Track, beat: number): RestHit | null {
  let best: RestHit | null = null;
  for (const c of restCandidates(track, beat)) if (c.rest < beat - 1e-4 && (!best || c.rest > best.rest)) best = c;
  return best;
}

/** 걸음 i(걸음 목록 안의 순서)의 착지 자세 박. rep = 몇 번째 루프인가 */
export function restBeatOf(track: Track, index: number, rep = 0): number {
  const r = track.timing.rest[index];
  if (!track.loop || rep <= 1) return r;
  return r + (rep - 1) * track.loopBeats;
}

export const player = new Player();
