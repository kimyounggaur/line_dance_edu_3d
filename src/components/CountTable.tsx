'use client';
// 카운트별 표 (5.3과 같은 열): 카운트 · 발 · 동작 · 착지 · 이동 · 체중 · 골반 목표 · 방향 · 구령 · 설명
import type { ResolvedStep } from '@/engine/types';
import type { BlockInstance } from '@/engine/compose';
import { toBlockLocal } from '@/engine/compose';
import { worldToLocalVec } from '@/engine/geometry';
import { wallName } from '@/engine/quiz';
import { FootBadge } from '@/render2d/CountBar';
import { cn } from '@/lib/cn';
import { signed2 } from '@/lib/format';

const f2 = signed2;
const pair = (p: [number, number]) => `(${f2(p[0])}, ${f2(p[1])})`;

export function CountTable({
  steps,
  block,
  selected,
  onSelect,
  failing,
  className,
}: {
  steps: ResolvedStep[];
  block: Pick<BlockInstance, 'origin' | 'heading'>;
  selected?: number | null;
  onSelect?: (i: number) => void;
  failing?: Set<string>;
  className?: string;
}) {
  return (
    // 좁은 화면에서는 가로로 스크롤된다 → 키보드로도 스크롤할 수 있게 초점을 받는다(WCAG 2.1.1)
    <div role="region" aria-label="카운트별 표" tabIndex={0} className={cn('overflow-x-auto rounded-[10px] border border-line focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink', className)}>
      <table className="w-full min-w-[860px] border-collapse text-left text-[14px]">
        <thead className="bg-paper text-[13px] text-ink-2">
          <tr>
            {['카운트', '발', '동작', '착지 (x, y)', '이동 (옆, 앞뒤)', '체중', '골반 목표 (x, y)', '방향', '구령', '설명'].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => {
            const to = toBlockLocal(s.to, block);
            const pel = toBlockLocal(s.pelvisTarget, block);
            const move = s.moveLocal;
            const bad = failing?.has(s.count);
            return (
              <tr
                key={s.index}
                onClick={() => onSelect?.(i)}
                className={cn(
                  'border-t border-line',
                  onSelect && 'cursor-pointer hover:bg-paper',
                  selected === i && 'bg-[#e8ebf0]',
                  bad && 'bg-danger-tint',
                )}
                aria-selected={selected === i}
              >
                <td className="whitespace-nowrap px-2 py-1.5 font-display text-lg">{s.count}</td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <FootBadge foot={s.foot} />
                    {s.foot === 'L' ? '왼발' : '오른발'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">{s.action === 'step' ? '디딤 ●' : '터치 ○'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{pair(to)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{pair(move)}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{s.weightAfter === 'L' ? '왼발' : '오른발'}</td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{pair(pel)}</td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  {wallName(s.headingAfter)}
                  {s.turn !== 0 ? <span className="ml-1 font-bold text-turn">↻ {s.turn > 0 ? '오른쪽' : '왼쪽'} 1/4</span> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-semibold">{s.cueKo}</td>
                <td className="px-2 py-1.5">{s.desc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 걸음의 이동을 블록 시작 방향 기준으로 (참고용) */
export function moveInBlockFrame(s: ResolvedStep, block: Pick<BlockInstance, 'heading'>): [number, number] {
  return worldToLocalVec(block.heading, [s.to[0] - s.from[0], s.to[1] - s.from[1]]);
}
