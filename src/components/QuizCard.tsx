'use client';
// 자동 퀴즈 진행 (설계문서 8.11, Phase 5): 문제를 낼 때는 그 순간의 자세에서 멈추고 답이 보이는 표시를 숨긴다.
// 틀리면 해설과 함께 그 카운트의 자세를 보여 준다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { QuizKind } from '@/engine/types';
import { generateQuiz, type QuizQuestion } from '@/engine/quiz';
import type { Track } from '@/engine/track';
import { FIGURES } from '@/content';
import { player } from '@/lib/player';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { QuizSpot } from '@/render2d/FootMap';

export interface QuizRunner {
  questions: QuizQuestion[];
  index: number;
  q: QuizQuestion | null;
  picked: number | null;
  score: number;
  finished: boolean;
  mask: boolean;
  spots: QuizSpot[] | null;
  answer(i: number): void;
  next(): void;
  retry(): void;
}

export function useQuizRunner(track: Track | null, opts: { count: number; kinds: QuizKind[]; key: string; onFinish?: (score: number, total: number) => void }): QuizRunner {
  // 씨앗은 브라우저에서 정한다 (같은 레슨을 다시 풀 때마다 다른 문제, 서버 렌더와 어긋나지 않게)
  const [seed, setSeed] = useState(1);
  useEffect(() => setSeed(Math.floor(Math.random() * 1e6) + 1), [opts.key]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const questions = useMemo(
    () => (track ? generateQuiz(track, { count: opts.count, kinds: opts.kinds, seed, figures: FIGURES }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track, seed, opts.key],
  );
  const q = questions[index] ?? null;
  useEffect(() => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  }, [opts.key]);
  useEffect(() => {
    if (q && !finished) player.goTo(q.showBeat, 0.4);
  }, [q, finished]);
  const answer = useCallback(
    (i: number) => {
      if (!q || picked !== null) return;
      setPicked(i);
      if (i === q.answer) setScore((s) => s + 1);
      player.goTo(q.revealBeat, 0.8);
    },
    [q, picked],
  );
  const next = useCallback(() => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
    } else {
      setFinished(true);
      opts.onFinish?.(score, questions.length);
    }
  }, [index, questions.length, score, opts]);
  const retry = useCallback(() => {
    setSeed((s) => s + 1);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  }, []);
  const spots = q && q.kind === 'nextSpot' && !finished ? q.choices.map((c) => ({ label: c.label, spot: c.spot! })) : null;
  return { questions, index, q, picked, score, finished, mask: !!q && picked === null && !finished, spots, answer, next, retry };
}

export function QuizCard({ runner }: { runner: QuizRunner }) {
  const { q, picked, finished, questions, index, score } = runner;
  if (finished) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg font-bold">
          {questions.length}문제 중 {score}개를 맞혔습니다.
        </p>
        <p className="text-ink-2">{score === questions.length ? '모두 맞았습니다. 다음 단계로 가세요.' : '틀린 문제는 한 카운트씩 보기로 다시 확인해 보세요.'}</p>
        <Button variant="outline" onClick={runner.retry}>
          <RotateCcw className="h-4 w-4" />
          새 문제로 다시 풀기
        </Button>
      </div>
    );
  }
  if (!q) return <p className="text-muted">문제를 만들 수 없습니다.</p>;
  const answered = picked !== null;
  const right = picked === q.answer;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-muted">
        문제 {index + 1}/{questions.length}
      </div>
      <p className="text-[17px] font-bold leading-snug">{q.prompt}</p>
      {q.kind === 'nextSpot' ? <p className="text-sm text-ink-2">발 위치도의 A · B · C 자리 중에서 고르세요.</p> : null}
      <div className={cn('grid gap-2', q.choices.length > 2 ? 'grid-cols-2' : 'grid-cols-2')} role="group" aria-label="보기">
        {q.choices.map((c, i) => {
          const isRight = answered && i === q.answer;
          const isWrongPick = answered && i === picked && !right;
          return (
            <Button
              key={c.value}
              variant="quiet"
              size="lg"
              disabled={answered}
              onClick={() => runner.answer(i)}
              className={cn('justify-start text-left disabled:opacity-100', isRight && 'border-2 border-ok bg-[#e6f4ea]', isWrongPick && 'border-2 border-danger bg-danger-tint')}
            >
              {isRight ? <Check className="h-5 w-5 text-ok" /> : isWrongPick ? <X className="h-5 w-5 text-danger" /> : null}
              {c.label}
            </Button>
          );
        })}
      </div>
      {answered ? (
        <div className={cn('rounded-[10px] border-l-4 p-3', right ? 'border-ok bg-[#eef7f0]' : 'border-danger bg-danger-tint')} role="status">
          <p className="font-bold">{right ? '맞았습니다.' : '아쉽습니다. 무대에 그 카운트의 자세를 보여 드립니다.'}</p>
          <p className="mt-1 text-ink-2">{q.explanation}</p>
        </div>
      ) : null}
      {answered ? (
        <Button variant="primary" onClick={runner.next}>
          {index + 1 < questions.length ? '다음 문제' : '결과 보기'}
        </Button>
      ) : null}
    </div>
  );
}
