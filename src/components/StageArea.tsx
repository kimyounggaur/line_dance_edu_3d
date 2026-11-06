'use client';
// 무대: 3D(가능할 때) 또는 큰 발 위치도 + 큰 카운트 숫자 · 카운트인 표시 · 시점 바
import { Component, useState, type ReactNode } from 'react';
import { Map as MapIcon, Box, SlidersHorizontal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Highlight, Settings } from '@/engine/types';
import { Stage3D } from '@/platform';
import { FootMap, type FootMapProps } from '@/render2d/FootMap';
import { useFrameInfo } from '@/lib/frameBus';
import { usePlayerState } from '@/lib/player';
import { hasWebGL, useMounted } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/controls';
import { ViewOptions, ViewSwitcher } from './ViewOptions';

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
  const webgl = mounted && hasWebGL();
  const show3D = webgl && !bigMap && !forceMap;
  const mapView = <FootMap settings={settings} mask={mask} emphasizePath={highlight?.includes('path')} {...mapProps} className="h-full w-auto max-w-full rounded-none" />;
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface', className)}>
      <div className="relative aspect-[4/3] w-full bg-floor">
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
        {!webgl && mounted ? (
          <p className="absolute bottom-2 left-2 right-2 rounded-[8px] bg-surface/90 px-3 py-1.5 text-sm text-ink-2">
            이 기기에서는 3D를 쓸 수 없어 발 위치도로 보여 줍니다. 모든 레슨을 발 위치도만으로 할 수 있습니다.
          </p>
        ) : degraded && show3D ? (
          <p className="absolute bottom-2 left-2 right-2 rounded-[8px] bg-surface/90 px-3 py-1.5 text-sm text-ink-2">
            화면이 느려 그림자와 궤적선을 껐습니다. 계속 느리면 ‘발 위치도 크게’로 보세요.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-2">
        {show3D || (webgl && !forceMap) ? <ViewSwitcher /> : null}
        <div className="ml-auto flex items-center gap-1">
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
