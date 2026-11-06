'use client';
// 자유 연습 (6.1 '/steps/[id]'): 레슨 패널 없이 넓은 무대. 시작 발 · 변형 · 템포를 자유롭게
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { EvidenceTag, FigureStatus } from '@/components/DraftBadge';
import { PracticeLayout } from '@/components/PracticeLayout';
import { CountTable } from '@/components/CountTable';
import { Segmented } from '@/components/ui/controls';
import { AppLink } from '@/platform';
import { BLOCKS, FIGURES, PRACTICE_BLOCK, blockWithVariant, variantsOf } from '@/content';
import { validateBlock } from '@/engine/validate';
import { useSettings } from '@/store/settings';
import { useEngineParams, usePracticeSession } from '@/lib/session';
import { player } from '@/lib/player';
import { NotFoundView } from './NotFoundView';
import { cueLine } from './StepsView';

export function StepPracticeView({ id }: { id: string }) {
  const fig = FIGURES[id];
  const blockId = PRACTICE_BLOCK[id];
  if (!fig || !blockId || fig.variantOf) return <NotFoundView />;
  return <StepPracticeInner key={id} id={id} />;
}

function StepPracticeInner({ id }: { id: string }) {
  const fig = FIGURES[id];
  const baseBlock = BLOCKS[PRACTICE_BLOCK[id]];
  const settings = useSettings((s) => s.settings);
  const params = useEngineParams();
  const [variant, setVariant] = useState(id);
  // 블록에 넣어도 검증을 통과하는 변형만 연습에 내놓는다 (8.2: 실패하면 재생 목록에서 뺀다)
  const variants = useMemo(
    () =>
      variantsOf(id).filter((v) => v.id === id || validateBlock(blockWithVariant(baseBlock, id, v.id), FIGURES, { params, startFoot: 'R' }).ok),
    [id, baseBlock, params],
  );
  const block = useMemo(() => blockWithVariant(baseBlock, id, variant), [baseBlock, id, variant]);
  const startFoot = settings.startFoot;
  const spec = useMemo(
    () => ({ id: `step:${id}:${variant}:${startFoot}`, target: { kind: 'block' as const, block }, startFoot, loop: true, bpm: 80, countInBeats: 4 as const }),
    [id, variant, startFoot, block],
  );
  const { bundle, controls } = usePracticeSession(spec);
  const track = bundle?.track ?? null;
  const firstBlock = track?.blocks[0];
  const steps = track && firstBlock ? track.steps.filter((s) => s.beat < firstBlock.endBeat - 1e-9) : [];
  const shownFig = FIGURES[variant] ?? fig;

  const panel = (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-[22px] font-bold">{fig.nameKo}</h2>
          <span className="text-sm text-muted">{fig.nameEn}</span>
        </div>
        {fig.aliases?.length ? <p className="text-sm text-muted">다른 이름: {fig.aliases.join(', ')}</p> : null}
        <p className="mt-2 font-display text-[26px] leading-tight">{cueLine(shownFig)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FigureStatus figure={shownFig} />
          <EvidenceTag evidence={fig.evidence} />
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-sm font-semibold text-ink-2">연습 블록</div>
        <p className="font-semibold">{baseBlock.nameKo}</p>
        <p className="text-sm text-muted">8카운트, 체중 왼발로 시작해 체중 왼발로 끝납니다.</p>
      </div>
      {variants.length > 1 ? (
        <div>
          <div className="mb-1.5 text-sm font-semibold text-ink-2">변형</div>
          <Segmented
            label="변형"
            value={variant}
            onChange={(v) => {
              player.stop();
              setVariant(v);
            }}
            options={variants.map((v) => ({ value: v.id, label: v.variantLabel ?? '기본형' }))}
          />
          <p className="mt-1.5 text-sm text-muted">교재마다 정의가 다른 곳입니다. 검수 모드에서 다른 변형도 비교할 수 있습니다.</p>
        </div>
      ) : null}
      <div>
        <div className="mb-1.5 text-sm font-semibold text-ink-2">시작 발</div>
        <Segmented
          label="시작 발"
          value={settings.startFoot}
          onChange={(v) => useSettings.getState().set('startFoot', v)}
          options={[
            { value: 'R', label: '오른발' },
            { value: 'L', label: '왼발 (좌우 반전)' },
          ]}
        />
      </div>
      <div>
        <div className="mb-1.5 text-sm font-semibold text-ink-2">검수 질문</div>
        <ul className="list-disc pl-5 text-sm text-ink-2">
          {shownFig.verification.openQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <AppShell section="steps" wide>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <AppLink to={{ name: 'steps' }} className="inline-flex min-h-[var(--btn-h)] items-center gap-1 rounded-[8px] px-2 font-semibold text-ink-2 no-underline hover:bg-ink/[0.06]">
          <ArrowLeft className="h-4 w-4" />
          스텝 사전
        </AppLink>
        <h1 className="text-[22px] font-bold">{fig.nameKo} 자유 연습</h1>
      </div>
      {bundle ? <PracticeLayout settings={settings} controls={controls} left={panel} leftLabel="동작" tempoSteps={[60, 80, 100, 120]} /> : null}
      {track && firstBlock ? (
        <section className="mt-4">
          <h2 className="mb-2 text-lg font-bold">카운트별 표</h2>
          <CountTable steps={steps} block={firstBlock} />
          <p className="mt-2 text-sm text-muted">좌표는 블록을 시작할 때의 자리 기준(단위 u, 1u = {Math.round(settings.unitM * 100)} cm). x+ = 오른쪽, y+ = 앞(12시).</p>
        </section>
      ) : null}
    </AppShell>
  );
}
