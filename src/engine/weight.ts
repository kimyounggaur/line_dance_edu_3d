// 체중과 골반 (설계문서 8.5): ① 체중 곡선 ② 골반 지지점 ③ 골반의 움직임(수평 위치 · 높이 · 기울기)
import type { Foot, FootPose, Vec2 } from './types';
import { BODY, DEFAULT_PARAMS, OTHER, REACH, TIMING, type EngineParams } from './constants';
import { fwd, lerp, right, smoothstep } from './geometry';
import { upperBound } from './timeline';
import type { Track } from './track';

/** ② 골반 지지점: 두 발 중점에서 지지발 쪽으로 gain만큼, 최대 maxOff */
export function supportPoint(pos: Record<Foot, Vec2>, weightFoot: Foot, params: EngineParams = DEFAULT_PARAMS): Vec2 {
  const A = pos[weightFoot];
  const B = pos[OTHER[weightFoot]];
  const mx = (A[0] + B[0]) / 2;
  const my = (A[1] + B[1]) / 2;
  let vx = params.pelvisGain * (A[0] - mx);
  let vy = params.pelvisGain * (A[1] - my);
  const ln = Math.hypot(vx, vy);
  if (ln > params.pelvisMaxOff) {
    vx = (vx * params.pelvisMaxOff) / ln;
    vy = (vy * params.pelvisMaxOff) / ln;
  }
  return [mx + vx, my + vy];
}

/** 주어진 골반 수평 위치에서 골반 높이 한계(m). 다리가 닿지 않으면 −1 (③, V5) */
export function reachLimit(
  pos: Record<Foot, Vec2>,
  yaw: Record<Foot, number>,
  pelvis: Vec2,
  heading: number,
  params: EngineParams = DEFAULT_PARAMS,
  footHeights: Record<Foot, number> = { L: 0, R: 0 },
): number {
  const U = params.unitM;
  const r = right(heading);
  let lim: number = params.pelvisBaseH;
  for (const [foot, sgn] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    const hx = pelvis[0] * U + sgn * BODY.hipHalf * r[0];
    const hy = pelvis[1] * U + sgn * BODY.hipHalf * r[1];
    const ff = fwd(yaw[foot]);
    const ax = pos[foot][0] * U - BODY.ankleBack * ff[0];
    const ay = pos[foot][1] * U - BODY.ankleBack * ff[1];
    const d = Math.hypot(ax - hx, ay - hy);
    if (d >= REACH) return -1;
    lim = Math.min(lim, BODY.ankleH + footHeights[foot] + Math.sqrt(REACH * REACH - d * d));
  }
  return lim;
}

export interface WeightSample {
  weightR: number; // 0 = 전부 왼발, 1 = 전부 오른발
  pelvisPos: Vec2; // 골반 수평 위치 (u)
  window: number; // 지금 적용 중인 걸음 (−1 = 없음)
}

/** ① 체중 곡선과 ③ 골반 수평 위치. 체중 이동 구간은 서로 겹치지 않으므로 마지막으로 시작한 구간 하나만 본다 */
export function weightAt(track: Track, b: number): WeightSample {
  const { steps, timing: tm, idx, start } = track;
  const q = upperBound(tm.ws, b) - 1;
  let weightR = start.weightOn === 'R' ? 1 : 0;
  let pelvisPos: Vec2 = [...track.startPelvis] as Vec2;
  if (q >= 0) {
    const pw = q > 0 ? idx.lastWeightStep[q - 1] : -1;
    const base = pw >= 0 ? (steps[pw].foot === 'R' ? 1 : 0) : weightR;
    const w = smoothstep((b - tm.ws[q]) / (tm.we[q] - tm.ws[q]));
    const sq = steps[q];
    weightR = sq.action === 'step' ? lerp(base, sq.foot === 'R' ? 1 : 0, w) : base;
    const Sprev = q > 0 ? steps[q - 1].pelvisTarget : track.startPelvis;
    pelvisPos = [lerp(Sprev[0], sq.pelvisTarget[0], w), lerp(Sprev[1], sq.pelvisTarget[1], w)];
  }
  return { weightR, pelvisPos, window: q };
}

/** 지금 체중 발 = 가장 최근에 착지한 디딤의 발 */
export function supportFootAt(track: Track, b: number): Foot {
  const landed = upperBound(track.timing.T, b) - 1;
  const lw = landed >= 0 ? track.idx.lastWeightStep[landed] : -1;
  return lw >= 0 ? track.steps[lw].foot : track.start.weightOn;
}

/** 디딤마다 살짝 내려앉는 깊이 (m) */
export function dipAt(track: Track, b: number): number {
  const { steps, timing: tm, params } = track;
  const n = steps.length;
  const landed = upperBound(tm.T, b) - 1;
  let dip = 0;
  const from = Math.max(0, landed - 3);
  const to = Math.min(n - 1, landed + 3);
  for (let i = from; i <= to; i++) {
    if (steps[i].action !== 'step') continue;
    const x = (b - tm.T[i]) / TIMING.dipWidth;
    if (Math.abs(x) < 5) dip += Math.exp(-x * x);
  }
  return dip * params.dipDepth;
}

/** ③ 골반 높이 = min(기본 높이 − 내려앉음, 다리가 닿는 한계) */
export function pelvisHeightAt(
  track: Track,
  b: number,
  feet: Record<Foot, FootPose>,
  pelvisPos: Vec2,
  heading: number,
): { height: number; limit: number } {
  const { params } = track;
  const dip = dipAt(track, b);
  const limit = reachLimit(
    { L: feet.L.pos, R: feet.R.pos },
    { L: feet.L.yaw, R: feet.R.yaw },
    pelvisPos,
    heading,
    params,
    { L: feet.L.height, R: feet.R.height },
  );
  const height = limit < 0 ? params.pelvisBaseH - dip : Math.min(params.pelvisBaseH - dip, limit);
  return { height, limit };
}

/** 골반 좌우 기울기(도): 체중이 오른발이면 오른쪽 엉덩이가 올라간다 */
export function pelvisRoll(weightR: number): number {
  return TIMING.rollDeg * (2 * weightR - 1);
}
