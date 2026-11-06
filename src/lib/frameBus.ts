'use client';
// 한 프레임에 한 번 박 → 자세를 계산해 2D · 카운트 바 · 상태 표시가 함께 쓴다 (설계문서 8.0의 '데이터는 하나, 시계는 하나').
// 매 프레임 React 상태를 바꾸지 않는다: 그림은 구독 콜백이 직접 갱신하고, 카운트 · 블록 같은 느린 값만 스토어에 둔다.
import { useEffect } from 'react';
import { create } from 'zustand';
import type { Pose, Vec2 } from '@/engine/types';
import { poseAt } from '@/engine/pose';
import { blockAtLocal, mapBeat, type Track } from '@/engine/track';
import type { BlockInstance } from '@/engine/compose';
import { player, usePlayerState, type PlayStatus } from './player';

export interface Frame {
  beat: number;
  track: Track | null;
  pose: Pose | null;
  mirrorPose: Pose | null;
  local: number;
  rep: number;
  shift: Vec2;
  block: BlockInstance | null;
  status: PlayStatus;
}

export interface FrameInfo {
  count: string;
  display: string; // 화면에 크게 쓰는 카운트: '&' 걸음이 있는 반 박에만 'c&'
  countNum: number;
  stepIndex: number; // 지금 날아가고 있거나 방금 착지한 걸음 (−1 = 없음)
  blockSeq: number; // 걸음 목록 안의 블록 인스턴스
  blockIndex: number; // 루틴 안의 블록 순서
  wall: number;
  rep: number;
  beatFloor: number;
  half: boolean;
  preparing: boolean; // 준비 구간(카운트인)
  preRoll: boolean; // 재생을 누른 뒤 카운트인이 시작되기 전의 0.1초
  trackKey: string;
}

export const useFrameInfo = create<FrameInfo>(() => ({
  count: '1',
  display: '1',
  countNum: 1,
  stepIndex: -1,
  blockSeq: 0,
  blockIndex: 0,
  wall: 1,
  rep: 0,
  beatFloor: -1,
  half: false,
  preparing: true,
  preRoll: false,
  trackKey: '',
}));

let latest: Frame = { beat: -1, track: null, pose: null, mirrorPose: null, local: -1, rep: 0, shift: [0, 0], block: null, status: 'stopped' };
let lastAt = -Infinity;
let mirrorWanted = false;

export function setMirrorWanted(on: boolean) {
  mirrorWanted = on;
  lastAt = -Infinity;
}

/** 지금 프레임 (같은 프레임 안에서는 다시 계산하지 않는다) */
export function computeFrame(): Frame {
  const now = performance.now();
  if (now - lastAt < 3) return latest;
  lastAt = now;
  const track = player.track;
  const status = usePlayerState.getState().status;
  if (!track) {
    latest = { ...latest, track: null, pose: null, mirrorPose: null, status };
    return latest;
  }
  const beat = player.beat();
  const pose = poseAt(track, beat);
  const mt = player.mirrorTrack;
  const mirrorPose = mirrorWanted && mt ? poseAt(mt, beat) : null;
  const m = mapBeat(track, beat);
  const block = blockAtLocal(track, Math.max(0, m.local));
  latest = { beat, track, pose, mirrorPose, local: m.local, rep: m.rep, shift: m.shift, block, status };
  return latest;
}

type FrameCb = (f: Frame) => void;
const subs = new Set<FrameCb>();
let users = 0;
let raf = 0;
let trackKey = '';

function loop() {
  raf = requestAnimationFrame(loop);
  const f = computeFrame();
  subs.forEach((cb) => cb(f));
  const p = f.pose;
  if (!p || !f.track) return;
  const key = usePlayerState.getState().key;
  const info = useFrameInfo.getState();
  const countNum = Math.floor((((Math.floor(f.beat + 1e-9) % 8) + 8) % 8)) + 1;
  const beatFloor = Math.floor(f.beat * 2 + 1e-9) / 2;
  const blockSeq = f.block?.seq ?? 0;
  const half = p.count.endsWith('&');
  const preRoll = f.beat < -player.leadBeats - 1e-6;
  const display = preRoll ? '준비' : half && f.beat >= 0 && f.track.halfBeats.has(Math.round(Math.floor(f.local * 2 + 1e-9))) ? p.count : String(countNum);
  if (
    info.count !== p.count ||
    info.display !== display ||
    info.preRoll !== preRoll ||
    info.stepIndex !== p.currentIndex ||
    info.blockSeq !== blockSeq ||
    info.wall !== p.wall ||
    info.rep !== f.rep ||
    info.beatFloor !== beatFloor ||
    info.trackKey !== key
  ) {
    trackKey = key;
    useFrameInfo.setState({
      count: p.count,
      display,
      countNum,
      stepIndex: p.currentIndex,
      blockSeq,
      blockIndex: f.block?.blockIndex ?? 0,
      wall: p.wall,
      rep: f.rep,
      beatFloor,
      half,
      preparing: f.beat < 0,
      preRoll,
      trackKey,
    });
  }
}

/** 화면이 떠 있는 동안 프레임 루프를 돌린다 */
export function useFrameBus() {
  useEffect(() => {
    users++;
    if (users === 1) raf = requestAnimationFrame(loop);
    return () => {
      users--;
      if (users === 0) cancelAnimationFrame(raf);
    };
  }, []);
}

/** 매 프레임 콜백 (DOM을 직접 갱신할 때) */
export function useFrameCallback(cb: FrameCb, deps: unknown[] = []) {
  useEffect(() => {
    subs.add(cb);
    cb(computeFrame());
    return () => {
      subs.delete(cb);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
