// 설계문서 8.4 — 발 궤적과 경로 찾기
import { describe, expect, it } from 'vitest';
import { BLOCKS, FIGURES } from '@/content';
import { findPath, footAt, liftIndexAt } from '@/engine/footPath';
import { bezier2, footDims, footRect, overlapDepth } from '@/engine/geometry';
import { DEFAULT_PARAMS, LIMITS, OTHER, PATH } from '@/engine/constants';
import { compose, readyState } from '@/engine/compose';
import type { ResolvedStep } from '@/engine/types';
import { BLOCK_IDS, ROUTINE_IDS, blockItems, blockTrack, routineTrack } from './helpers';

const dims = footDims(DEFAULT_PARAMS.unitM);

/** 걸음 i의 경로 19개 표본이 지지발과 겹치지 않는가 */
function pathClear(steps: ResolvedStep[], i: number, startPos: Record<'L' | 'R', [number, number]>, startYaw: Record<'L' | 'R', number>) {
  const s = steps[i];
  const sup = OTHER[s.foot];
  let supPos = startPos[sup];
  let supYaw = startYaw[sup];
  for (let j = i - 1; j >= 0; j--) {
    if (steps[j].foot === sup) {
      supPos = steps[j].to;
      supYaw = steps[j].yawTo;
      break;
    }
  }
  // 지지발이 그 뒤에 피벗했다면 그 방향
  for (let j = i - 1; j >= 0; j--) {
    if (steps[j].foot === sup) break;
    if (steps[j].pivotFoot === sup) {
      supYaw = steps[j].pivotYawTo;
      break;
    }
  }
  for (let k = 1; k <= PATH.samples; k++) {
    const t = k / (PATH.samples + 1);
    const c = bezier2(s.from, s.ctrl, s.to, t);
    const yaw = s.yawFrom + (s.yawTo - s.yawFrom) * t;
    const syaw = s.pivotFoot === sup ? s.pivotYawFrom + (s.pivotYawTo - s.pivotYawFrom) * t : supYaw;
    if (overlapDepth(footRect(c, yaw, dims), footRect(supPos, syaw, dims)) > LIMITS.overlapEps) return false;
  }
  return true;
}

describe('경로 찾기 findPath (8.4)', () => {
  it('곧은 길이 지지발과 겹치지 않으면 휘지 않는다 (k = 0)', () => {
    const r = findPath([0.2, 0], [1.2, 0], 0, 0, [-0.2, 0], 0, 0, dims);
    expect(r.ok).toBe(true);
    expect(r.k).toBe(0);
  });

  it('뒤로 교차하는 걸음은 지지발을 피해 휜다', () => {
    // 그레이프바인 2카운트: 왼발 (−0.2, 0) → (1.5, −0.75), 지지발 오른발 (1.2, 0)
    const r = findPath([-0.2, 0], [1.5, -0.75], 0, 0, [1.2, 0], 0, 0, dims);
    expect(r.ok).toBe(true);
    expect(r.k).not.toBe(0);
  });

  it('제자리 걸음은 제어점이 가운데', () => {
    const r = findPath([0.2, 0], [0.2, 0], 0, 0, [-0.2, 0], 0, 0, dims);
    expect(r).toEqual({ ok: true, k: 0, ctrl: [0.2, 0] });
  });

  it('모든 블록 · 루틴의 모든 걸음에서 19개 표본이 지지발과 겹치지 않는다 (오른발 · 왼발 시작, 루프 포함)', () => {
    for (const startFoot of ['R', 'L'] as const) {
      const start = readyState(startFoot);
      for (const id of BLOCK_IDS) {
        const t = blockTrack(id, true, { startFoot });
        t.steps.forEach((s, i) => {
          expect(s.pathOk, `${id} ${s.count}`).toBe(true);
          expect(pathClear(t.steps, i, start.pos, start.yaw), `${id} #${i} ${s.count}`).toBe(true);
        });
      }
      for (const id of ROUTINE_IDS) {
        const t = routineTrack(id, true, { startFoot });
        t.steps.forEach((s, i) => expect(pathClear(t.steps, i, start.pos, start.yaw), `${id} #${i} ${s.count}`).toBe(true));
      }
    }
  });

  it('블록 순서쌍 64가지에서도 경로가 있다', () => {
    for (const a of BLOCK_IDS) {
      for (const b of BLOCK_IDS) {
        const items = [...blockItems(a, 0), ...blockItems(b, 1)].map((it) => ({ ...it, unitIndex: 0, wall: 1 }));
        const res = compose(items, readyState('R'), { figures: FIGURES });
        expect(res.steps.every((s) => s.pathOk), `${a} → ${b}`).toBe(true);
      }
    }
    expect(Object.keys(BLOCKS).length).toBe(8);
  });
});

describe('발 궤적 footAt (8.4)', () => {
  it('뜨기 전에는 제자리, 착지 순간에는 정확히 to · 높이 0', () => {
    const t = blockTrack('B2-vine', false);
    t.steps.forEach((s, i) => {
      const before = footAt(t, s.foot, t.timing.lift[i] - 1e-9, liftIndexAt(t, t.timing.lift[i] - 1e-9));
      expect(before.pos[0]).toBeCloseTo(s.from[0], 9);
      expect(before.pos[1]).toBeCloseTo(s.from[1], 9);
      const land = footAt(t, s.foot, s.beat, liftIndexAt(t, s.beat));
      expect(land.pos[0]).toBeCloseTo(s.to[0], 12);
      expect(land.pos[1]).toBeCloseTo(s.to[1], 12);
      expect(land.height).toBe(0);
    });
  });

  it('발이 가장 높이 뜨는 높이는 0.03 ~ 0.09 m, 제자리 걸음은 0.04 m', () => {
    const t = blockTrack('B0-markTime', false);
    for (let i = 0; i < t.steps.length; i++) expect(t.timing.H[i]).toBe(t.steps[i].distance < 1e-6 ? 0.04 : t.timing.H[i]);
    const v = blockTrack('B2-vine', false);
    for (const h of v.timing.H) {
      expect(h).toBeGreaterThanOrEqual(0.03);
      expect(h).toBeLessThanOrEqual(0.09);
    }
  });

  it('뜨는 박 = 착지 − 0.6 × 간격, 터치 뒤 같은 발은 직전 착지 + 0.1 × 간격 이후', () => {
    const t = blockTrack('B1-stepTouch', false);
    for (let i = 0; i < t.steps.length; i++) {
      const g = t.timing.gap[i];
      const expected = Math.max(t.timing.T[i] - 0.6 * g, i > 0 && t.steps[i - 1].foot === t.steps[i].foot ? t.timing.T[i - 1] + 0.1 * g : -Infinity);
      expect(t.timing.lift[i]).toBeCloseTo(expected, 12);
    }
  });

  it('앞꿈치로 먼저 닿는 걸음은 착지 순간 뒤꿈치가 0.04 m 떠 있다가 내려온다, 터치는 내려오지 않는다', () => {
    const t = blockTrack('B2-vine', false);
    const side = 0; // 1카운트 옆 (side)
    expect(t.timing.heelLand[side]).toBe(0.04);
    expect(t.timing.heelLowers[side]).toBe(1);
    const touch = 3; // 4카운트 터치
    expect(t.timing.heelLand[touch]).toBe(0.04);
    expect(t.timing.heelLowers[touch]).toBe(0);
    const j = blockTrack('B3-jazzBox', false);
    expect(j.timing.heelLand[0]).toBe(0); // crossFront는 발바닥 전체
  });
});
