'use client';
// 무대: 3D(가능할 때) 또는 큰 발 위치도 + 큰 카운트 숫자 · 카운트인 표시 · 시점 바.
// 3D 무대를 좌우로 끌면 박을 앞뒤로 옮겨 동작을 훑어본다(무대 폭 = 8박). 재생 중이면 멈춘다. 자유 시점 · 퀴즈 중에는 끄지 않는다.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Map as MapIcon, Box, SlidersHorizontal, ZoomIn, MoveHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Highlight, Settings } from '@/engine/types';
import { Stage3D } from '@/platform';
import { FootMap, type FootMapProps } from '@/render2d/FootMap';
import { useFrameInfo } from '@/lib/frameBus';
import { player, usePlayerState } from '@/lib/player';
import { hasWebGL, useMounted } from '@/lib/hooks';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { useSettings } from '@/store/settings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/controls';
import { ViewOptions, ViewSwitcher } from './ViewOptions';

/** 무대 폭만큼 끌면 몇 박을 옮기는가 */
export const SCRUB_BEATS_PER_WIDTH = 8;

class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('3D 무대를 그리지 못해 발 위치도로 바꿉니다', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function BigCount() {
  const info = useFrameInfo(useShallow((s) => ({ display: s.display, preparing: s.preparing })));
  const status = usePlayerState((s) => s.status);
  const label = status === 'stopped' ? '준비' : info.display;
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex items-baseline gap-2" aria-live="off">
      <span
        className={cn(
          'font-display leading-none text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]',
          status === 'stopped' ? 'text-[34px]' : 'text-[calc(64px*var(--ui-scale))]',
          info.preparing && status !== 'stopped' && 'text-muted',
        )}
      >
        {label}
      </span>
      {info.preparing && status === 'playing' ? <span className="text-sm font-semibold text-muted">카운트인</span> : null}
    </div>
  );
}

function CountIn() {
  const info = useFrameInfo(useShallow((s) => ({ preparing: s.preparing, preRoll: s.preRoll, countNum: s.countNum, half: s.half })));
  const status = usePlayerState((s) => s.status);
  if (!info.preparing || info.preRoll || status !== 'playing' || info.half) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span key={info.countNum} className="ld-pop font-display text-[clamp(96px,22vw,200px)] leading-none text-ink/80">
        {info.countNum}
      </span>
    </div>
  );
}

interface ScrubState {
  id: number;
  x0: number;
  y0: number;
  b0: number;
  w: number;
  on: boolean;
}

/** 무대 끌기: 가로로 6px 넘게 움직이면 시작한다. 세로로 밀면 화면 스크롤에 양보한다 */
function useScrub(enabled: boolean, onFirstUse: () => void) {
  const ref = useRef<ScrubState | null>(null);
  const [active, setActive] = useState(false);
  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (!enabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest('button,a,input,[role="dialog"]')) return;
      ref.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, b0: 0, w: e.currentTarget.getBoundingClientRect().width || 1, on: false };
    },
    onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      const s = ref.current;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0;
      if (!s.on) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - s.y0)) return;
        s.on = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 이미 놓았으면 무시 */
        }
        const st = player.state.status;
        if (st === 'playing' || st === 'stepping') player.pause();
        s.b0 = player.beat();
        s.x0 = e.clientX;
        setActive(true);
        return;
      }
      player.goTo(s.b0 + (dx / s.w) * SCRUB_BEATS_PER_WIDTH, 0);
    },
    onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      const s = ref.current;
      if (!s || e.pointerId !== s.id) return;
      ref.current = null;
      if (s.on) {
        setActive(false);
        onFirstUse();
      }
    },
    onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
      if (ref.current?.id !== e.pointerId) return;
      if (ref.current.on) setActive(false);
      ref.current = null;
    },
  };
  return { handlers, active };
}

function useHint(name: string): [boolean, () => void] {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    setSeen(!!loadJSON<Record<string, boolean>>(KEYS.hints, {})[name]);
  }, [name]);
  const done = () => {
    if (seen) return;
    setSeen(true);
    saveJSON(KEYS.hints, { ...loadJSON<Record<string, boolean>>(KEYS.hints, {}), [name]: true });
  };
  return [seen, done];
}

export interface StageAreaProps {
  settings: Settings;
  mask?: boolean;
  highlight?: Highlight[];
  overlay?: ReactNode;
  mapProps?: Partial<FootMapProps>;
  forceMap?: boolean;
  bigMap: boolean;
  onBigMap(v: boolean): void;
  className?: string;
}

export function StageArea({ settings, mask, highlight, overlay, mapProps, forceMap, bigMap, onBigMap, className }: StageAreaProps) {
  const mounted = useMounted();
  const [degraded, setDegraded] = useState(false);
  const setSetting = useSettings((s) => s.set);
  const status = usePlayerState((s) => s.status);
  const webgl = mounted && hasWebGL();
  const show3D = webgl && !bigMap && !forceMap;
  const canScrub = show3D && settings.view !== 'free' && !mask;
  const [hintSeen, hintDone] = useHint('scrub');
  const { handlers, active } = useScrub(canScrub, hintDone);
  const notice = !webgl && mounted ? 'no3d' : degraded && show3D ? 'slow' : null;
  const mapView = <FootMap settings={settings} mask={mask} emphasizePath={highlight?.includes('path')} {...mapProps} className="h-full w-auto max-w-full rounded-none" />;
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface', className)}>
      <div
        className={cn('relative aspect-[4/3] w-full bg-floor', canScrub && 'cursor-grab touch-pan-y select-none', active && 'cursor-grabbing')}
        {...(canScrub ? handlers : {})}
      >
        {mounted ? (
          show3D ? (
            <StageBoundary fallback={<div className="flex h-full items-center justify-center">{mapView}</div>}>
              <Stage3D settings={settings} mask={mask} highlight={highlight} onDegrade={() => setDegraded(true)} />
            </StageBoundary>
          ) : (
            <div className="flex h-full w-full items-center justify-center">{mapView}</div>
          )
        ) : null}
        <BigCount />
        <CountIn />
        {overlay}
        {canScrub && !hintSeen && !notice && status !== 'playing' ? (
          <p className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-surface/85 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2">
            <MoveHorizontal className="h-3.5 w-3.5" aria-hidden />
            좌우로 끌어 동작 훑어보기
          </p>
        ) : null}
        {notice === 'no3d' ? (
          <p className="absolute bottom-2 left-2 right-2 rounded-[8px] bg-surface/90 px-3 py-1.5 text-sm text-ink-2">
            이 기기에서는 3D를 쓸 수 없어 발 위치도로 보여 줍니다. 모든 레슨을 발 위치도만으로 할 수 있습니다.
          </p>
        ) : notice === 'slow' ? (
          <p className="absolute bottom-2 left-2 right-2 rounded-[8px] bg-surface/90 px-3 py-1.5 text-sm text-ink-2">
            화면이 느려 그림자와 궤적선을 껐습니다. 계속 느리면 ‘발 위치도 크게’로 보세요.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-2">
        {show3D || (webgl && !forceMap) ? <ViewSwitcher /> : null}
        <div className="ml-auto flex items-center gap-1">
          {show3D && settings.view !== 'free' ? (
            <Button size="sm" variant="toggle" aria-pressed={settings.closeUp} onClick={() => setSetting('closeUp', !settings.closeUp)} title="발 확대 (Z)">
              <ZoomIn className="h-4 w-4" />
              발 확대
            </Button>
          ) : null}
          {webgl && !forceMap ? (
            <Button size="sm" variant="toggle" aria-pressed={bigMap} onClick={() => onBigMap(!bigMap)} title="발 위치도 크게 (F)">
              {bigMap ? <Box className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
              {bigMap ? '3D 보기' : '발 위치도 크게'}
            </Button>
          ) : null}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="quiet">
                <SlidersHorizontal className="h-4 w-4" />
                표시
              </Button>
            </DialogTrigger>
            <DialogContent title="보기 옵션" className="max-h-[86vh] overflow-y-auto">
              <ViewOptions />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
