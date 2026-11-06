// 콘텐츠 JSON 사이의 연결 (레슨 → 연습 → 블록 · 루틴 → 동작)
import { describe, expect, it } from 'vitest';
import { BLOCKS, EXERCISES, FIGURES, LESSONS, LESSON_MAP, ROUTINES, SOURCE_MAP, PRACTICE_BLOCK } from '@/content';
import { countLabel } from '@/engine/compose';
import { blockTrack, routineTrack } from './helpers';

describe('콘텐츠 연결', () => {
  it('레슨 Lv0 ~ Lv7이 순서대로 있고 선수 레슨이 존재한다', () => {
    expect(LESSONS.map((l) => l.level)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const l of LESSONS) for (const p of l.prerequisites) expect(LESSON_MAP[p], `${l.id} → ${p}`).toBeTruthy();
  });

  it('레슨이 가리키는 연습이 있고, 연습이 가리키는 블록 · 루틴이 있다', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if ('exerciseId' in s) expect(EXERCISES[s.exerciseId], `${l.id} → ${s.exerciseId}`).toBeTruthy();
      }
    }
    for (const e of Object.values(EXERCISES)) {
      if (e.target.kind === 'block') expect(BLOCKS[e.target.id], e.id).toBeTruthy();
      else expect(ROUTINES[e.target.id], e.id).toBeTruthy();
    }
  });

  it("'한 카운트씩' 설명은 실제로 있는 카운트에만 붙어 있다", () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.kind !== 'stepThrough') continue;
        const ex = EXERCISES[s.exerciseId];
        const t = ex.target.kind === 'block' ? blockTrack(ex.target.id, false) : routineTrack(ex.target.id, false);
        const labels = new Set(t.steps.map((st) => countLabel(st.beat)));
        for (const k of Object.keys(s.notes)) expect(labels.has(k), `${l.id} ${k}`).toBe(true);
      }
    }
  });

  it('블록 · 루틴이 가리키는 동작과 출처가 있다', () => {
    for (const b of Object.values(BLOCKS)) for (const f of b.figures) expect(FIGURES[f], `${b.id} → ${f}`).toBeTruthy();
    for (const r of Object.values(ROUTINES)) for (const b of r.blocks) expect(BLOCKS[b], `${r.id} → ${b}`).toBeTruthy();
    for (const f of Object.values(FIGURES)) for (const s of f.sources) expect(SOURCE_MAP[s.sourceId], `${f.id} → ${s.sourceId}`).toBeTruthy();
    for (const [fig, block] of Object.entries(PRACTICE_BLOCK)) {
      expect(FIGURES[fig]).toBeTruthy();
      expect(BLOCKS[block].figures).toContain(fig);
    }
  });

  it('모든 동작은 검수 전 초안이고 검수 질문이 있다 (7.7)', () => {
    for (const f of Object.values(FIGURES)) {
      expect(f.verification.status).toBe('draft');
      expect(f.verification.openQuestions.length).toBeGreaterThan(0);
    }
  });
});

describe('표의 반올림 (설계문서 5.3 표와 같게)', () => {
  it('재즈박스 골반 목표가 (−0.46, +0.10) (+0.23, −0.40) (−0.12, −0.06)로 표시된다', async () => {
    const { round2 } = await import('@/lib/format');
    expect(round2(-0.45500000000000007)).toBe('-0.46');
    expect(round2(-0.4549999999999999)).toBe('-0.46');
    expect(round2(0.22499999999999998)).toBe('0.23');
    expect(round2(-0.12500000000000003)).toBe('-0.12');
    expect(round2(-0.125)).toBe('-0.12');
    expect(round2(0.375)).toBe('0.38');
    expect(round2(1.14)).toBe('1.14');
  });
});
