// 움직이지 않는 발 위치도 (스텝 사전 카드 · 검수 표 옆). 블록 하나를 준비 자세에서 합성해 그린다.
import { useMemo } from 'react';
import type { Block, Figure, Foot } from '@/engine/types';
import { HOME, DEFAULT_PARAMS } from '@/engine/constants';
import { compose, readyState } from '@/engine/compose';
import { localToWorld } from '@/engine/geometry';
import { blockFrame, FOOT_COLOR, footPathD, footTransform, groupFootprints, labelSize, stepPathD } from '@/render2d/mapGeometry';
import { cn } from '@/lib/cn';

export function StaticFootmap({
  figureIds,
  figures,
  startFoot = 'R',
  className,
  title,
  showPaths = true,
}: {
  figureIds: string[];
  figures: Record<string, Figure>;
  startFoot?: Foot;
  className?: string;
  title: string;
  showPaths?: boolean;
}) {
  const data = useMemo(() => {
    const res = compose(
      figureIds.map((figureId) => ({ figureId, blockIndex: 0, blockId: 'static', unitIndex: 0, wall: 1 })),
      readyState(startFoot),
      { figures },
    );
    const block = res.blocks[0] ?? { origin: [0, 0] as [number, number], heading: 0 };
    return { steps: res.steps, block, frame: blockFrame(res.steps, block, DEFAULT_PARAMS.unitM, 0.5) };
  }, [figureIds, figures, startFoot]);
  const U = DEFAULT_PARAMS.unitM;
  const d = footPathD(U);
  const { frame, steps, block } = data;
  return (
    <svg viewBox={`${frame.cx - frame.r} ${-frame.cy - frame.r} ${frame.r * 2} ${frame.r * 2}`} className={cn('block aspect-square w-full rounded-[10px] bg-floor', className)} role="img" aria-label={title}>
      {(['L', 'R'] as Foot[]).map((f) => (
        <path key={f} d={d} transform={footTransform(localToWorld(block.origin, block.heading, HOME[f]), block.heading)} fill="none" stroke="#172033" strokeOpacity={0.5} strokeWidth={0.025} strokeDasharray="0.06 0.045" />
      ))}
      {showPaths
        ? steps.map((s) => <path key={`p${s.index}`} d={stepPathD(s)} fill="none" stroke={FOOT_COLOR[s.foot]} strokeWidth={0.02} strokeOpacity={0.45} />)
        : null}
      {groupFootprints(steps).map((g) => (
        <g key={g.key}>
          <path d={d} transform={footTransform(g.pos, g.yaw)} fill={g.anyStep ? FOOT_COLOR[g.foot] : '#ffffff'} fillOpacity={g.anyStep ? 0.85 : 0.7} stroke={FOOT_COLOR[g.foot]} strokeWidth={0.035} />
          <text x={g.pos[0]} y={-g.pos[1] + 0.005} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize(g.label, 0.15)} fontWeight={800} fill={g.anyStep ? '#ffffff' : FOOT_COLOR[g.foot]}>
            {g.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function blockFigureIds(block: Block): string[] {
  return block.figures;
}
