// 설계문서 11.1 · 5.3 · 5.5 · 부록 A.2 의 기준값
import { describe, expect, it } from 'vitest';
import { FIGURES } from '@/content';
import { compose, frameDelta, readyState } from '@/engine/compose';
import type { Vec2 } from '@/engine/types';
import { BLOCK_IDS, blockTrack, composeBlock, expectVec, landingsLocal } from './helpers';

describe('합성기 — 블록의 착지 좌표와 체중 (11.1)', () => {
  it('그레이프바인 블록의 착지 좌표', () => {
    const want: Vec2[] = [
      [1.2, 0],
      [1.5, -0.75],
      [2.4, 0],
      [2.0, 0],
      [1.0, 0],
      [0.7, -0.75],
      [-0.2, 0],
      [0.2, 0],
    ];
    landingsLocal(composeBlock('B2-vine')).forEach((p, i) => expectVec(p, want[i]));
  });

  it('그레이프바인 블록의 착지 후 체중은 R L R R L R L L', () => {
    expect(composeBlock('B2-vine').steps.map((s) => s.weightAfter).join(' ')).toBe('R L R R L R L L');
  });

  it('재즈박스 블록의 착지 좌표 — 두 번 반복', () => {
    const one: Vec2[] = [
      [-0.5, 0.75],
      [-0.2, -0.4],
      [0.3, -0.4],
      [-0.2, 0],
    ];
    landingsLocal(composeBlock('B3-jazzBox')).forEach((p, i) => expectVec(p, one[i % 4]));
  });

  it('V스텝 블록의 착지 좌표 — 두 번 반복', () => {
    const one: Vec2[] = [
      [0.7, 0.5],
      [-0.7, 0.5],
      [0.2, 0],
      [-0.2, 0],
    ];
    landingsLocal(composeBlock('B4-vStep')).forEach((p, i) => expectVec(p, one[i % 4]));
  });

  it("코스터 드릴은 10걸음 — 0, 0.5, 1, 2, 3, 4, 4.5, 5, 6, 7박 ('1&' · '5&' 포함)", () => {
    const res = composeBlock('B5-coaster');
    expect(res.steps.map((s) => s.beat)).toEqual([0, 0.5, 1, 2, 3, 4, 4.5, 5, 6, 7]);
    expect(res.steps.map((s) => s.count)).toEqual(['1', '1&', '2', '3', '4', '5', '5&', '6', '7', '8']);
  });

  it('스텝터치의 골반 지지점 x — 0.80, 1.14, 0.20, −0.14 두 번', () => {
    const xs = composeBlock('B1-stepTouch').steps.map((s) => s.pelvisTarget[0]);
    const want = [0.8, 1.14, 0.2, -0.14];
    xs.forEach((x, i) => expect(x).toBeCloseTo(want[i % 4], 2));
  });

  it('그레이프바인 2카운트의 골반 지지점은 (1.46, −0.10) ± 0.01', () => {
    expectVec(composeBlock('B2-vine').steps[1].pelvisTarget, [1.46, -0.1], 0.01);
  });
});

describe('합성기 — 5.3 · 5.5 표의 골반 목표 (± 0.01u)', () => {
  const tables: Record<string, Vec2[]> = {
    'B0-markTime': Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? [0.14, 0] : [-0.14, 0]) as Vec2),
    'B2-vine': [
      [0.8, 0],
      [1.46, -0.1],
      [2.18, -0.18],
      [2.34, 0],
      [1.4, 0],
      [0.74, -0.1],
      [0.02, -0.18],
      [-0.14, 0],
    ],
    'B3-jazzBox': [
      [-0.46, 0.1],
      [-0.27, -0.12],
      [0.23, -0.4],
      [-0.12, -0.06],
      [-0.46, 0.04],
      [-0.27, -0.12],
      [0.23, -0.4],
      [-0.12, -0.06],
    ],
    'B4-vStep': [
      [0.51, 0.4],
      [-0.3, 0.5],
      [0.01, 0.1],
      [-0.14, 0],
      [0.51, 0.4],
      [-0.3, 0.5],
      [0.01, 0.1],
      [-0.14, 0],
    ],
    'B5-coaster': [
      [0.14, -0.26],
      [-0.14, -0.4],
      [0.14, -0.07],
      [-0.14, 0],
      [0.14, 0],
      [-0.14, -0.26],
      [0.14, -0.4],
      [-0.14, -0.07],
      [0.14, 0],
      [-0.14, 0],
    ],
    'B6-vineQuarter': [
      [0.8, 0],
      [1.46, -0.1],
      [2.18, -0.18],
      [2.34, 0],
      [1.4, 0],
      [0.74, -0.1],
      [-0.05, -0.75],
      [-0.2, -0.69],
    ],
    'B7-jazzQuarter': [
      [-0.46, 0.1],
      [-0.27, -0.12],
      [0.23, -0.4],
      [-0.12, -0.06],
      [-0.46, 0.04],
      [-0.27, -0.12],
      [0.48, -0.57],
      [0.6, -0.26],
    ],
  };
  for (const [id, want] of Object.entries(tables)) {
    it(`${id}의 골반 목표`, () => {
      const steps = composeBlock(id).steps;
      expect(steps.length).toBe(want.length);
      steps.forEach((s, i) => expectVec(s.pelvisTarget, want[i], 0.0101));
    });
  }

  it('B6 7 · 8카운트의 이동(옆, 앞뒤)은 새 방향 기준 (−0.75, +1.20) · (+0.40, +0.90)', () => {
    const s = composeBlock('B6-vineQuarter').steps;
    expectVec(s[6].moveLocal, [-0.75, 1.2], 1e-6);
    expectVec(s[7].moveLocal, [0.4, 0.9], 1e-6);
  });

  it('B7 7 · 8카운트의 이동(옆, 앞뒤)은 새 방향 기준 (+1.35, +1.10) · (−0.20, +0.80)', () => {
    const s = composeBlock('B7-jazzQuarter').steps;
    expectVec(s[6].moveLocal, [1.35, 1.1], 1e-6);
    expectVec(s[7].moveLocal, [-0.2, 0.8], 1e-6);
  });
});

describe('합성기 — 끝 상태 (11.1, A.2)', () => {
  it('회전 없는 블록 B0~B5는 제자리 · 12시 · 체중 왼발로 끝난다', () => {
    for (const id of ['B0-markTime', 'B1-stepTouch', 'B2-vine', 'B3-jazzBox', 'B4-vStep', 'B5-coaster']) {
      const res = composeBlock(id);
      const d = frameDelta(readyState('R'), res.end);
      expectVec(d.shift, [0, 0]);
      expect(d.turn).toBe(0);
      expect(res.end.weightOn).toBe('L');
    }
  });

  it('그레이프바인 + 1/4턴(B6)은 9시(270°) · 체중 왼발 · 자리 이동 (−0.20, −0.55)', () => {
    const res = composeBlock('B6-vineQuarter');
    const d = frameDelta(readyState('R'), res.end);
    expect(((res.end.heading % 360) + 360) % 360).toBe(270);
    expect(res.end.weightOn).toBe('L');
    expectVec(d.shift, [-0.2, -0.55]);
  });

  it('재즈박스 + 1/4턴(B7)은 3시(90°) · 체중 왼발 · 자리 이동 (0.60, −0.40)', () => {
    const res = composeBlock('B7-jazzQuarter');
    const d = frameDelta(readyState('R'), res.end);
    expect(res.end.heading).toBe(90);
    expect(res.end.weightOn).toBe('L');
    expectVec(d.shift, [0.6, -0.4]);
  });

  it('동작 요약(A.2): 끝 체중과 좌표계 이동', () => {
    const want: Record<string, { w: 'L' | 'R'; shift: Vec2; turn: number }> = {
      sideTouch: { w: 'R', shift: [1, 0], turn: 0 },
      vine: { w: 'R', shift: [2.2, 0], turn: 0 },
      jazzBox: { w: 'L', shift: [0, 0], turn: 0 },
      vStep: { w: 'L', shift: [0, 0], turn: 0 },
      coaster: { w: 'R', shift: [0, 0], turn: 0 },
      markTime: { w: 'L', shift: [0, 0], turn: 0 },
      vineQuarter: { w: 'R', shift: [2.4, -0.55], turn: 90 },
      jazzBoxQuarter: { w: 'L', shift: [0.6, -0.4], turn: 90 },
    };
    for (const [id, w] of Object.entries(want)) {
      const res = compose([{ figureId: id, blockIndex: 0, blockId: 'x', unitIndex: 0, wall: 1 }], readyState('R'), { figures: FIGURES });
      const d = frameDelta(readyState('R'), res.end);
      expect(res.end.weightOn, id).toBe(w.w);
      expectVec(d.shift, w.shift);
      expect(d.turn, id).toBe(w.turn);
    }
  });
});

describe('합성기 — 왼발 시작(좌우 반전)', () => {
  it('왼발 시작 그레이프바인: 모든 x의 부호가 반대이고 발이 서로 바뀐다', () => {
    const r = composeBlock('B2-vine', { startFoot: 'R' }).steps;
    const l = composeBlock('B2-vine', { startFoot: 'L' }).steps;
    r.forEach((s, i) => {
      expect(l[i].foot).toBe(s.foot === 'R' ? 'L' : 'R');
      expect(l[i].to[0]).toBeCloseTo(-s.to[0], 9);
      expect(l[i].to[1]).toBeCloseTo(s.to[1], 9);
      expect(l[i].pelvisTarget[0]).toBeCloseTo(-s.pelvisTarget[0], 9);
    });
  });

  it('왼발 시작 블록 8종은 정확히 좌우 대칭이다', () => {
    for (const id of BLOCK_IDS) {
      const r = composeBlock(id, { startFoot: 'R' }).steps;
      const l = composeBlock(id, { startFoot: 'L' }).steps;
      expect(l.length).toBe(r.length);
      r.forEach((s, i) => {
        expect(l[i].to[0]).toBeCloseTo(-s.to[0], 9);
        expect(l[i].to[1]).toBeCloseTo(s.to[1], 9);
        expect(l[i].turn).toBe(-s.turn || 0);
      });
    }
  });

  it('왼발 시작이면 회전 방향도 반대 — B6은 90°(3시), B7은 270°(9시)로 끝난다', () => {
    expect(((composeBlock('B6-vineQuarter', { startFoot: 'L' }).end.heading % 360) + 360) % 360).toBe(90);
    expect(((composeBlock('B7-jazzQuarter', { startFoot: 'L' }).end.heading % 360) + 360) % 360).toBe(270);
  });
});

describe('합성기 — 루프 2회째 (8.3 stepsLoop)', () => {
  it('재즈박스 루프 2회째: 착지 좌표는 첫 회와 같고, 1카운트는 (0.3, −0.4)에서 출발하며 골반 지지점은 (−0.46, 0.04)', () => {
    const t = blockTrack('B3-jazzBox', true);
    const first = t.steps.slice(0, 8);
    const second = t.steps.slice(8, 16);
    second.forEach((s, i) => expectVec(s.to, first[i].to));
    expectVec(first[0].from, [0.2, 0]);
    expectVec(first[0].pelvisTarget, [-0.46, 0.1], 0.01);
    expectVec(second[0].from, [0.3, -0.4]);
    expectVec(second[0].pelvisTarget, [-0.46, 0.04], 0.01);
  });

  it('닫힌 블록의 루프 이동(loopShift)은 0, 회전 블록은 네 번 돌아 닫힌다', () => {
    for (const id of BLOCK_IDS) {
      const t = blockTrack(id, true);
      expectVec(t.loopShift, [0, 0], 1e-9);
      expect(t.closeN).toBe(id === 'B6-vineQuarter' || id === 'B7-jazzQuarter' ? 4 : 1);
    }
  });
});

describe('카운트별 표 표기 — 5.3 · 5.5 표의 골반 목표 문자열과 같다', () => {
  const doc: Record<string, string> = {
    'B1-stepTouch': '(+0.80, +0.00) (+1.14, +0.00) (+0.20, +0.00) (−0.14, +0.00) (+0.80, +0.00) (+1.14, +0.00) (+0.20, +0.00) (−0.14, +0.00)',
    'B2-vine': '(+0.80, +0.00) (+1.46, −0.10) (+2.18, −0.18) (+2.34, +0.00) (+1.40, +0.00) (+0.74, −0.10) (+0.02, −0.18) (−0.14, +0.00)',
    'B3-jazzBox': '(−0.46, +0.10) (−0.27, −0.12) (+0.23, −0.40) (−0.12, −0.06) (−0.46, +0.04) (−0.27, −0.12) (+0.23, −0.40) (−0.12, −0.06)',
    'B4-vStep': '(+0.51, +0.40) (−0.30, +0.50) (+0.01, +0.10) (−0.14, +0.00) (+0.51, +0.40) (−0.30, +0.50) (+0.01, +0.10) (−0.14, +0.00)',
    'B5-coaster':
      '(+0.14, −0.26) (−0.14, −0.40) (+0.14, −0.07) (−0.14, +0.00) (+0.14, +0.00) (−0.14, −0.26) (+0.14, −0.40) (−0.14, −0.07) (+0.14, +0.00) (−0.14, +0.00)',
    'B6-vineQuarter': '(+0.80, +0.00) (+1.46, −0.10) (+2.18, −0.18) (+2.34, +0.00) (+1.40, +0.00) (+0.74, −0.10) (−0.05, −0.75) (−0.20, −0.69)',
    'B7-jazzQuarter': '(−0.46, +0.10) (−0.27, −0.12) (+0.23, −0.40) (−0.12, −0.06) (−0.46, +0.04) (−0.27, −0.12) (+0.48, −0.57) (+0.60, −0.26)',
  };
  for (const [id, want] of Object.entries(doc)) {
    it(`${id}`, async () => {
      const { signed2 } = await import('@/lib/format');
      const got = composeBlock(id)
        .steps.map((s) => `(${signed2(s.pelvisTarget[0])}, ${signed2(s.pelvisTarget[1])})`)
        .join(' ');
      expect(got).toBe(want);
    });
  }
});
