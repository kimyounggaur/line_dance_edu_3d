'use client';
// 블록 타임라인 (6.4 · 5.4): 블록 이름 · 8카운트 구령 요약 · 현재 블록 강조. 누르면 그 블록만 반복
import { Repeat } from 'lucide-react';
import type { Block, Figure } from '@/engine/types';
import { cn } from '@/lib/cn';

export function cueSummary(block: Block, figures: Record<string, Figure>): string {
  // 동작마다 구령을 묶는다: "옆 터치 | 옆 터치 …" 대신 동작 이름과 구령
  return block.figures.map((id) => figures[id]?.events.map((e) => e.cueKo).join(' ') ?? id).join(' / ');
}

export function BlockTimeline({
  blocks,
  figures,
  current,
  repeatIndex,
  onRepeat,
  onFull,
}: {
  blocks: Block[];
  figures: Record<string, Figure>;
  current: number;
  repeatIndex: number | null;
  onRepeat(i: number): void;
  onFull(): void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2" aria-label="블록 타임라인">
        {blocks.map((b, i) => {
          const isCur = repeatIndex === null ? i === current : i === repeatIndex;
          return (
            <li key={`${b.id}-${i}`}>
              <button
                type="button"
                onClick={() => onRepeat(i)}
                aria-current={isCur ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col gap-0.5 rounded-[10px] border px-3 py-2 text-left',
                  isCur ? 'border-[3px] border-ink bg-surface' : 'border-line bg-surface hover:border-line-strong',
                  repeatIndex !== null && repeatIndex !== i && 'opacity-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-display text-[22px] leading-none">{i + 1}</span>
                  <span className="font-bold">{b.nameKo}</span>
                  {repeatIndex === i ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-ink-2">
                      <Repeat className="h-4 w-4" />
                      반복 중
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-ink-2">{cueSummary(b, figures)}</span>
                <span className="text-[13px] text-muted">
                  {i * 8 + 1}~{i * 8 + 8}카운트
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {repeatIndex !== null ? (
        <button type="button" onClick={onFull} className="min-h-[var(--btn-h)] rounded-[10px] border-2 border-ink px-3 font-semibold">
          전체 루틴으로 돌아가기
        </button>
      ) : (
        <p className="text-sm text-muted">블록을 누르면 그 8카운트만 준비 자세에서 반복합니다.</p>
      )}
    </div>
  );
}
