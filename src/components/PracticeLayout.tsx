'use client';
// 연습 화면의 뼈대 (설계문서 6.2): 좌 레슨 패널 / 중 3D 무대 / 우 발 위치도 · 상태 / 하단 카운트 바 · 트랜스포트.
// 폭이 좁으면(태블릿 세로 · 폰) 무대 → 카운트 바 → 트랜스포트 → 탭(레슨 / 발 위치도 / 보기) 순으로 쌓는다.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Highlight, Settings } from '@/engine/types';
import { FootMap, type FootMapProps } from '@/render2d/FootMap';
import { CountBar } from '@/render2d/CountBar';
import { useFrameBus } from '@/lib/frameBus';
import { player } from '@/lib/player';
import type { SessionControls } from '@/lib/session';
import { useMediaQuery, useShortcuts } from '@/lib/hooks';
import { useSettings } from '@/store/settings';
import { usePlayerState } from '@/lib/player';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { StageArea } from './StageArea';
import { StatusPanel } from './StatusPanel';
import { Transport } from './Transport';
import { ViewOptions, VIEW_OPTIONS } from './ViewOptions';

export interface PracticeLayoutProps {
  settings: Settings;
  controls: SessionControls;
  left?: ReactNode;
  leftLabel?: string;
  stageOverlay?: ReactNode;
  countPrefix?: ReactNode;
  mask?: boolean;
  highlight?: Highlight[];
  tempoSteps?: number[];
  speeds?: number[];
  mapProps?: Partial<FootMapProps>;
  belowStatus?: ReactNode;
  showWalls?: boolean;
  forceMapOnStage?: boolean;
  hideLoop?: boolean;
}

export function PracticeLayout(p: PracticeLayoutProps) {
  useFrameBus();
  const wide = useMediaQuery('(min-width: 1180px)');
  const [bigMap, setBigMap] = useState(false);
  const setSetting = useSettings((s) => s.set);
  const muted = usePlayerState((s) => s.muted);
  const { controls } = p;
  const handlers = useMemo(
    () => ({
      toggle: () => player.toggle(),
      stop: () => player.stop(),
      prev: () => player.stepPrev(),
      next: () => player.stepNext(),
      bpm: (d: number) => controls.setBpm(controls.bpm + d),
      loop: () => controls.setLoop(!controls.loop),
      view: (n: number) => setSetting('view', VIEW_OPTIONS[n - 1].value),
      mute: () => player.setMuted(!muted),
      bigMap: () => setBigMap((v) => !v),
      closeUp: () => setSetting('closeUp', !useSettings.getState().settings.closeUp),
    }),
    [controls, setSetting, muted],
  );
  useShortcuts(handlers);
  const onBigMap = useCallback((v: boolean) => setBigMap(v), []);

  const stage = (
    <StageArea
      settings={p.settings}
      mask={p.mask}
      highlight={p.highlight}
      overlay={p.stageOverlay}
      mapProps={p.mapProps}
      forceMap={p.forceMapOnStage}
      bigMap={bigMap}
      onBigMap={onBigMap}
    />
  );
  const bottom = (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-3">
      <CountBar settings={p.settings} mask={p.mask} emphasizeAnd={p.highlight?.includes('and')} prefix={p.countPrefix} />
      <Transport controls={controls} tempoSteps={p.tempoSteps} speeds={p.speeds} hideLoop={p.hideLoop} />
    </div>
  );
  const map = bigMap || p.forceMapOnStage ? null : <FootMap settings={p.settings} mask={p.mask} emphasizePath={p.highlight?.includes('path')} {...p.mapProps} />;
  const status = <StatusPanel settings={p.settings} mask={p.mask} highlight={p.highlight} showWalls={p.showWalls} />;

  if (wide) {
    return (
      <div className="grid grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(300px,340px)] gap-3">
        <aside className="flex max-h-[calc(100vh-150px)] min-h-0 flex-col overflow-y-auto rounded-[14px] border border-line bg-surface p-4" aria-label={p.leftLabel ?? '패널'}>
          {p.left}
        </aside>
        <div className="flex min-w-0 flex-col gap-3">
          {stage}
          {bottom}
        </div>
        <aside className="flex flex-col gap-3" aria-label="발 위치도와 상태">
          {map}
          {status}
          {p.belowStatus}
        </aside>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {stage}
      {bottom}
      <Tabs defaultValue={p.left ? 'left' : 'map'} className="rounded-[14px] border border-line bg-surface p-3">
        <TabsList>
          {p.left ? <TabsTrigger value="left">{p.leftLabel ?? '레슨'}</TabsTrigger> : null}
          <TabsTrigger value="map">발 위치도</TabsTrigger>
          <TabsTrigger value="view">보기</TabsTrigger>
        </TabsList>
        {p.left ? (
          <TabsContent value="left" className="pt-3">
            {p.left}
          </TabsContent>
        ) : null}
        <TabsContent value="map" className="flex flex-col gap-3 pt-3 sm:grid sm:grid-cols-2">
          {map ?? <p className="text-muted">무대에 발 위치도가 크게 보이고 있습니다.</p>}
          <div className="flex flex-col gap-3">
            {status}
            {p.belowStatus}
          </div>
        </TabsContent>
        <TabsContent value="view" className="pt-3">
          <ViewOptions />
        </TabsContent>
      </Tabs>
    </div>
  );
}
