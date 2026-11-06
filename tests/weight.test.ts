// 설계문서 8.5 — 체중 곡선과 골반
import { describe, expect, it } from 'vitest';
import { supportPoint, weightAt, supportFootAt, reachLimit } from '@/engine/weight';
import { HOME } from '@/engine/constants';
import { BLOCK_IDS, blockTrack, expectVec } from './helpers';

describe('체중과 골반 (8.5)', () => {
  it('준비 자세의 골반 지지점은 (−0.14, 0)', () => {
    expectVec(supportPoint({ L: HOME.L, R: HOME.R }, 'L'), [-0.14, 0], 1e-9);
  });

  it('두 발이 넓게 벌어지면 지지발 쪽으로 최대 0.30u만 간다', () => {
    const s = supportPoint({ L: [-0.7, 0.5], R: [0.7, 0.5] }, 'L');
    expectVec(s, [-0.3, 0.5], 1e-9);
  });

  it('터치에서는 체중이 움직이지 않는다 (체중 막대 고정)', () => {
    const t = blockTrack('B1-stepTouch', false);
    t.steps.forEach((s, i) => {
      if (s.action !== 'touch') return;
      const a = weightAt(t, t.timing.ws[i]).weightR;
      const b = weightAt(t, t.timing.we[i]).weightR;
      expect(a).toBeCloseTo(b, 12);
    });
  });

  it('디딤이 끝나면(착지 + 0.3 × 다음 간격) 체중이 다 넘어가 있다', () => {
    for (const id of BLOCK_IDS) {
      const t = blockTrack(id, false);
      t.steps.forEach((s, i) => {
        if (s.action !== 'step') return;
        expect(weightAt(t, t.timing.we[i]).weightR, `${id} ${s.count}`).toBeCloseTo(s.foot === 'R' ? 1 : 0, 12);
        expect(supportFootAt(t, s.beat + 1e-9)).toBe(s.foot);
      });
    }
  });

  it('체중 이동 구간은 서로 겹치지 않고, 다음 발은 체중이 다 넘어간 뒤에 뜬다', () => {
    for (const id of BLOCK_IDS) {
      const t = blockTrack(id, true);
      for (let i = 0; i + 1 < t.steps.length; i++) {
        expect(t.timing.we[i]).toBeLessThanOrEqual(t.timing.ws[i + 1] + 1e-12);
        if (t.steps[i].action === 'step' && t.steps[i + 1].foot !== t.steps[i].foot) {
          expect(t.timing.lift[i + 1]).toBeGreaterThanOrEqual(t.timing.we[i] - 1e-12);
        }
      }
    }
  });

  it('골반 수평 위치는 체중 구간이 끝나면 그 걸음의 지지점에 있다', () => {
    const t = blockTrack('B2-vine', false);
    t.steps.forEach((s, i) => expectVec(weightAt(t, t.timing.we[i]).pelvisPos, s.pelvisTarget, 1e-9));
  });

  it('다리가 닿지 않을 만큼 멀면 높이 한계는 −1', () => {
    expect(reachLimit({ L: [-3, 0], R: [3, 0] }, { L: 0, R: 0 }, [0, 0], 0)).toBe(-1);
    expect(reachLimit({ L: HOME.L, R: HOME.R }, { L: 0, R: 0 }, [0, 0], 0)).toBeCloseTo(0.85, 6);
  });
});
