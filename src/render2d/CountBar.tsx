'use client';
// 카운트 바 (설계문서 6.3): 한 칸 = 한 카운트. 번호 · 발 배지(L 파랑 / R 주황) · 구령 · ●디딤/○터치 · ↻회전.
// '&' 걸음이 있으면 좁은 '&' 칸. 현재 칸은 크게 · 테두리, 지나간 칸은 흐리게, 다음 칸은 점선. 1과 5는 굵게.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ResolvedStep, Settings } from '@/engine/types';
import { stepsInBlock } from '@/engine/track';
import { computeFrame, useFrameInfo } from '@/lib/frameBus';
import { player, restBeatOf } from '@/lib/player';
import { cn } from '@/lib/cn';

interface Cell {
  key: string;
  beat: number; // 블록 안의 박 (0 ~ 7.5)
  label: string;
  half: boolean;
  step: ResolvedStep | null;
}

export function FootBadge({ foot, className }: { foot: 'L' | 'R'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[1.5em] min-w-[1.5em] items-center justify-center rounded-[5px] px-1 text-[0.85em] font-extrabold leading-none text-white',
        foot === 'L' ? 'bg-foot-l' : 'bg-foot-r',
        className,
      )}
      aria-label={foot === 'L' ? '왼발' : '오른발'}
    >
      {foot}
    </span>
  );
}

export function CountBar({ settings, mask, emphasizeAnd, prefix }: { settings: Settings; mask?: boolean; emphasizeAnd?: boolean; prefix?: React.ReactNode }) {
  const info = useFrameInfo(useShallow((s) => ({ blockSeq: s.blockSeq, rep: s.rep, trackKey: s.trackKey, beatFloor: s.beatFloor, preparing: s.preparing })));
  const track = player.track;
  const cells = useMemo<Cell[]>(() => {
    if (!track) return [];
    const block = track.blocks[Math.min(info.blockSeq, track.blocks.length - 1)];
    const steps = stepsInBlock(track, block);
    const at = (b: number) => steps.find((s) => Math.abs(s.beat - block.startBeat - b) < 1e-6) ?? null;
    const out: Cell[] = [];
    for (let c = 0; c < 8; c++) {
      out.push({ key: `c${c}`, beat: c, label: String(c + 1), half: false, step: at(c) });
      const h = at(c + 0.5);
      if (h) out.push({ key: `h${c}`, beat: c + 0.5, label: '&', half: true, step: h });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, info.blockSeq, info.trackKey]);

  if (!track) return null;
  const f = computeFrame();
  const block = track.blocks[Math.min(info.blockSeq, track.blocks.length - 1)];
  const inBlock = f.local - block.startBeat;
  let current = -1;
  if (!info.preparing) {
    for (let i = 0; i < cells.length; i++) if (cells[i].beat <= inBlock + 1e-6) current = i;
  }
  const cueOf = (s: ResolvedStep) => (settings.cue === 'en' ? s.cueEn : settings.cue === 'ko' ? s.cueKo : '');

  return (
    <div className="scaled flex items-stretch gap-2">
      {prefix ? <div className="hidden shrink-0 flex-col justify-center pr-1 text-[13px] font-semibold leading-tight text-muted sm:flex">{prefix}</div> : null}
      <ol className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-1 pt-1.5" aria-label="카운트 바">
        {cells.map((c, i) => {
          const s = c.step;
          const state = i === current ? 'current' : i < current ? 'past' : i === current + 1 ? 'next' : 'later';
          const strong = !c.half && (c.label === '1' || c.label === '5');
          return (
            <li key={c.key} className={cn(c.half ? 'min-w-[30px] flex-[0.55]' : 'min-w-[44px] flex-1')}>
              <button
                type="button"
                disabled={!s}
                onClick={() => s && player.goTo(restBeatOf(track, s.index, info.rep), 0.5)}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={s ? `${c.half ? `${cells[i - 1]?.label ?? ''}&` : c.label}카운트 ${mask ? '' : `${s.foot === 'L' ? '왼발' : '오른발'} ${s.cueKo}`}` : `${c.label}카운트`}
                className={cn(
                  'flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-[9px] border px-0.5 py-1.5 text-center transition-[transform,opacity] duration-100',
                  c.half ? 'bg-[#e9ecf1]' : 'bg-surface',
                  state === 'current' && 'z-10 -translate-y-0.5 scale-[1.06] border-[3px] border-ink',
                  state === 'past' && 'border-line opacity-45',
                  state === 'next' && 'border-2 border-dashed border-ink/70',
                  state === 'later' && 'border-line',
                  emphasizeAnd && c.half && 'bg-turn-tint',
                )}
              >
                <span className={cn('font-display leading-none', c.half ? 'text-[20px] text-muted' : 'text-[26px]', strong ? 'text-ink' : 'text-ink-2')}>
                  {c.label}
                </span>
                {s && !mask ? (
                  <>
                    <span className="flex items-center gap-0.5">
                      <FootBadge foot={s.foot} className="text-[12px]" />
                      {s.turn !== 0 ? (
                        <span className="text-[14px] font-bold text-turn" aria-label="회전">
                          ↻
                        </span>
                      ) : null}
                    </span>
                    {settings.cue !== 'off' ? <span className="w-full truncate text-[13px] font-semibold leading-tight">{cueOf(s)}</span> : null}
                    <span className="text-[13px] leading-none" aria-label={s.action === 'step' ? '디딤' : '터치'}>
                      {s.action === 'step' ? '●' : '○'}
                    </span>
                  </>
                ) : (
                  <span className="text-[13px] text-muted">{s ? '?' : ''}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
