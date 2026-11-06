// 발 궤적 — 발이 뜨고 날아가 닿는 과정 (설계문서 8.4). 경로 찾기(findPath)와 한 발의 자세(footAt).
import type { Foot, FootPose, Vec2 } from './types';
import { LIMITS, PATH, TIMING } from './constants';
import { bezier2, clamp, easeSine, footRect, lerp, overlapDepth, smoothstep, type FootDims } from './geometry';
import { upperBound } from './timeline';
import type { Track } from './track';

export interface PathResult {
  ok: boolean;
  k: number; // 경로를 휜 정도 (u). 0 = 곧은 길
  ctrl: Vec2;
}

/** 지지발을 피해 가는 2차 베지어 제어점. k = 0, +0.1, −0.1, … ±2.0 순서로 19개 표본이 모두 비면 채택 */
export function findPath(
  from: Vec2,
  to: Vec2,
  yawFrom: number,
  yawTo: number,
  support: Vec2,
  supYawFrom: number,
  supYawTo: number,
  dims: FootDims,
): PathResult {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const d = Math.hypot(dx, dy);
  const mid: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  if (d < 1e-9) return { ok: true, k: 0, ctrl: mid };
  const n: Vec2 = [-dy / d, dx / d];
  const supRects = new Map<number, Vec2[]>();
  const clear = (ctrl: Vec2) => {
    for (let i = 1; i <= PATH.samples; i++) {
      const s = i / (PATH.samples + 1);
      const c = bezier2(from, ctrl, to, s);
      const yaw = yawFrom + (yawTo - yawFrom) * s;
      let sr = supRects.get(i);
      if (!sr) {
        sr = footRect(support, supYawFrom + (supYawTo - supYawFrom) * s, dims);
        supRects.set(i, sr);
      }
      if (overlapDepth(footRect(c, yaw, dims), sr) > LIMITS.overlapEps) return false;
    }
    return true;
  };
  const ks = [0];
  for (let i = 1; i <= PATH.kSteps; i++) ks.push(PATH.kStep * i, -PATH.kStep * i);
  for (const k of ks) {
    const ctrl: Vec2 = [mid[0] + n[0] * k, mid[1] + n[1] * k];
    if (clear(ctrl)) return { ok: true, k: Math.round(k * 1000) / 1000, ctrl };
  }
  return { ok: false, k: 0, ctrl: mid };
}

/** 마지막으로 뜬 걸음의 순서 (없으면 −1) */
export function liftIndexAt(track: Track, b: number): number {
  return upperBound(track.timing.lift, b) - 1;
}

/** 박 b에서 한 발의 자세. m = liftIndexAt(track, b) */
export function footAt(track: Track, foot: Foot, b: number, m: number): FootPose {
  const { steps, timing: tm, idx, start } = track;
  const j = m >= 0 ? idx.lastOfFoot[foot][m] : -1;
  let pos: Vec2;
  let yaw: number;
  let height = 0;
  let heel = 0;
  let planted = true;
  if (j < 0) {
    pos = [...start.pos[foot]] as Vec2;
    yaw = start.yaw[foot];
  } else {
    const s = steps[j];
    if (b < tm.T[j]) {
      const p = clamp((b - tm.lift[j]) / (tm.T[j] - tm.lift[j]), 0, 1);
      const e = easeSine(p);
      pos = bezier2(s.from, s.ctrl, s.to, e);
      height = tm.H[j] * Math.sin(Math.PI * p);
      yaw = lerp(s.yawFrom, s.yawTo, e);
      const jp = j > 0 ? idx.lastOfFoot[foot][j - 1] : -1;
      const heelPrev = jp >= 0 && tm.heelLand[jp] > 0 && !tm.heelLowers[jp] ? tm.heelLand[jp] : 0;
      heel = lerp(heelPrev, tm.heelLand[j], e);
      planted = false;
    } else {
      pos = [...s.to] as Vec2;
      yaw = s.yawTo;
      heel = tm.heelLowers[j]
        ? tm.heelLand[j] * (1 - smoothstep((b - tm.T[j]) / (TIMING.weightPost * tm.gapNext[j])))
        : tm.heelLand[j];
    }
  }
  // 지지발 피벗: 이 발이 마지막으로 움직인 뒤에 일어난 회전 (자리는 그대로, 방향만 돈다)
  const k = m >= 0 ? idx.lastPivot[foot][m] : -1;
  if (k >= 0 && k > j) {
    const sk = steps[k];
    yaw = b < tm.T[k] ? lerp(sk.pivotYawFrom, sk.pivotYawTo, easeSine((b - tm.lift[k]) / (tm.T[k] - tm.lift[k]))) : sk.pivotYawTo;
  }
  return { pos, height, yaw, heelLift: heel, planted };
}
