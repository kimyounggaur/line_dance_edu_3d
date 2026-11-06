// 7.1의 Three.js 변환: X = x · UNIT_M, Y = 높이(m), Z = −y · UNIT_M, rotation.y = −heading · π/180.
// 좌표 변환은 이 파일과 engine/geometry.ts에만 둔다 (12장 위험: 좌우 · 앞뒤 뒤집힘).
import type { Vec2, Vec3 } from '@/engine/types';

export const DEG = Math.PI / 180;

/** 바닥 좌표(u) + 높이(m) → three 좌표 */
export function floor3(p: Vec2, unitM: number, height = 0): [number, number, number] {
  return [p[0] * unitM, height, -p[1] * unitM];
}

/** 엔진의 3D 좌표 (x, y, z=높이, m) → three 좌표 */
export function m3(v: Vec3): [number, number, number] {
  return [v[0], v[2], -v[1]];
}

/** 몸 방향(도) → rotation.y */
export function yawY(headingDeg: number): number {
  return -headingDeg * DEG;
}

/** 몸 방향(도)의 앞 방향을 three 벡터 성분으로 (x, z) */
export function fwd3(headingDeg: number): [number, number] {
  const r = headingDeg * DEG;
  return [Math.sin(r), -Math.cos(r)];
}

/** 몸 방향(도)의 오른쪽 방향 (x, z) */
export function right3(headingDeg: number): [number, number] {
  const r = headingDeg * DEG;
  return [Math.cos(r), Math.sin(r)];
}
