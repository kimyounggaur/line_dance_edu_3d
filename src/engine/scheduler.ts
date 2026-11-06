// 오디오 스케줄러 (설계문서 8.8). 시계와 소리 출력은 밖에서 받는다 → 브라우저 없이도 테스트할 수 있다.
import type { Track } from './track';
import { mapBeat } from './track';
import { countAt } from './timeline';

export type ClickKind = 'strong' | 'weak' | 'and';

export interface Clock {
  now(): number; // 초
}

export interface ClickSink {
  play(time: number, kind: ClickKind): void;
  /** time 이후에 예약된 소리를 취소한다 */
  cancelAfter(time: number): void;
}

export interface ClickPlan {
  clickAt(halfBeat: number): ClickKind | null;
  endBeat: number; // 이 박 이상은 예약하지 않는다 (루프면 Infinity)
}

export interface ClickPlanOptions {
  countInBeats: number;
  clickMode: 'on' | 'noAnd' | 'off';
}

/** 매 박 클릭(1 · 5는 강하게), '&' 걸음이 있는 반 박에만 약한 클릭. 카운트인도 같은 클릭 */
export function makeClickPlan(track: Track, opts: ClickPlanOptions): ClickPlan {
  return {
    endBeat: track.totalBeats,
    clickAt(h: number) {
      const beat = h / 2;
      if (h % 2 === 0) {
        if (beat < 0 && beat < -opts.countInBeats) return null; // 소리 없는 준비 박
        const c = countAt(beat).count;
        return c === 1 || c === 5 ? 'strong' : 'weak';
      }
      if (opts.clickMode === 'noAnd' || beat < 0) return null;
      const local = mapBeat(track, beat).local;
      return track.halfBeats.has(Math.round(local * 2)) ? 'and' : null;
    },
  };
}

export interface Scheduler {
  start(t0: number, bpm: number, lead: number, plan: ClickPlan, fromBeat: number): void;
  retime(t0: number, bpm: number): void;
  setPlan(plan: ClickPlan): void;
  stop(): void;
  tick(): number;
  readonly running: boolean;
}

/** 25 ms마다 tick()을 부르면 "지금 + lookahead" 안의 소리를 절대 시각으로 예약한다 */
export function createScheduler(clock: Clock, sink: ClickSink, lookahead = 0.1): Scheduler {
  let running = false;
  let t0 = 0;
  let bpm = 120;
  let lead = 1;
  let plan: ClickPlan = { clickAt: () => null, endBeat: Infinity };
  let nextHalf = 0;

  const timeOfHalf = (h: number) => t0 + (h / 2 + lead) * (60 / bpm);

  function tick(): number {
    if (!running) return 0;
    const now = clock.now();
    const horizon = now + lookahead;
    let count = 0;
    for (let guard = 0; guard < 10000; guard++) {
      const t = timeOfHalf(nextHalf);
      if (t >= horizon) break;
      if (nextHalf / 2 >= plan.endBeat) break;
      const kind = plan.clickAt(nextHalf);
      if (kind && t >= now - 0.02) {
        sink.play(t, kind);
        count++;
      }
      nextHalf++;
    }
    return count;
  }

  return {
    get running() {
      return running;
    },
    start(t0_, bpm_, lead_, plan_, fromBeat) {
      t0 = t0_;
      bpm = bpm_;
      lead = lead_;
      plan = plan_;
      nextHalf = Math.ceil(fromBeat * 2 - 1e-9);
      running = true;
      tick();
    },
    retime(t0_, bpm_) {
      const now = clock.now();
      sink.cancelAfter(now);
      t0 = t0_;
      bpm = bpm_;
      // 아직 지나지 않은 첫 반 박부터 다시 예약
      let h = Math.floor(((now - t0) / (60 / bpm) - lead) * 2);
      while (timeOfHalf(h) > now) h--;
      while (timeOfHalf(h) <= now) h++;
      nextHalf = h;
      tick();
    },
    setPlan(p) {
      plan = p;
    },
    stop() {
      running = false;
      sink.cancelAfter(clock.now());
    },
    tick,
  };
}
