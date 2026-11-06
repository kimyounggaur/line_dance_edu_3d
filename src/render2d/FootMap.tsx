'use client';
// 2D 발 위치도 (설계문서 8.9, 6.7). 위에서 본 SVG 지도. 위쪽이 앞(또는 몸 방향).
// 블록이 바뀔 때만 발자국 전체를 다시 그리고, 매 프레임에는 두 발 · 골반 · 방향 삼각형만 직접 옮긴다.
import { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Foot, Settings, Vec2 } from '@/engine/types';
import { HOME } from '@/engine/constants';
import { localToWorld } from '@/engine/geometry';
import { poseAt } from '@/engine/pose';
import { mapBeat, stepsInBlock } from '@/engine/track';
import { computeFrame, useFrameCallback, useFrameInfo } from '@/lib/frameBus';
import { player, restBeatOf } from '@/lib/player';
import { cn } from '@/lib/cn';
import { blockFrame, FOOT_COLOR, footPathD, footTransform, groupFootprints as groupPrints, labelSize, stepPathD } from './mapGeometry';

export interface QuizSpot {
  label: string;
  spot: Vec2;
}

export interface FootMapProps {
  settings: Settings;
  mask?: boolean;
  emphasizePath?: boolean;
  quizSpots?: QuizSpot[] | null;
  onPickSpot?: (index: number) => void;
  pickedSpot?: number | null;
  correctSpot?: number | null;
  /** 검수 모드: 발자국을 끌어 착지 자리를 바꾼다 (걸음 순서, 새 자리 u) */
  onDragStep?: (stepIndex: number, to: Vec2) => void;
  draggable?: (stepIndex: number) => boolean;
  className?: string;
  label?: string;
}

const TRAIL_N = 21;

export function FootMap({ settings, mask, emphasizePath, quizSpots, onPickSpot, pickedSpot, correctSpot, onDragStep, draggable, className, label }: FootMapProps) {
  const info = useFrameInfo(useShallow((s) => ({ blockSeq: s.blockSeq, rep: s.rep, trackKey: s.trackKey, stepIndex: s.stepIndex })));
  const track = player.track;
  const U = track?.params.unitM ?? 0.36;
  const footD = useMemo(() => footPathD(U), [U]);
  const svgRef = useRef<SVGSVGElement>(null);
  const rotRef = useRef<SVGGElement>(null);
  const feetRef = { L: useRef<SVGGElement>(null), R: useRef<SVGGElement>(null) };
  const feetFill = { L: useRef<SVGPathElement>(null), R: useRef<SVGPathElement>(null) };
  const pelvisRef = useRef<SVGCircleElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);
  const facingRef = useRef<SVGPathElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const [drag, setDrag] = useState<{ index: number; p: Vec2 } | null>(null);

  const data = useMemo(() => {
    if (!track) return null;
    const f = computeFrame();
    const block = track.blocks[Math.min(info.blockSeq, track.blocks.length - 1)];
    const shift = mapBeat(track, Math.max(0, f.beat)).shift;
    const steps = stepsInBlock(track, block);
    const frame = blockFrame(steps, block, U);
    const home = (['L', 'R'] as Foot[]).map((foot) => ({ foot, p: localToWorld(block.origin, block.heading, HOME[foot]) }));
    return { block, shift, steps, frame, home };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, info.blockSeq, info.rep, info.trackKey, U]);

  const facingMode = settings.mapUp === 'facing' && !onDragStep;

  useFrameCallback(
    (f) => {
      const t = player.track;
      if (!t || !f.pose || !data) return;
      const pose = f.pose;
      const cx = data.frame.cx + data.shift[0];
      const cy = -(data.frame.cy + data.shift[1]);
      const rot = facingMode ? -pose.heading : 0;
      rotRef.current?.setAttribute('transform', `rotate(${rot.toFixed(2)} ${cx} ${cy})`);
      // 글자는 지도와 반대로 돌려 바로 세운다
      labelsRef.current?.querySelectorAll<SVGTextElement>('[data-upright]').forEach((el) => {
        const x = el.getAttribute('x');
        const y = el.getAttribute('y');
        el.setAttribute('transform', `rotate(${(-rot).toFixed(2)} ${x} ${y})`);
      });
      for (const foot of ['L', 'R'] as const) {
        const fp = pose.feet[foot];
        const g = feetRef[foot].current;
        if (g) g.setAttribute('transform', `${footTransform(fp.pos, fp.yaw)} scale(${(1 + fp.height * 2.2).toFixed(3)})`);
        const fill = feetFill[foot].current;
        if (fill) {
          const share = foot === 'R' ? pose.weightR : 1 - pose.weightR;
          fill.setAttribute('fill-opacity', (0.12 + 0.88 * share).toFixed(3));
        }
      }
      const p = pose.pelvis.pos;
      pelvisRef.current?.setAttribute('cx', String(p[0]));
      pelvisRef.current?.setAttribute('cy', String(-p[1]));
      facingRef.current?.setAttribute('transform', `translate(${p[0]} ${-p[1]}) rotate(${pose.heading.toFixed(2)})`);
      if (trailRef.current && settings.layers.pelvis) {
        const pts: string[] = [];
        for (let i = 0; i < TRAIL_N; i++) {
          const b = Math.max(-1, f.beat - 2 + (2 * i) / (TRAIL_N - 1));
          const q = i === TRAIL_N - 1 ? pose : poseAt(t, b);
          pts.push(`${q.pelvis.pos[0].toFixed(3)},${(-q.pelvis.pos[1]).toFixed(3)}`);
        }
        trailRef.current.setAttribute('points', pts.join(' '));
      }
    },
    [data, facingMode, settings.layers.pelvis],
  );

  if (!track || !data) return <div className={cn('aspect-square w-full rounded-[12px] bg-floor', className)} />;

  const { frame, shift, steps, home, block } = data;
  const cx = frame.cx + shift[0];
  const cy = frame.cy + shift[1];
  const vb = `${cx - frame.r} ${-cy - frame.r} ${frame.r * 2} ${frame.r * 2}`;
  const cur = info.stepIndex;
  const next = track.steps[cur + 1] ?? null;
  const showPrints = !mask && settings.layers.footprints !== 'off';
  const groups = groupPrints(steps);
  const prints = settings.layers.footprints === 'next2' ? groups.filter((g) => g.steps.some((s) => s.index > cur && s.index <= cur + 2)) : groups;
  const sh = (p: Vec2): Vec2 => [p[0] + shift[0], p[1] + shift[1]];

  const toFloor = (e: React.PointerEvent): Vec2 | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(ctm.inverse());
    const snap = (v: number) => Math.round(v / 0.05) * 0.05;
    return [snap(q.x - shift[0]), snap(-q.y - shift[1])];
  };

  const seekStep = (i: number) => {
    player.goTo(restBeatOf(track, i, info.rep), 0.5);
  };

  const grid: number[] = [];
  for (let v = Math.floor((cx - frame.r) / 0.5) * 0.5; v <= cx + frame.r; v += 0.5) grid.push(v);
  const gridY: number[] = [];
  for (let v = Math.floor((-cy - frame.r) / 0.5) * 0.5; v <= -cy + frame.r; v += 0.5) gridY.push(v);
  const walls = [
    { t: '12시 · 앞', dx: 0, dy: 1 },
    { t: '3시', dx: 1, dy: 0 },
    { t: '6시 · 뒤', dx: 0, dy: -1 },
    { t: '9시', dx: -1, dy: 0 },
  ];
  const wr = frame.r - 0.18;

  return (
    <svg
      ref={svgRef}
      viewBox={vb}
      className={cn('block aspect-square w-full touch-none select-none rounded-[12px] bg-floor', className)}
      role="img"
      aria-label={label ?? '발 위치도: 위에서 본 발자국'}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = toFloor(e);
        if (p) setDrag({ ...drag, p });
      }}
      onPointerUp={() => {
        if (drag && onDragStep) onDragStep(drag.index, drag.p);
        setDrag(null);
      }}
      onPointerLeave={() => setDrag(null)}
    >
      <defs>
        <marker id="ld-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
      </defs>
      <g ref={rotRef}>
        {settings.layers.grid ? (
          <g stroke="#C9CFD8" strokeWidth={0.012}>
            {grid.map((x) => (
              <line key={`x${x}`} x1={x} y1={-cy - frame.r * 1.5} x2={x} y2={-cy + frame.r * 1.5} />
            ))}
            {gridY.map((y) => (
              <line key={`y${y}`} x1={cx - frame.r * 1.5} y1={y} x2={cx + frame.r * 1.5} y2={y} />
            ))}
          </g>
        ) : null}
        {home.map((h) => (
          <path key={h.foot} d={footD} transform={footTransform(sh(h.p), block.heading)} fill="none" stroke="#172033" strokeOpacity={0.55} strokeWidth={0.022} strokeDasharray="0.06 0.045" />
        ))}
        {showPrints
          ? prints.map((g) => {
              const c = FOOT_COLOR[g.foot];
              const first = g.steps[0];
              const past = g.steps.some((s) => s.index <= cur);
              const d = drag?.index === first.index ? drag.p : g.pos;
              const canDrag = !!onDragStep && (draggable?.(first.index) ?? true);
              const target = g.steps.find((s) => s.index > cur) ?? first;
              return (
                <g
                  key={g.key}
                  className={canDrag ? 'cursor-grab' : 'cursor-pointer'}
                  onPointerDown={(e) => {
                    if (canDrag) {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      setDrag({ index: first.index, p: g.pos });
                    }
                  }}
                  onClick={() => !canDrag && seekStep(target.index)}
                >
                  <path
                    d={footD}
                    transform={footTransform(sh(d), g.yaw)}
                    fill={g.anyStep ? c : '#ffffff'}
                    fillOpacity={g.anyStep ? (past ? 0.5 : 0.28) : 0.6}
                    stroke={c}
                    strokeWidth={g.anyStep ? 0.022 : 0.035}
                    strokeOpacity={past ? 0.9 : 0.65}
                  />
                </g>
              );
            })
          : null}
        {!mask && settings.layers.arrows && next ? (
          <path d={stepPathD(next, shift)} fill="none" stroke={FOOT_COLOR[next.foot]} strokeWidth={emphasizePath ? 0.05 : 0.032} strokeLinecap="round" markerEnd="url(#ld-arrow)" />
        ) : null}
        {!mask && next && settings.layers.footprints !== 'off' ? (
          <path d={footD} transform={footTransform(sh(next.to), next.yawTo)} className="ld-blink" fill="none" stroke={FOOT_COLOR[next.foot]} strokeWidth={0.04} strokeDasharray="0.07 0.05" />
        ) : null}
        {settings.layers.pelvis ? <polyline ref={trailRef} fill="none" stroke="#16A34A" strokeWidth={0.02} strokeOpacity={0.75} /> : null}
        {(['L', 'R'] as const).map((foot) => (
          <g key={foot} ref={feetRef[foot]}>
            <path d={footD} fill="#ffffff" stroke="none" />
            <path ref={feetFill[foot]} d={footD} fill={FOOT_COLOR[foot]} fillOpacity={0.5} stroke={FOOT_COLOR[foot]} strokeWidth={0.05} />
            <circle cx={0} cy={-footPathToeOffset(U)} r={0.035} fill="#ffffff" />
            <text x={0} y={0.07} textAnchor="middle" fontSize={0.16} fontWeight={800} fill="#ffffff" stroke={FOOT_COLOR[foot]} strokeWidth={0.012} paintOrder="stroke">
              {foot}
            </text>
          </g>
        ))}
        {settings.layers.facing ? <path ref={facingRef} d="M 0 -0.5 L 0.13 -0.3 L -0.13 -0.3 Z" fill="#172033" fillOpacity={0.7} /> : null}
        {settings.layers.pelvis ? <circle ref={pelvisRef} r={0.055} fill="#16A34A" stroke="#ffffff" strokeWidth={0.015} /> : null}
        {quizSpots?.map((q, i) => (
          <g key={q.label} className="cursor-pointer" onClick={() => onPickSpot?.(i)}>
            <circle
              cx={q.spot[0] + shift[0]}
              cy={-(q.spot[1] + shift[1])}
              r={0.2}
              fill={correctSpot === i ? '#15803D' : pickedSpot === i ? '#172033' : '#ffffff'}
              stroke="#172033"
              strokeWidth={0.03}
            />
          </g>
        ))}
        <g ref={labelsRef} style={{ pointerEvents: 'none' }}>
          {settings.layers.walls
            ? walls.map((w) => (
                <text
                  key={w.t}
                  data-upright
                  x={cx + w.dx * wr}
                  y={-cy - w.dy * wr}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={0.15}
                  fontWeight={700}
                  fill="#172033"
                  fillOpacity={0.75}
                >
                  {w.t}
                </text>
              ))
            : null}
          {showPrints
            ? prints.map((g) => {
                const d = drag?.index === g.steps[0].index ? drag.p : g.pos;
                return (
                  <text
                    key={g.key}
                    data-upright
                    x={d[0] + shift[0]}
                    y={-(d[1] + shift[1]) + 0.005}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={labelSize(g.label, 0.135)}
                    fontWeight={800}
                    fill={g.anyStep ? '#172033' : FOOT_COLOR[g.foot]}
                  >
                    {g.label}
                  </text>
                );
              })
            : null}
          {quizSpots?.map((q, i) => (
            <text
              key={q.label}
              data-upright
              x={q.spot[0] + shift[0]}
              y={-(q.spot[1] + shift[1]) + 0.005}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={0.2}
              fontWeight={800}
              fill={correctSpot === i || pickedSpot === i ? '#ffffff' : '#172033'}
            >
              {q.label}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
}

function footPathToeOffset(unitM: number) {
  return 0.25 / unitM / 2 - 0.09;
}
