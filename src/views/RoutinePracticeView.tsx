'use client';
// 연결 연습 (6.1 '/routines/[id]', Phase 6 · 7): 블록 타임라인 · 블록 반복 · 다음 블록 예고(2카운트 전) · 벽 카운터
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { AppShell } from '@/components/AppShell';
import { DraftBadge } from '@/components/DraftBadge';
import { PracticeLayout } from '@/components/PracticeLayout';
import { BlockTimeline } from '@/components/BlockTimeline';
import { AppLink } from '@/platform';
import { BLOCKS, EXERCISES, FIGURES, ROUTINES, contentReport } from '@/content';
import { useSettings } from '@/store/settings';
import { usePracticeSession } from '@/lib/session';
import { computeFrame, useFrameInfo } from '@/lib/frameBus';
import { player, usePlayerState } from '@/lib/player';
import type { TrackTarget } from '@/lib/tracks';
import { wallName } from '@/engine/quiz';
import { NotFoundView } from './NotFoundView';

function NextBlockPreview() {
  const info = useFrameInfo(useShallow((s) => ({ beatFloor: s.beatFloor, blockSeq: s.blockSeq, preparing: s.preparing })));
  const status = usePlayerState((s) => s.status);
  const track = player.track;
  if (!track || info.preparing || status === 'stopped') return null;
  const f = computeFrame();
  const block = track.blocks[Math.min(info.blockSeq, track.blocks.length - 1)];
  const left = block.endBeat - f.local;
  if (left > 2 || left <= 0) return null;
  const nextBlock = track.blocks.find((b) => Math.abs(b.startBeat - block.endBeat) < 1e-9);
  if (!nextBlock && !track.loop) return null;
  const nb = nextBlock ?? track.blocks[0];
  const first = track.steps.find((s) => s.beat >= nb.startBeat - 1e-9);
  const name = BLOCKS[nb.blockId]?.nameKo ?? nb.blockId;
  const wallChange = nb.unitIndex !== block.unitIndex && track.closeN > 1;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-end">
      <div className="ld-pop rounded-[12px] bg-ink px-4 py-2 text-white" role="status" aria-live="polite">
        <div className="text-sm font-semibold text-white/70">다음{wallChange ? ` · 벽 ${nb.wall} (${wallName(nb.heading)})` : ''}</div>
        <div className="text-[19px] font-bold">
          {name}, {first?.foot === 'L' ? '왼발' : '오른발'}부터
        </div>
      </div>
    </div>
  );
}

export function RoutinePracticeView({ id }: { id: string }) {
  const routine = ROUTINES[id];
  if (!routine) return <NotFoundView />;
  return <RoutinePracticeInner key={id} id={id} />;
}

function RoutinePracticeInner({ id }: { id: string }) {
  const routine = ROUTINES[id];
  const base = useSettings((s) => s.settings);
  const [repeatIndex, setRepeatIndex] = useState<number | null>(null);
  const ex = Object.values(EXERCISES).find((e) => e.target.kind === 'routine' && e.target.id === id && e.loop) ?? null;
  const settings = base;
  const startFoot = base.startFoot;
  const blocks = routine.blocks.map((b) => BLOCKS[b]);
  const target = useMemo<TrackTarget>(
    () => (repeatIndex === null ? { kind: 'routine', routine } : { kind: 'block', block: blocks[repeatIndex] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routine, repeatIndex],
  );
  const spec = useMemo(
    () => ({
      id: `routine:${id}:${repeatIndex ?? 'all'}:${startFoot}`,
      target,
      startFoot,
      loop: true,
      bpm: ex?.bpm ?? 72,
      countInBeats: 8 as const,
    }),
    [id, repeatIndex, startFoot, target, ex?.bpm],
  );
  const { bundle, controls } = usePracticeSession(spec);
  const blockIndex = useFrameInfo((s) => s.blockIndex);
  const report = contentReport().routines[id];
  const curName = repeatIndex === null ? blocks[blockIndex]?.nameKo : blocks[repeatIndex]?.nameKo;
  const prefix = (
    <>
      <span className="font-display text-[20px] leading-none text-ink">
        {(repeatIndex ?? blockIndex) + 1}/{blocks.length}
      </span>
      <span className="max-w-[9em] text-ink-2">{curName}</span>
    </>
  );

  const panel = (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[20px] font-bold">{routine.nameKo}</h2>
        <p className="text-sm text-ink-2">
          {routine.blocks.length * 8}카운트, {routine.walls}벽{routine.walls > 1 ? `, ${routine.rotation === 'CW' ? '오른쪽' : '왼쪽'}으로 돈다` : ''}
        </p>
      </div>
      <BlockTimeline
        blocks={blocks}
        figures={FIGURES}
        current={blockIndex}
        repeatIndex={repeatIndex}
        onRepeat={(i) => {
          player.unlock();
          setRepeatIndex(i);
        }}
        onFull={() => setRepeatIndex(null)}
      />
      {report && !report.ok ? (
        <div className="rounded-[10px] border border-danger bg-danger-tint p-3 text-sm">
          <p className="font-bold text-danger">검증 실패</p>
          <ul className="list-disc pl-5">
            {report.issues.slice(0, 5).map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <AppShell section="routines" wide>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <AppLink to={{ name: 'routines' }} className="inline-flex min-h-[var(--btn-h)] items-center gap-1 rounded-[8px] px-2 font-semibold text-ink-2 no-underline hover:bg-ink/[0.06]">
          <ArrowLeft className="h-4 w-4" />
          연결 연습
        </AppLink>
        <h1 className="text-[22px] font-bold">{routine.nameKo}</h1>
        <DraftBadge />
      </div>
      {bundle ? (
        <PracticeLayout
          settings={settings}
          controls={controls}
          left={panel}
          leftLabel="블록"
          countPrefix={prefix}
          stageOverlay={repeatIndex === null ? <NextBlockPreview /> : null}
          showWalls={routine.walls > 1}
          tempoSteps={[72, 88, 100]}
          highlight={ex?.highlight}
        />
      ) : null}
    </AppShell>
  );
}
