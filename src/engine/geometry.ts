// f(h), r(h), 좌표 변환, 발 사각형, 겹침 검사(SAT) — 설계문서 7.1. 변환식은 이 파일 한 곳에만 둔다.
import type { Vec2, Vec3 } from './types';
import { BODY } from './constants';

export const DEG = Math.PI / 180;

/** 몸 방향 h(도)의 앞 방향. 0 = 12시, +90 = 3시 */
export function fwd(h: number): Vec2 {
  const r = h * DEG;
  return [Math.sin(r), Math.cos(r)];
}

/** 몸 방향 h(도)의 오른쪽 방향 */
export function right(h: number): Vec2 {
  const r = h * DEG;
  return [Math.cos(r), -Math.sin(r)];
}

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
export const len = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** 무용수 기준 (옆 a, 앞 b) → 바닥 좌표: origin + a·r(h) + b·f(h) */
export function localToWorld(origin: Vec2, h: number, p: Vec2): Vec2 {
  const f = fwd(h);
  const r = right(h);
  return [origin[0] + p[0] * r[0] + p[1] * f[0], origin[1] + p[0] * r[1] + p[1] * f[1]];
}

/** 바닥 좌표의 벡터 → 무용수 기준 (옆, 앞뒤) */
export function worldToLocalVec(h: number, v: Vec2): Vec2 {
  const f = fwd(h);
  const r = right(h);
  return [v[0] * r[0] + v[1] * r[1], v[0] * f[0] + v[1] * f[1]];
}

export function worldToLocal(origin: Vec2, h: number, p: Vec2): Vec2 {
  return worldToLocalVec(h, sub(p, origin));
}

/** 각도를 [0, 360)으로 */
export function normAngle(a: number): number {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

/** 가까운 쪽으로 보간 (350° → 10°는 +20°) */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d * t;
}

/** a에서 b로 가는 가장 짧은 각도 차 (−180, 180] */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function bezier2(p0: Vec2, p1: Vec2, p2: Vec2, s: number): Vec2 {
  const a = (1 - s) * (1 - s);
  const b = 2 * s * (1 - s);
  const c = s * s;
  return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
}

export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/** 0 → 1을 사인 곡선으로 (8.4의 s) */
export function easeSine(p: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp(p, 0, 1));
}

export interface FootDims {
  len: number; // u
  wid: number; // u
}

/** 발 크기(0.25 × 0.10 m)를 u로. 보폭 단위가 바뀌면 비율이 달라진다 */
export function footDims(unitM: number): FootDims {
  return { len: BODY.footLen / unitM, wid: BODY.footWid / unitM };
}

/** 발 사각형의 네 꼭짓점 (yaw: 발끝 방향, 0 = +y) */
export function footRect(center: Vec2, yaw: number, dims: FootDims): Vec2[] {
  const f = fwd(yaw);
  const r = right(yaw);
  const hl = dims.len / 2;
  const hw = dims.wid / 2;
  const pts: Vec2[] = [];
  for (const [sx, sy] of [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ] as const) {
    pts.push([center[0] + sx * hw * r[0] + sy * hl * f[0], center[1] + sx * hw * r[1] + sy * hl * f[1]]);
  }
  return pts;
}

/** 분리축 검사. 겹침 깊이(u)를 돌려준다. 겹치지 않으면 음수(간격) */
export function overlapDepth(a: Vec2[], b: Vec2[]): number {
  let best = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      let nx = y2 - y1;
      let ny = x1 - x2;
      const ln = Math.hypot(nx, ny);
      nx /= ln;
      ny /= ln;
      let aMin = Infinity;
      let aMax = -Infinity;
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const p of a) {
        const d = p[0] * nx + p[1] * ny;
        if (d < aMin) aMin = d;
        if (d > aMax) aMax = d;
      }
      for (const p of b) {
        const d = p[0] * nx + p[1] * ny;
        if (d < bMin) bMin = d;
        if (d > bMax) bMax = d;
      }
      const d = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (d < best) best = d;
    }
  }
  return best;
}

// ---------- 3D (m, z = 높이) ----------
export const v3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ],
};

/** 바닥 좌표(u) + 높이(m) → 3D(m) */
export function floorToM(p: Vec2, unitM: number, z = 0): Vec3 {
  return [p[0] * unitM, p[1] * unitM, z];
}
