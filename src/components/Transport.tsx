'use client';
// 트랜스포트 (설계문서 6.4): ▶/⏸ · ■ · ⟲ 루프 · ◁ ▷ 한 카운트씩 · 카운트인 · BPM · 템포 단계 · 0.5×
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented, Slider } from '@/components/ui/controls';
import { player, usePlayerState } from '@/lib/player';
import type { SessionControls } from '@/lib/session';
import { cn } from '@/lib/cn';
import { isIOS } from '@/lib/hooks';

export interface TransportProps {
  controls: SessionControls;
  tempoSteps?: number[];
  speeds?: number[]; // 기본 [1, 0.5]. 검수 모드는 [1, 0.5, 0.25]
  className?: string;
  hideLoop?: boolean;
}

export function Transport({ controls, tempoSteps, speeds = [1, 0.5], className, hideLoop }: TransportProps) {
  const status = usePlayerState((s) => s.status);
  const muted = usePlayerState((s) => s.muted);
  const audio = usePlayerState((s) => s.audio);
  const playing = status === 'playing';
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="lg"
          className="min-w-[124px]"
          onClick={() => player.toggle()}
          aria-label={playing ? '일시정지 (스페이스)' : '재생 (스페이스)'}
        >
          {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          {playing ? '일시정지' : status === 'paused' ? '이어서' : '재생'}
        </Button>
        <Button size="icon" onClick={() => player.stop()} aria-label="정지 — 준비 자세로 (Esc)" title="정지 (Esc)">
          <Square className="h-4 w-4" fill="currentColor" />
        </Button>
        <div className="flex items-center gap-1" role="group" aria-label="한 카운트씩">
          <Button size="icon" onClick={() => player.stepPrev()} aria-label="이전 카운트 (←)" title="이전 카운트 (←)">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button size="icon" onClick={() => player.stepNext()} aria-label="다음 카운트 (→)" title="다음 카운트 (→)">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {hideLoop ? null : (
          <Button variant="toggle" aria-pressed={controls.loop} onClick={() => controls.setLoop(!controls.loop)} title="루프 (L)">
            <Repeat className="h-4 w-4" />
            루프
          </Button>
        )}
        <Button size="icon" variant="ghost" aria-pressed={muted} onClick={() => player.setMuted(!muted)} aria-label={muted ? '소리 켜기 (M)' : '소리 끄기 (M)'} title="음소거 (M)">
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-2">카운트인</span>
          <Segmented
            label="카운트인"
            size="sm"
            value={controls.countIn}
            onChange={(v) => controls.setCountIn(v)}
            options={[
              { value: 0, label: '없음' },
              { value: 4, label: '4박' },
              { value: 8, label: '8박' },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-2">BPM</span>
          <input
            type="number"
            inputMode="numeric"
            min={40}
            max={160}
            value={controls.bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 40 && v <= 160) controls.setBpm(v);
            }}
            className="h-[var(--btn-h)] w-[4.5rem] rounded-[8px] border border-line bg-surface px-2 text-center text-lg font-bold"
            aria-label="BPM 숫자 입력"
          />
        </label>
        <Slider
          className="min-w-[140px] flex-1"
          min={60}
          max={140}
          step={1}
          value={[Math.min(140, Math.max(60, controls.bpm))]}
          onValueChange={(v) => controls.setBpm(v[0])}
          aria-label="BPM"
        />
        {tempoSteps?.length ? (
          <div className="flex items-center gap-1" role="group" aria-label="템포 단계">
            {tempoSteps.map((t) => (
              <Button key={t} size="sm" variant="toggle" aria-pressed={controls.bpm === t} onClick={() => controls.setBpm(t)}>
                {t}
              </Button>
            ))}
          </div>
        ) : null}
        {speeds.length > 1 ? (
          <Segmented
            label="배속"
            size="sm"
            value={controls.speed}
            onChange={(v) => controls.setSpeed(v)}
            options={speeds.map((s) => ({ value: s, label: s === 1 ? '1×' : `${s}×` }))}
          />
        ) : null}
        {controls.speed !== 1 ? <span className="text-sm text-muted">지금 {controls.effectiveBpm} BPM</span> : null}
      </div>
      {audio === 'blocked' || audio === 'unsupported' ? (
        <p className="rounded-[8px] bg-draft-tint px-3 py-2 text-sm text-[#7a4a00]" role="status">
          소리를 켤 수 없습니다. 화면의 카운트는 그대로 갑니다. {audio === 'blocked' ? '재생 버튼을 한 번 더 눌러 보세요.' : '이 브라우저는 Web Audio를 지원하지 않습니다.'}
        </p>
      ) : audio === 'running' && isIOS() ? (
        <p className="text-sm text-muted">아이폰 · 아이패드에서 소리가 안 들리면 옆의 무음 스위치를 확인하세요.</p>
      ) : null}
    </div>
  );
}
