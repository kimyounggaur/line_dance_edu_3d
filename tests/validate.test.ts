// 설계문서 8.2 · 11.1 · 부록 A.4 의 검증 결과
import { describe, expect, it } from 'vitest';
import { BLOCKS, FIGURES, ROUTINES, contentReport } from '@/content';
import { DEFAULT_PARAMS } from '@/engine/constants';
import { validateBlock, validateContent, validateFigure, validateItems, validateRoutine } from '@/engine/validate';
import type { Figure } from '@/engine/types';

const content = { figures: FIGURES, blocks: BLOCKS, routines: ROUTINES };

describe('검증기 — 초기값의 결과 (8.2 표)', () => {
  const report = contentReport();

  it('기본 동작 8종과 변형이 모두 V1 ~ V6 · V10을 통과한다 (오른발 · 왼발 시작)', () => {
    for (const [id, r] of Object.entries(report.figures)) expect(r.issues, id).toEqual([]);
  });

  it('블록 8종이 모두 통과한다 — V7 닫힘, 회전 블록은 네 번 돌아 V8', () => {
    for (const [id, r] of Object.entries(report.blocks)) expect(r.issues, id).toEqual([]);
  });

  it('루틴 5종이 모두 통과한다 — V8 벽 순서, V9 반복 가능', () => {
    for (const [id, r] of Object.entries(report.routines)) expect(r.issues, id).toEqual([]);
  });

  it('블록 8종의 순서쌍 64가지 "A 다음 B"가 모두 V1 · V3 · V4 · V5 · V6을 통과한다', () => {
    const full = validateContent(content, { pairs: true });
    expect(full.pairFailures).toEqual([]);
  });

  it('V5 다리 도달의 최솟값은 0.758 m ± 0.005 (그레이프바인 2 · 6카운트)', () => {
    const r = report.blocks['B2-vine'];
    expect(r.metrics.minPelvisLimit).toBeGreaterThan(0.753);
    expect(r.metrics.minPelvisLimit).toBeLessThan(0.763);
    expect(['2', '6']).toContain(r.metrics.minPelvisAt);
    const all = Math.min(...Object.values(report.blocks).map((b) => b.metrics.minPelvisLimit));
    expect(all).toBeCloseTo(0.758, 2);
  });

  it('블록별 골반 높이 한계의 최솟값 (A.4 표)', () => {
    const want: Record<string, number> = {
      'B0-markTime': 0.85,
      'B1-stepTouch': 0.809,
      'B2-vine': 0.758,
      'B3-jazzBox': 0.798,
      'B4-vStep': 0.809,
      'B5-coaster': 0.829,
      'B6-vineQuarter': 0.758,
      'B7-jazzQuarter': 0.797,
    };
    for (const [id, v] of Object.entries(want)) {
      expect(Math.abs(report.blocks[id].metrics.minPelvisLimit - v), id).toBeLessThan(0.0015);
    }
  });

  it('경로를 휘어야 하는 카운트 — B2: 2 · 6, B3: 1 · 3 · 5 · 7, B6: 2 · 6 · 7 · 8, B7: 1 · 3 · 5 · 7 · 8', () => {
    const want: Record<string, string[]> = {
      'B0-markTime': [],
      'B1-stepTouch': [],
      'B2-vine': ['2', '6'],
      'B3-jazzBox': ['1', '3', '5', '7'],
      'B4-vStep': [],
      'B5-coaster': [],
      'B6-vineQuarter': ['2', '6', '7', '8'],
      'B7-jazzQuarter': ['1', '3', '5', '7', '8'],
    };
    for (const [id, counts] of Object.entries(want)) expect(report.blocks[id].metrics.bendCounts, id).toEqual(counts);
  });

  it('V6 보폭: 최대 이동 1.86u(그레이프바인 뒤 교차), 최대 두 발 간격 1.40u', () => {
    const maxMove = Math.max(...Object.values(report.blocks).map((b) => b.metrics.maxMove));
    const maxStance = Math.max(...Object.values(report.blocks).map((b) => b.metrics.maxStance));
    expect(maxMove).toBeCloseTo(1.858, 3);
    expect(maxStance).toBeCloseTo(1.4, 6);
  });

  it('4벽 R-E16: 벽 시작 방향 0° → 270° → 180° → 90°, 4벽 뒤 이동 (0, 0) · 방향 0°', () => {
    const r = validateRoutine(ROUTINES['R-E16'], BLOCKS, FIGURES);
    expect(r.ok).toBe(true);
    expect(r.metrics.closeN).toBe(4);
    expect(r.metrics.wallHeadings).toEqual([0, 270, 180, 90]);
  });

  it('4벽 R-D32: 벽 시작 방향 0° → 90° → 180° → 270°, 4벽 뒤 이동 (0, 0) · 방향 0°', () => {
    const r = validateRoutine(ROUTINES['R-D32'], BLOCKS, FIGURES);
    expect(r.ok).toBe(true);
    expect(r.metrics.wallHeadings).toEqual([0, 90, 180, 270]);
    expect(r.metrics.shift[0]).toBeCloseTo(0.6, 9);
    expect(r.metrics.shift[1]).toBeCloseTo(-0.4, 9);
  });

  it('루틴 5종: 끝났을 때 자유발 = 시작할 때 자유발 (V9)', () => {
    for (const r of Object.values(ROUTINES)) expect(validateRoutine(r, BLOCKS, FIGURES).metrics.endWeight, r.id).toBe('L');
  });
});

describe('검증기 — 보폭 단위에 따른 결과 (A.4)', () => {
  const minLimit = (unitM: number) => {
    const rep = validateContent(content, { params: { ...DEFAULT_PARAMS, unitM } });
    const blocks = Object.values(rep.blocks);
    return { ok: blocks.every((b) => b.ok), codes: new Set(blocks.flatMap((b) => b.issues.map((i) => i.code))), min: Math.min(...blocks.map((b) => b.metrics.minPelvisLimit)) };
  };

  it('0.33 m: 교차한 발이 지지발과 겹친다 (V3 실패)', () => {
    const r = minLimit(0.33);
    expect(r.ok).toBe(false);
    expect(r.codes.has('V3')).toBe(true);
  });

  it.each([
    [0.34, 0.767],
    [0.36, 0.758],
    [0.38, 0.749],
    [0.4, 0.739],
  ])('%s m: 통과, 골반 높이 한계의 최솟값 %s m', (unit, want) => {
    const r = minLimit(unit);
    expect(r.ok).toBe(true);
    expect(Math.abs(r.min - want)).toBeLessThan(0.0015);
  });

  it('0.42 m: 다리 도달 한계가 0.73 m 아래 (V5 실패, 0.729 m)', () => {
    const r = minLimit(0.42);
    expect(r.ok).toBe(false);
    expect(r.codes.has('V5')).toBe(true);
    expect(Math.abs(r.min - 0.729)).toBeLessThan(0.0015);
  });
});

describe('검증기 — 실패를 잡아낸다', () => {
  const base = FIGURES.sideTouch;

  it('V1: 체중이 실린 발을 움직이면 실패', () => {
    const bad: Figure = { ...base, id: 'badV1', events: [{ ...base.events[0], foot: 'L' }] };
    const r = validateFigure(bad, FIGURES);
    expect(r.issues.some((i) => i.code === 'V1')).toBe(true);
  });

  it('V2: 블록의 길이 합이 8박이 아니면 실패, t가 거꾸로면 실패', () => {
    const r = validateBlock({ id: 'x', nameKo: 'x', figures: ['vine'], level: 0 }, FIGURES);
    expect(r.issues.some((i) => i.code === 'V2')).toBe(true);
    const bad: Figure = { ...base, id: 'badV2', events: [base.events[1], base.events[0]] };
    expect(validateFigure(bad, FIGURES).issues.some((i) => i.code === 'V2')).toBe(true);
  });

  it('V3: 착지한 두 발이 겹치면 실패', () => {
    const bad: Figure = { ...base, id: 'badV3', events: [{ ...base.events[0], to: [-0.1, 0.05] }] };
    expect(validateFigure(bad, FIGURES).issues.some((i) => i.code === 'V3')).toBe(true);
  });

  it('V6: 한 걸음이 2.0u를 넘으면 실패', () => {
    const bad: Figure = { ...base, id: 'badV6', events: [{ ...base.events[0], to: [2.5, 0] }] };
    expect(validateFigure(bad, FIGURES).issues.some((i) => i.code === 'V6')).toBe(true);
  });

  it('V7: 재즈박스 4카운트를 "모으기"로 바꾸면 블록이 제자리로 닫히지 않는다', () => {
    const r = validateBlock({ id: 'B3x', nameKo: '재즈박스 모으기 × 2', figures: ['jazzBoxTogether', 'jazzBoxTogether'], level: 3 }, FIGURES);
    expect(r.issues.some((i) => i.code === 'V7')).toBe(true);
  });

  it('V10: 반전할 수 없는 동작을 왼발 시작으로 쓰면 실패', () => {
    const fixed: Figure = { ...FIGURES.markTime, id: 'fixedR', mirrorable: false };
    const r = validateItems(
      [
        { figureId: 'sideTouch', blockIndex: 0, blockId: 'x' },
        { figureId: 'fixedR', blockIndex: 0, blockId: 'x' },
      ],
      { ...FIGURES, fixedR: fixed },
    );
    expect(r.issues.some((i) => i.code === 'V10')).toBe(true);
  });

  it('V8: 벽 수 · 회전 방향이 실제 회전과 다르면 실패', () => {
    const wrong = { ...ROUTINES['R-D32'], rotation: 'CCW' as const };
    expect(validateRoutine(wrong, BLOCKS, FIGURES).issues.some((i) => i.code === 'V8')).toBe(true);
    const wrongWalls = { ...ROUTINES['R-D32'], walls: 1 as const };
    expect(validateRoutine(wrongWalls, BLOCKS, FIGURES).issues.some((i) => i.code === 'V8')).toBe(true);
  });
});

describe('검증기 — 검수용 변형', () => {
  it('스텝터치 "터치를 약간 앞에"와 재즈박스 1/4턴 "2카운트에 회전"은 블록으로 넣어도 통과한다', () => {
    expect(validateBlock({ id: 'B1x', nameKo: 'x', figures: Array(4).fill('sideTouchFwd'), level: 1 }, FIGURES).issues).toEqual([]);
    expect(validateBlock({ id: 'B7x', nameKo: 'x', figures: ['jazzBox', 'jazzBoxQuarterOn2'], level: 7 }, FIGURES).issues).toEqual([]);
  });
});
