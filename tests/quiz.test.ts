// 설계문서 8.11 — 자동 퀴즈
import { describe, expect, it } from 'vitest';
import { FIGURES } from '@/content';
import { generateQuiz, mulberry32, josa, wallName } from '@/engine/quiz';
import { dist } from '@/engine/geometry';
import type { QuizKind } from '@/engine/types';
import { BLOCK_IDS, blockTrack, routineTrack } from './helpers';

const ALL: QuizKind[] = ['nextFoot', 'weightFoot', 'nextSpot', 'facing', 'freeAfter'];

describe('자동 퀴즈 (8.11)', () => {
  it('같은 씨앗이면 같은 문제', () => {
    const t = blockTrack('B2-vine', true);
    const a = generateQuiz(t, { count: 5, kinds: ALL, seed: 42, figures: FIGURES });
    const b = generateQuiz(t, { count: 5, kinds: ALL, seed: 42, figures: FIGURES });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = generateQuiz(t, { count: 5, kinds: ALL, seed: 43, figures: FIGURES });
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('보기 안에 정답이 정확히 하나 — 보기끼리 겹치지 않는다', () => {
    const tracks = [...BLOCK_IDS.map((id) => blockTrack(id, true)), routineTrack('R-D32', true)];
    for (const t of tracks) {
      for (let seed = 1; seed <= 30; seed++) {
        const qs = generateQuiz(t, { count: 4, kinds: ALL, seed, figures: FIGURES });
        expect(qs.length).toBe(4);
        for (const q of qs) {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.choices.length);
          expect(new Set(q.choices.map((c) => c.value)).size).toBe(q.choices.length);
          if (q.kind === 'nextSpot') {
            const right = q.choices[q.answer].spot!;
            const step = t.steps[q.stepIndex];
            expect(dist(right, step.to)).toBeLessThan(1e-9);
            q.choices.forEach((c, k) => {
              if (k !== q.answer) expect(dist(c.spot!, right)).toBeGreaterThan(0.3);
            });
          }
          if (q.kind === 'nextFoot') expect(q.choices[q.answer].value).toBe(t.steps[q.stepIndex].foot);
          if (q.kind === 'weightFoot') expect(q.choices[q.answer].value).toBe(t.steps[q.stepIndex].weightAfter);
          if (q.kind === 'facing') expect(q.choices[q.answer].value).toBe(wallName(t.steps[q.stepIndex].headingAfter));
        }
      }
    }
  });

  it("'지금 체중은 어느 발?'은 터치 직후를 자주 묻는다", () => {
    const t = blockTrack('B1-stepTouch', true);
    let touch = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of generateQuiz(t, { count: 1, kinds: ['weightFoot'], seed })) {
        total++;
        if (t.steps[q.stepIndex].action === 'touch') touch++;
      }
    }
    expect(touch / total).toBeGreaterThan(0.65); // 터치는 절반이지만 4배 가중
  });

  it('씨앗 난수와 조사', () => {
    const r = mulberry32(7);
    const xs = Array.from({ length: 5 }, () => r());
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(josa('스텝터치', '이', '가')).toBe('스텝터치가');
    expect(josa('그레이프바인', '이', '가')).toBe('그레이프바인이');
    expect(josa('V스텝(왼발 시작)', '이', '가')).toBe('V스텝(왼발 시작)이');
    expect(wallName(270)).toBe('9시');
    expect(wallName(-90)).toBe('9시');
  });
});
