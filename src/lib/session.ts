'use client';
// 연습 하나(무엇을 · 어떻게 재생할지)를 재생기에 연결한다. BPM · 배속 · 루프 · 카운트인은 화면 상태로 둔다 (6.4).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import type { Figure, Foot } from '@/engine/types';
import { DEFAULT_PARAMS, type EngineParams } from '@/engine/constants';
import { useSettings } from '@/store/settings';
import { player, BPM_MIN } from './player';
import { buildBundle, type TrackBundle, type TrackTarget } from './tracks';

/** 개발용 조정 패널의 값 (Phase 4) — 저장하지 않는다 */
export const useDevParams = create<{ overrides: Partial<EngineParams>; set(p: Partial<EngineParams>): void; reset(): void }>((set) => ({
  overrides: {},
  set: (p) => set((s) => ({ overrides: { ...s.overrides, ...p } })),
  reset: () => set({ overrides: {} }),
}));

export function useEngineParams(): EngineParams {
  const unitM = useSettings((s) => s.settings.unitM);
  const overrides = useDevParams((s) => s.overrides);
  return useMemo(() => ({ ...DEFAULT_PARAMS, ...overrides, unitM }), [unitM, overrides]);
}

export interface SessionSpec {
  id: string;
  target: TrackTarget;
  startFoot: Foot;
  loop: boolean;
  repeats?: number;
  bpm: number;
  countInBeats: 0 | 4 | 8;
  figures?: Record<string, Figure>;
  figuresVersion?: string;
}

export interface SessionControls {
  bpm: number;
  setBpm(n: number): void;
  speed: number;
  setSpeed(s: number): void;
  loop: boolean;
  setLoop(b: boolean): void;
  countIn: 0 | 4 | 8;
  setCountIn(n: 0 | 4 | 8): void;
  effectiveBpm: number;
}

export function effectiveBpm(base: number, speed: number): number {
  if (speed === 1) return base;
  const min = speed >= 0.5 ? 40 : BPM_MIN;
  return Math.max(min, Math.round(base * speed));
}

export function usePracticeSession(spec: SessionSpec | null): { bundle: TrackBundle | null; controls: SessionControls } {
  const params = useEngineParams();
  const click = useSettings((s) => s.settings.click);
  const offset = useSettings((s) => s.settings.audioOffsetMs);
  const [state, setState] = useState(() => ({ id: spec?.id ?? '', bpm: spec?.bpm ?? 80, speed: 1, loop: spec?.loop ?? true, countIn: spec?.countInBeats ?? 4 }));
  // 다른 연습으로 바뀌면 그 연습의 기본값으로 되돌린다
  let s = state;
  if (spec && state.id !== spec.id) {
    s = { id: spec.id, bpm: spec.bpm, speed: 1, loop: spec.loop, countIn: spec.countInBeats };
    setState(s);
  }
  const bundle = useMemo(
    () =>
      spec
        ? buildBundle(spec.target, {
            startFoot: spec.startFoot,
            loop: s.loop,
            repeats: spec.repeats,
            params,
            figures: spec.figures,
            figuresVersion: spec.figuresVersion,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec?.target, spec?.startFoot, spec?.repeats, spec?.figures, spec?.figuresVersion, s.loop, params],
  );
  const last = useRef<{ id: string; key: string } | null>(null);
  const eff = effectiveBpm(s.bpm, s.speed);
  useEffect(() => {
    if (!bundle || !spec) return;
    const sameSession = last.current?.id === spec.id;
    player.load(
      { key: bundle.key, track: bundle.track, mirrorTrack: bundle.mirror, bpm: eff, countInBeats: s.countIn, clickMode: click },
      { keepPosition: sameSession },
    );
    if (sameSession) player.setBpm(eff);
    last.current = { id: spec.id, key: bundle.key };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.key]);
  useEffect(() => () => player.release(last.current?.key ?? ''), []);
  useEffect(() => player.setClickMode(click), [click]);
  useEffect(() => player.setAudioOffset(offset), [offset]);

  const setBpm = useCallback((n: number) => {
    setState((p) => {
      const next = { ...p, bpm: Math.max(40, Math.min(160, Math.round(n))) };
      player.setBpm(effectiveBpm(next.bpm, next.speed));
      return next;
    });
  }, []);
  const setSpeed = useCallback((sp: number) => {
    setState((p) => {
      const next = { ...p, speed: sp };
      player.setBpm(effectiveBpm(next.bpm, next.speed));
      return next;
    });
  }, []);
  const setLoop = useCallback((b: boolean) => setState((p) => ({ ...p, loop: b })), []);
  const setCountIn = useCallback((n: 0 | 4 | 8) => {
    setState((p) => ({ ...p, countIn: n }));
    player.setCountIn(n);
  }, []);

  return {
    bundle,
    controls: { bpm: s.bpm, setBpm, speed: s.speed, setSpeed, loop: s.loop, setLoop, countIn: s.countIn, setCountIn, effectiveBpm: eff },
  };
}
