'use client';
// 레슨 (설계문서 6.1 '/lesson/[id]', 5.6의 공통 구조):
// 설명 → 시연(자동 재생) → 발 위치도 → 한 카운트씩 → 따라하기(템포 단계) → 체크리스트 → 퀴즈
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Exercise, Foot, Lesson, LessonSection } from '@/engine/types';
import { BLOCKS, EXERCISES, LESSONS, LESSON_MAP, ROUTINES } from '@/content';
import { AppShell } from '@/components/AppShell';
import { DraftBadge } from '@/components/DraftBadge';
import { PracticeLayout } from '@/components/PracticeLayout';
import { Prose } from '@/components/Prose';
import { QuizCard, useQuizRunner } from '@/components/QuizCard';
import { Button, buttonVariants } from '@/components/ui/button';
import { AppLink } from '@/platform';
import { useSettings, effectiveSettings } from '@/store/settings';
import { useProgress } from '@/store/progress';
import { usePracticeSession, type SessionControls } from '@/lib/session';
import type { TrackTarget } from '@/lib/tracks';
import { player, usePlayerState } from '@/lib/player';
import { useFrameInfo } from '@/lib/frameBus';
import { cn } from '@/lib/cn';
import { NotFoundView } from './NotFoundView';

const KIND_KO: Record<LessonSection['kind'], string> = {
  text: '설명',
  demo: '시연',
  footmap: '발 위치도',
  stepThrough: '한 카운트씩',
  practice: '따라하기',
  checklist: '자기 점검',
  quiz: '퀴즈',
};

export function sectionTitle(s: LessonSection): string {
  return s.title ?? KIND_KO[s.kind];
}

/** 이 단계의 무대에 올릴 연습: 그 단계의 연습, 없으면 가장 가까운 앞(없으면 뒤) 단계의 연습 */
function sectionExercise(lesson: Lesson, i: number): Exercise | null {
  const ex = (k: number) => {
    const s = lesson.sections[k];
    return s && 'exerciseId' in s ? EXERCISES[s.exerciseId] ?? null : null;
  };
  if (ex(i)) return ex(i);
  for (let k = i + 1; k < lesson.sections.length; k++) if (ex(k)) return ex(k);
  for (let k = i - 1; k >= 0; k--) if (ex(k)) return ex(k);
  return null;
}

export function exerciseTarget(ex: Exercise): TrackTarget {
  return ex.target.kind === 'block' ? { kind: 'block', block: BLOCKS[ex.target.id] } : { kind: 'routine', routine: ROUTINES[ex.target.id] };
}

const flip = (f: Foot): Foot => (f === 'R' ? 'L' : 'R');

/** 따라하기: 템포마다 몇 번 반복했는지 센다 */
function usePracticeCounter(controls: SessionControls, tempoSteps: number[], key: string) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const last = useRef(0);
  const beatFloor = useFrameInfo((s) => s.beatFloor);
  const status = usePlayerState((s) => s.status);
  useEffect(() => {
    setCounts({});
    last.current = 0;
  }, [key]);
  useEffect(() => {
    const loops = player.loopsDone();
    if (status !== 'playing') {
      if (status === 'stopped') last.current = 0;
      else last.current = loops;
      return;
    }
    if (loops > last.current) {
      const d = loops - last.current;
      last.current = loops;
      if (controls.speed === 1 && tempoSteps.includes(controls.bpm)) {
        setCounts((c) => ({ ...c, [controls.bpm]: (c[controls.bpm] ?? 0) + d }));
      }
    } else if (loops < last.current) last.current = loops;
  }, [beatFloor, status, controls.bpm, controls.speed, tempoSteps]);
  return counts;
}

function SectionBody({
  lesson,
  index,
  section,
  controls,
  quiz,
  onPracticeDone,
}: {
  lesson: Lesson;
  index: number;
  section: LessonSection;
  controls: SessionControls;
  quiz: ReturnType<typeof useQuizRunner>;
  onPracticeDone: (bpm: number) => void;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [manualPick, setManualPick] = useState<number | null>(null);
  const info = useFrameInfo(useShallow((s) => ({ stepIndex: s.stepIndex, count: s.count })));
  const status = usePlayerState((s) => s.status);
  const tempoSteps = section.kind === 'practice' ? section.tempoSteps : [];
  const counts = usePracticeCounter(controls, tempoSteps, `${lesson.id}:${index}`);
  const doneFired = useRef(false);
  useEffect(() => {
    setChecked({});
    setManualPick(null);
    doneFired.current = false;
  }, [lesson.id, index]);
  useEffect(() => {
    if (section.kind !== 'practice' || doneFired.current) return;
    if (section.tempoSteps.every((t) => (counts[t] ?? 0) >= section.minLoopsEach)) {
      doneFired.current = true;
      onPracticeDone(Math.max(...section.tempoSteps));
    }
  }, [counts, section, onPracticeDone]);

  switch (section.kind) {
    case 'text':
      return <Prose text={section.markdown} className="text-[16px] leading-[1.75]" />;
    case 'demo':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-[16px] leading-relaxed">{section.caption}</p>
          <p className="text-sm text-muted">재생 버튼으로 멈추고 이어 볼 수 있습니다. 시점은 무대 아래에서 바꿉니다.</p>
        </div>
      );
    case 'footmap':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-[16px] leading-relaxed">{section.caption}</p>
          <p className="text-sm text-muted">무대에 발 위치도를 크게 띄웠습니다. 발자국을 누르면 그 카운트의 착지 자세로 갑니다.</p>
        </div>
      );
    case 'stepThrough': {
      const track = player.track;
      const cur = info.stepIndex >= 0 && track ? track.steps[info.stepIndex] : null;
      const note = cur ? section.notes[cur.count] : null;
      const resting = status === 'paused' || status === 'stopped';
      return (
        <div className="flex flex-col gap-3">
          <p className="text-ink-2">▷ 버튼(또는 → 키)으로 한 카운트씩 넘깁니다. 걸음마다 0.8초에 걸쳐 착지 자세로 갑니다.</p>
          <div className="min-h-[96px] rounded-[10px] border border-line bg-paper p-3" aria-live="polite">
            {cur && resting && status !== 'stopped' ? (
              <>
                <div className="font-display text-[34px] leading-none">{cur.count}</div>
                <p className="mt-1 text-[16px] font-semibold">{note ?? cur.desc}</p>
                {note ? <p className="mt-1 text-sm text-muted">{cur.desc}</p> : null}
              </>
            ) : (
              <p className="text-muted">준비 자세입니다. ▷를 눌러 1카운트로 가세요.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => player.stepPrev()}>
              ◁ 이전
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => player.stepNext()}>
              다음 ▷
            </Button>
          </div>
        </div>
      );
    }
    case 'practice':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-ink-2">
            템포 단계마다 {section.minLoopsEach}번씩 따라 해 보세요. 아래 트랜스포트의 템포 버튼으로 바꿉니다. 느린 템포부터 시작합니다.
          </p>
          <ul className="flex flex-col gap-2">
            {section.tempoSteps.map((t) => {
              const n = Math.min(counts[t] ?? 0, section.minLoopsEach);
              const done = n >= section.minLoopsEach;
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => controls.setBpm(t)}
                    aria-pressed={controls.bpm === t}
                    className={cn(
                      'flex w-full items-center justify-between rounded-[10px] border px-3 py-2 text-left',
                      controls.bpm === t ? 'border-2 border-ink' : 'border-line',
                    )}
                  >
                    <span className="font-display text-[22px] leading-none">{t} BPM</span>
                    <span className={cn('text-sm font-semibold', done ? 'text-ok' : 'text-ink-2')}>
                      {done ? '완료' : `${n}/${section.minLoopsEach}번`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!controls.loop ? <p className="text-sm text-muted">루프를 켜면 계속 반복합니다.</p> : null}
        </div>
      );
    case 'checklist':
      return (
        <ul className="flex flex-col gap-2">
          {section.items.map((item, i) => (
            <li key={i}>
              <label className="flex min-h-[var(--btn-h)] cursor-pointer items-start gap-3 rounded-[10px] border border-line px-3 py-2">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[#172033]" checked={!!checked[i]} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
                <span className="text-[16px]">{item}</span>
              </label>
            </li>
          ))}
        </ul>
      );
    case 'quiz':
      if (section.mode === 'auto') return <QuizCard runner={quiz} />;
      return (
        <div className="flex flex-col gap-3">
          <p className="text-[17px] font-bold leading-snug">{section.question}</p>
          <div className="grid grid-cols-2 gap-2">
            {section.choices.map((c, i) => (
              <Button
                key={c}
                size="lg"
                variant="quiet"
                disabled={manualPick !== null}
                onClick={() => setManualPick(i)}
                className={cn(
                  'disabled:opacity-100',
                  manualPick !== null && i === section.answer && 'border-2 border-ok bg-[#e6f4ea]',
                  manualPick === i && i !== section.answer && 'border-2 border-danger bg-danger-tint',
                )}
              >
                {c}
              </Button>
            ))}
          </div>
          {manualPick !== null ? (
            <div className={cn('rounded-[10px] border-l-4 p-3', manualPick === section.answer ? 'border-ok bg-[#eef7f0]' : 'border-danger bg-danger-tint')} role="status">
              <p className="font-bold">{manualPick === section.answer ? '맞았습니다.' : '아쉽습니다.'}</p>
              <p className="mt-1 text-ink-2">{section.explanation}</p>
            </div>
          ) : null}
        </div>
      );
  }
}

export function LessonView({ id }: { id: string }) {
  const lesson = LESSON_MAP[id];
  if (!lesson) return <NotFoundView />;
  return <LessonInner key={lesson.id} lesson={lesson} />;
}

function LessonInner({ lesson }: { lesson: Lesson }) {
  const base = useSettings((s) => s.settings);
  const progress = useProgress((s) => s.progress[lesson.id]);
  const last = useProgress((s) => s.last);
  const completeSection = useProgress((s) => s.completeSection);
  const completeLesson = useProgress((s) => s.completeLesson);
  const recordBpm = useProgress((s) => s.recordBpm);
  const recordQuiz = useProgress((s) => s.recordQuiz);
  const visit = useProgress((s) => s.visit);
  const [sec, setSec] = useState(() => (last?.lessonId === lesson.id ? Math.min(last.section, lesson.sections.length - 1) : 0));
  const [finishedNow, setFinishedNow] = useState(false);
  const section = lesson.sections[sec];
  const ex = sectionExercise(lesson, sec);
  const settings = effectiveSettings(base, ex?.view);
  const startFoot: Foot = ex ? (base.startFoot === 'L' ? flip(ex.startFoot) : ex.startFoot) : 'R';
  const spec = useMemo(
    () =>
      ex
        ? {
            id: `${lesson.id}:${sec}:${startFoot}`,
            target: exerciseTarget(ex),
            startFoot,
            loop: ex.loop,
            repeats: ex.repeats,
            bpm: section.kind === 'practice' ? section.tempoSteps[0] : ex.bpm,
            countInBeats: ex.countInBeats,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson.id, sec, startFoot, ex?.id],
  );
  const { bundle, controls } = usePracticeSession(spec);

  // 시연 단계는 들어오면 자동 재생 (오디오는 단계 버튼을 누른 터치로 이미 열려 있다)
  useEffect(() => {
    if (!bundle) return;
    if (section.kind === 'demo') player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.key, sec]);

  useEffect(() => visit(lesson.id, sec), [lesson.id, sec, visit]);

  const quizSection = section.kind === 'quiz' && section.mode === 'auto' ? section : null;
  const quiz = useQuizRunner(quizSection ? (bundle?.track ?? null) : null, {
    count: quizSection?.count ?? 3,
    kinds: quizSection?.kinds ?? ['nextFoot'],
    key: `${lesson.id}:${sec}:${bundle?.key ?? ''}`,
    onFinish: (score, total) => recordQuiz(lesson.id, Math.round((score / Math.max(1, total)) * 100)),
  });

  const go = (i: number) => {
    player.unlock();
    setFinishedNow(false);
    setSec(Math.max(0, Math.min(lesson.sections.length - 1, i)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };
  const nextStep = () => {
    completeSection(lesson.id, sec);
    if (sec + 1 < lesson.sections.length) go(sec + 1);
    else {
      completeLesson(lesson.id);
      setFinishedNow(true);
      player.stop();
    }
  };
  const nextLesson = LESSONS.find((l) => l.level === lesson.level + 1) ?? null;
  const done = new Set(progress?.completedSections ?? []);

  const panel = (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-1" aria-label="레슨 단계">
        {lesson.sections.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === sec ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left text-[15px]',
                i === sec ? 'bg-ink text-white' : 'hover:bg-ink/[0.05]',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold',
                  done.has(i) ? (i === sec ? 'border-white bg-white text-ink' : 'border-ink bg-ink text-white') : i === sec ? 'border-white' : 'border-line-strong',
                )}
                aria-hidden
              >
                {done.has(i) ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="font-semibold">{sectionTitle(s)}</span>
              {done.has(i) ? <span className="sr-only">(완료)</span> : null}
            </button>
          </li>
        ))}
      </ol>
      <div className="border-t border-line pt-4">
        {finishedNow ? (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold">Lv{lesson.level} {lesson.title} 레슨을 마쳤습니다.</p>
            <p className="text-ink-2">학습 지도에 완료로 표시됩니다.</p>
            {nextLesson ? (
              <AppLink to={{ name: 'lesson', id: nextLesson.id }} className={buttonVariants({ variant: 'primary' })}>
                다음 레슨: Lv{nextLesson.level} {nextLesson.title}
              </AppLink>
            ) : (
              <AppLink to={{ name: 'routines' }} className={buttonVariants({ variant: 'primary' })}>
                연결 연습으로 가기
              </AppLink>
            )}
            <AppLink to={{ name: 'home' }} className={buttonVariants({ variant: 'quiet' })}>
              학습 지도로
            </AppLink>
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-[19px] font-bold">
              {sec + 1}. {sectionTitle(section)}
            </h2>
            <SectionBody
              lesson={lesson}
              index={sec}
              section={section}
              controls={controls}
              quiz={quiz}
              onPracticeDone={(bpm) => {
                recordBpm(lesson.id, bpm);
                completeSection(lesson.id, sec);
              }}
            />
          </>
        )}
      </div>
      {!finishedNow ? (
        <div className="flex gap-2 border-t border-line pt-4">
          <Button onClick={() => go(sec - 1)} disabled={sec === 0} aria-label="이전 단계">
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>
          <Button variant="primary" className="flex-1" onClick={nextStep}>
            {sec + 1 < lesson.sections.length ? '다음 단계' : '레슨 마치기'}
          </Button>
        </div>
      ) : null}
    </div>
  );

  const mask = quizSection ? quiz.mask : false;
  const highlight = ex?.highlight;

  return (
    <AppShell section="home" wide>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <AppLink to={{ name: 'home' }} className="inline-flex min-h-[var(--btn-h)] items-center gap-1 rounded-[8px] px-2 font-semibold text-ink-2 no-underline hover:bg-ink/[0.06]">
          <ArrowLeft className="h-4 w-4" />
          학습 지도
        </AppLink>
        <h1 className="text-[22px] font-bold">
          <span className="mr-2 text-muted">Lv{lesson.level}</span>
          {lesson.title}
        </h1>
        <DraftBadge />
        <div className="ml-auto flex items-center gap-1" role="img" aria-label={`진도 ${done.size}/${lesson.sections.length}`}>
          {lesson.sections.map((_, i) => (
            <span key={i} className={cn('h-2.5 w-2.5 rounded-full border border-ink', done.has(i) ? 'bg-ink' : 'bg-transparent', i === sec && 'ring-2 ring-ink ring-offset-1')} />
          ))}
        </div>
      </div>
      {bundle ? (
        <PracticeLayout
          settings={settings}
          controls={controls}
          left={panel}
          leftLabel="레슨"
          mask={mask}
          highlight={highlight}
          tempoSteps={section.kind === 'practice' ? section.tempoSteps : undefined}
          forceMapOnStage={section.kind === 'footmap'}
          mapProps={quiz.spots ? { quizSpots: quiz.spots, onPickSpot: quiz.answer, pickedSpot: quiz.picked, correctSpot: quiz.picked !== null ? quiz.q?.answer ?? null : null } : undefined}
        />
      ) : (
        <div className="max-w-[720px] rounded-[14px] border border-line bg-surface p-5">{panel}</div>
      )}
    </AppShell>
  );
}
