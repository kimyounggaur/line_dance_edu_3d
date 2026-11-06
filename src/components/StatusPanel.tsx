'use client';
// 상태 표시 (6.2 오른쪽 패널): 체중 · 바라보는 벽 · 자리 이동 · 다음 걸음 · 벽 카운터 · 지금 카운트의 설명
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Highlight, Settings } from '@/engine/types';
import { worldToLocalVec } from '@/engine/geometry';
import { wallName } from '@/engine/quiz';
import { WallCompass, WeightBar } from '@/render2d/WeightBar';
import { FootBadge } from '@/render2d/CountBar';
import { useFrameCallback, useFrameInfo } from '@/lib/frameBus';
import { player, usePlayerState } from '@/lib/player';

function sideWords(dx: number, dy: number, U: number): string {
  const parts: string[] = [];
  const fmt = (v: number) => `${Math.abs(v).toFixed(1)}u(${Math.round(Math.abs(v) * U * 100)} cm)`;
  if (Math.abs(dx) >= 0.05) parts.push(`${dx > 0 ? '오른쪽' : '왼쪽'} ${fmt(dx)}`);
  if (Math.abs(dy) >= 0.05) parts.push(`${dy > 0 ? '앞' : '뒤'} ${fmt(dy)}`);
  return parts.length ? parts.join(', ') : '제자리';
}

export function StatusPanel({ settings, mask, highlight, showWalls }: { settings: Settings; mask?: boolean; highlight?: Highlight[]; showWalls?: boolean }) {
  const info = useFrameInfo(useShallow((s) => ({ stepIndex: s.stepIndex, wall: s.wall, blockSeq: s.blockSeq, trackKey: s.trackKey, preparing: s.preparing })));
  const status = usePlayerState((s) => s.status);
  const moveRef = useRef<HTMLSpanElement>(null);
  const track = player.track;
  useFrameCallback((f) => {
    const t = player.track;
    if (!t || !f.pose || !moveRef.current) return;
    const block = t.blocks[Math.min(f.block?.seq ?? 0, t.blocks.length - 1)];
    // 블록 시작 때의 골반 자리에서 얼마나 옮겨 갔는가 (블록 시작 방향 기준)
    const start = block.startState.pelvisS ?? [block.origin[0] - 0.14, block.origin[1]];
    const p = f.pose.pelvis.pos;
    const d = worldToLocalVec(block.heading, [p[0] - f.shift[0] - start[0], p[1] - f.shift[1] - start[1]]);
    const txt = sideWords(d[0], d[1], t.params.unitM);
    if (moveRef.current.textContent !== txt) moveRef.current.textContent = txt;
  }, []);
  if (!track) return null;
  const next = track.steps[info.stepIndex + 1] ?? null;
  const cur = info.stepIndex >= 0 ? track.steps[info.stepIndex] : null;
  const cue = (s: { cueKo: string; cueEn: string }) => (settings.cue === 'en' ? s.cueEn : s.cueKo);
  const closeN = track.closeN;
  const stepping = status === 'paused' || status === 'stepping';
  return (
    <div className="scaled flex flex-col gap-2 text-[15px]">
      <WeightBar emphasize={highlight?.includes('weight')} />
      <WallCompass emphasize={highlight?.includes('facing')} />
      {showWalls || closeN > 1 ? (
        <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-3 py-2">
          <span className="text-sm font-semibold text-ink-2">벽</span>
          <span className="font-display text-[22px] leading-none">
            {info.wall}/{closeN}
          </span>
          <span className="text-sm text-muted">시작 {wallName(track.blocks[Math.min(info.blockSeq, track.blocks.length - 1)].startState.heading)}</span>
        </div>
      ) : null}
      <div className="rounded-[10px] border border-line bg-surface px-3 py-2">
        <div className="text-sm font-semibold text-ink-2">자리 (블록 시작부터)</div>
        <span ref={moveRef} className="font-semibold">
          제자리
        </span>
      </div>
      <div className="rounded-[10px] border border-line bg-surface px-3 py-2" aria-live="off">
        <div className="text-sm font-semibold text-ink-2">다음</div>
        {mask ? (
          <span className="text-muted">퀴즈 중에는 숨깁니다</span>
        ) : next ? (
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="font-display text-[22px] leading-none">{next.count}</span>
            <FootBadge foot={next.foot} />
            <span>{next.foot === 'L' ? '왼발' : '오른발'}</span>
            <span className="text-ink-2">{cue(next)}</span>
            {next.action === 'touch' ? <span className="text-sm text-muted">터치 ○</span> : <span className="text-sm text-muted">디딤 ●</span>}
            {next.turn !== 0 ? <span className="text-sm font-bold text-turn">↻ 1/4 {next.turn > 0 ? '오른쪽' : '왼쪽'}</span> : null}
          </div>
        ) : (
          <span className="text-muted">끝</span>
        )}
      </div>
      {cur && stepping && !mask && !info.preparing ? (
        <p className="rounded-[10px] bg-ink px-3 py-2 font-semibold text-white" aria-live="polite">
          {cur.count}카운트: {cur.desc}
        </p>
      ) : null}
    </div>
  );
}
