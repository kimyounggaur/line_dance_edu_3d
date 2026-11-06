'use client';
// 학습 지도 (설계문서 6.1 '/'): Lv0~Lv7 레슨이 순서대로. 끝낸 레슨 = 채운 발자국 ●, 다음 레슨 = 점선, 아직 = 빈 발자국 ○
import { Clock } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { DraftBadge } from '@/components/DraftBadge';
import { AppLink } from '@/platform';
import { BLOCKS, EXERCISES, LESSONS, ROUTINES } from '@/content';
import { useProgress } from '@/store/progress';
import type { Lesson } from '@/engine/types';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';

function lessonTargets(l: Lesson): string[] {
  const names: string[] = [];
  for (const s of l.sections) {
    if (!('exerciseId' in s)) continue;
    const ex = EXERCISES[s.exerciseId];
    if (!ex) continue;
    const n = ex.target.kind === 'block' ? BLOCKS[ex.target.id]?.nameKo : ROUTINES[ex.target.id]?.nameKo;
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

function StepMarker({ state, level, foot }: { state: 'done' | 'next' | 'todo'; level: number; foot: 'L' | 'R' }) {
  return (
    <svg viewBox="0 0 56 92" className="h-[84px] w-[52px] shrink-0" aria-hidden>
      <rect
        x="4"
        y="4"
        width="48"
        height="84"
        rx="24"
        fill={state === 'done' ? '#172033' : '#ffffff'}
        stroke="#172033"
        strokeWidth={state === 'todo' ? 2.5 : 3.5}
        strokeDasharray={state === 'next' ? '9 6' : undefined}
      />
      <text x="28" y="52" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-display)" fontSize="30" fill={state === 'done' ? '#ffffff' : '#172033'}>
        {level}
      </text>
      <text x="28" y="78" textAnchor="middle" fontSize="11" fontWeight="700" fill={state === 'done' ? '#ffffff' : '#586276'}>
        {foot}
      </text>
    </svg>
  );
}

export function HomeView() {
  const progress = useProgress((s) => s.progress);
  const last = useProgress((s) => s.last);
  const nextLesson = LESSONS.find((l) => !progress[l.id]?.completed) ?? null;
  const resume = last ? LESSONS.find((l) => l.id === last.lessonId) : null;
  const doneCount = LESSONS.filter((l) => progress[l.id]?.completed).length;

  return (
    <AppShell section="home">
      <section className="grid gap-6 pb-6 pt-2 md:grid-cols-[1.25fr_1fr] md:items-end">
        <div>
          <h1 className="font-display text-[clamp(38px,6vw,60px)] leading-[1.05] text-ink">라인댄스 첫걸음 3D</h1>
          <p className="mt-3 max-w-[36em] text-[17px] text-ink-2">
            발 위치, 좌우 이동, 체중 이동, 카운트, 방향 전환을 3D 아바타와 발 위치도로 보고 박자에 맞춰 따라 합니다. 다섯 기본 동작을 익힌 뒤 8카운트 블록을 이어 4벽 루틴까지 갑니다.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {resume && !progress[resume.id]?.completed ? (
              <AppLink to={{ name: 'lesson', id: resume.id }} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                이어서 학습: Lv{resume.level} {resume.title}
              </AppLink>
            ) : nextLesson ? (
              <AppLink to={{ name: 'lesson', id: nextLesson.id }} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                {doneCount === 0 ? 'Lv0부터 시작하기' : `다음 레슨: Lv${nextLesson.level} ${nextLesson.title}`}
              </AppLink>
            ) : (
              <AppLink to={{ name: 'routines' }} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                연결 연습으로 복습하기
              </AppLink>
            )}
            <AppLink to={{ name: 'steps' }} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              스텝 사전
            </AppLink>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-[12px] border border-draft bg-draft-tint/60 p-4 text-[15px] text-ink-2">
          <DraftBadge compact />
          <p>
            동작의 발 자리와 수치는 널리 쓰이는 스텝 정의로 새로 만든 초기값입니다. 강사 검수 전이라 교재에 따라 다를 수 있습니다.{' '}
            <AppLink to={{ name: 'sources' }} className="font-semibold text-ink underline">
              근거와 검수 상태
            </AppLink>
          </p>
        </div>
      </section>

      <section aria-labelledby="map-title" className="pb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="map-title" className="text-xl font-bold">
            학습 지도
          </h2>
          <p className="text-sm text-muted">
            레슨 {LESSONS.length}개 중 {doneCount}개를 마쳤습니다. 채운 발자국은 끝낸 레슨, 점선은 다음 레슨입니다.
          </p>
        </div>
        <ol className="relative flex flex-col gap-3">
          {LESSONS.map((l, i) => {
            const p = progress[l.id];
            const state: 'done' | 'next' | 'todo' = p?.completed ? 'done' : nextLesson?.id === l.id ? 'next' : 'todo';
            const foot = i % 2 === 0 ? 'L' : 'R';
            const total = l.sections.length;
            const doneSec = p?.completedSections.length ?? 0;
            return (
              <li key={l.id} className={cn('flex', foot === 'L' ? 'md:pr-[18%]' : 'md:pl-[18%]')}>
                <AppLink
                  to={{ name: 'lesson', id: l.id }}
                  className={cn(
                    'group flex w-full items-center gap-4 rounded-[14px] border bg-surface p-3 pr-5 no-underline transition-colors hover:border-ink',
                    state === 'next' ? 'border-2 border-ink' : 'border-line',
                  )}
                >
                  <StepMarker state={state} level={l.level} foot={foot} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-muted">Lv{l.level}</span>
                      <h3 className="text-[20px] font-bold leading-tight text-ink">{l.title}</h3>
                    </div>
                    <p className="mt-0.5 text-[15px] text-ink-2">{l.summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />약 {l.estimatedMinutes}분
                      </span>
                      <span>{lessonTargets(l).join(', ')}</span>
                      {state === 'done' ? (
                        <span className="font-semibold text-ok">완료{p?.quizBest !== undefined ? `, 퀴즈 ${p.quizBest}점` : ''}</span>
                      ) : doneSec > 0 ? (
                        <span className="font-semibold text-ink-2">
                          {doneSec}/{total} 단계
                        </span>
                      ) : null}
                    </div>
                  </div>
                </AppLink>
              </li>
            );
          })}
        </ol>
      </section>
    </AppShell>
  );
}
