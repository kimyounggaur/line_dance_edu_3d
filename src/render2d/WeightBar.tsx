'use client';
// 체중 막대 L ↔ R 과 방향 표시 (6.2의 상태 표시). 매 프레임 DOM만 직접 바꾼다.
import { useRef } from 'react';
import { useFrameCallback } from '@/lib/frameBus';
import { wallName } from '@/engine/quiz';
import { cn } from '@/lib/cn';

export function WeightBar({ emphasize }: { emphasize?: boolean }) {
  const fillL = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useFrameCallback((f) => {
    if (!f.pose) return;
    const w = f.pose.weightR;
    if (fillL.current) fillL.current.style.width = `${((1 - w) * 100).toFixed(1)}%`;
    if (marker.current) marker.current.style.left = `${(w * 100).toFixed(1)}%`;
    if (text.current) {
      const t = w > 0.85 ? '오른발' : w < 0.15 ? '왼발' : w > 0.5 ? '오른발 쪽으로' : '왼발 쪽으로';
      if (text.current.textContent !== t) text.current.textContent = t;
    }
  }, []);
  return (
    <div className={cn('rounded-[10px] border border-line bg-surface p-3', emphasize && 'border-2 border-ink')}>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink-2">체중</span>
        <span ref={text} className="font-bold" aria-live="off">
          왼발
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-display text-xl leading-none text-foot-l">L</span>
        <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-foot-r/80" role="img" aria-label="왼발과 오른발에 실린 체중">
          <div ref={fillL} className="absolute inset-y-0 left-0 bg-foot-l/80" style={{ width: '100%' }} />
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/80" />
          <div ref={marker} className="absolute top-1/2 h-7 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink" style={{ left: '0%' }} />
        </div>
        <span className="font-display text-xl leading-none text-foot-r">R</span>
      </div>
    </div>
  );
}

export function WallCompass({ emphasize }: { emphasize?: boolean }) {
  const arrow = useRef<SVGGElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useFrameCallback((f) => {
    if (!f.pose) return;
    arrow.current?.setAttribute('transform', `rotate(${f.pose.heading.toFixed(1)} 20 20)`);
    if (text.current) {
      const t = wallName(f.pose.heading);
      if (text.current.textContent !== t) text.current.textContent = t;
    }
  }, []);
  return (
    <div className={cn('flex items-center gap-3 rounded-[10px] border border-line bg-surface p-3', emphasize && 'border-2 border-ink')}>
      <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0" aria-hidden>
        <circle cx="20" cy="20" r="18" fill="none" stroke="#D3D8E0" strokeWidth="2" />
        <text x="20" y="7.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="#586276">
          12
        </text>
        <g ref={arrow}>
          <path d="M20 6 L27 22 L20 18.5 L13 22 Z" fill="#172033" />
        </g>
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-ink-2">바라보는 벽</div>
        <span ref={text} className="font-display text-[26px] leading-none">
          12시
        </span>
      </div>
    </div>
  );
}
