// 클릭음 합성 (설계문서 8.8). Web Audio를 직접 쓴다. 오디오 컨텍스트는 밖에서 받는다(모듈 안에서 전역을 만들지 않는다).
import type { ClickKind, ClickSink } from './scheduler';

export const CLICK_SOUNDS: Record<ClickKind, { freq: number; dur: number; gain: number }> = {
  strong: { freq: 1000, dur: 0.06, gain: 0.9 }, // 1 · 5카운트
  weak: { freq: 700, dur: 0.04, gain: 0.6 },
  and: { freq: 500, dur: 0.025, gain: 0.3 }, // '&' 걸음이 있는 반 박에만, 작게
};

export interface ClickSynth extends ClickSink {
  setMuted(muted: boolean): void;
  setVolume(v: number): void;
  /** 예약 없이 바로 한 번 (한 카운트씩 보기) */
  playNow(kind: ClickKind): void;
  dispose(): void;
}

interface Scheduled {
  osc: OscillatorNode;
  gain: GainNode;
  time: number;
}

export function createClickSynth(ctx: BaseAudioContext, out?: AudioNode): ClickSynth {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(out ?? ctx.destination);
  let volume = 0.8;
  let muted = false;
  const live = new Set<Scheduled>();

  function play(time: number, kind: ClickKind) {
    const s = CLICK_SOUNDS[kind];
    const t = Math.max(time, ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(s.freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(s.gain, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    osc.connect(gain);
    gain.connect(master);
    const item: Scheduled = { osc, gain, time: t };
    live.add(item);
    osc.onended = () => {
      live.delete(item);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* 이미 끊김 */
      }
    };
    osc.start(t);
    osc.stop(t + s.dur + 0.02);
  }

  return {
    play,
    cancelAfter(time: number) {
      for (const item of [...live]) {
        if (item.time > time) {
          try {
            item.osc.stop();
          } catch {
            /* 시작 전 정지 */
          }
          try {
            item.osc.disconnect();
            item.gain.disconnect();
          } catch {
            /* 이미 끊김 */
          }
          live.delete(item);
        }
      }
    },
    setMuted(m: boolean) {
      muted = m;
      master.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
    },
    setVolume(v: number) {
      volume = Math.max(0, Math.min(1, v));
      if (!muted) master.gain.setValueAtTime(volume, ctx.currentTime);
    },
    playNow(kind: ClickKind) {
      play(ctx.currentTime + 0.01, kind);
    },
    dispose() {
      for (const item of live) {
        try {
          item.osc.stop();
          item.osc.disconnect();
          item.gain.disconnect();
        } catch {
          /* 무시 */
        }
      }
      live.clear();
      try {
        master.disconnect();
      } catch {
        /* 무시 */
      }
    },
  };
}
