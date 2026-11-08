'use client';
// 보기 옵션 (설계문서 6.5). 표시 요소는 '표시 묶음' 셋 중 하나로 한 번에 고르고, 세부 토글은 '직접 고르기'에 접어 둔다.
import { ChevronDown } from 'lucide-react';
import type { Settings, ViewMode } from '@/engine/types';
import { useSettings } from '@/store/settings';
import { LAYER_PRESETS, matchLayerPreset, presetLayers, type LayerPresetId } from '@/lib/viewPresets';
import { Field, Segmented, Switch } from '@/components/ui/controls';

export const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'behind', label: '뒤에서' },
  { value: 'mirror', label: '거울' },
  { value: 'top', label: '위에서' },
  { value: 'side', label: '옆에서' },
  { value: 'free', label: '자유' },
];

export function ViewSwitcher({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const view = useSettings((s) => s.settings.view);
  const set = useSettings((s) => s.set);
  return <Segmented label="시점" size={size} value={view} onChange={(v) => set('view', v)} options={VIEW_OPTIONS.map((o, i) => ({ ...o, title: `${o.label} (${i + 1})` }))} />;
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-[var(--btn-h)] cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function ViewOptions({ showStartFoot = true }: { showStartFoot?: boolean }) {
  const s = useSettings((st) => st.settings);
  const set = useSettings((st) => st.set);
  const setLayer = useSettings((st) => st.setLayer);
  const L = s.layers;
  const preset = matchLayerPreset(L);
  const presetInfo = LAYER_PRESETS.find((p) => p.id === preset);
  const layer = (k: keyof Settings['layers'], label: string) => <Toggle label={label} checked={L[k] as boolean} onChange={(v) => setLayer(k, v as never)} />;
  return (
    <div className="flex flex-col gap-5">
      <Field label="시점" hint={s.view === 'mirror' ? '거울: 화면 오른쪽의 주황 R 발이 움직이면 내 오른발을 움직입니다.' : s.view === 'behind' ? '뒤에서: 내 좌우 = 아바타의 좌우. 그대로 따라 하면 됩니다.' : undefined}>
        <ViewSwitcher size="md" />
      </Field>
      <div>
        <span className="text-sm font-semibold text-ink-2">카메라</span>
        <Toggle label="발 확대" checked={s.closeUp} onChange={(v) => set('closeUp', v)} hint="카메라를 낮추고 가까이 가져가 발을 크게 봅니다 (Z)" />
        <Toggle label="위치 따라가기" checked={s.followPos} onChange={(v) => set('followPos', v)} hint="아바타가 옮겨 가는 대로 카메라도 따라갑니다" />
        <Toggle label="방향 따라가기" checked={s.followFacing} onChange={(v) => set('followFacing', v)} hint="끄면 벽이 바뀌는 것을 교실에 서서 보듯 볼 수 있습니다" />
      </div>
      <Field label="표시 묶음" hint={presetInfo ? presetInfo.hint : '표시 요소를 직접 고른 상태입니다.'}>
        <Segmented<LayerPresetId | ''>
          label="표시 묶음"
          value={preset ?? ''}
          onChange={(v) => {
            if (v) set('layers', presetLayers(v));
          }}
          options={LAYER_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </Field>
      <details className="group rounded-[10px] border border-line px-3 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex min-h-[var(--btn-h)] cursor-pointer list-none items-center justify-between gap-2 font-semibold">
          표시 요소 직접 고르기
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="flex flex-col gap-4 pb-3">
          <Field label="발자국 범위">
            <Segmented
              label="발자국 범위"
              value={L.footprints}
              onChange={(v) => setLayer('footprints', v)}
              options={[
                { value: 'block', label: '블록 전체' },
                { value: 'next2', label: '다음 2걸음' },
                { value: 'off', label: '끔' },
              ]}
            />
          </Field>
          <div>
            {layer('arrows', '이동 화살표')}
            {layer('weight', '체중 원')}
            {layer('pelvis', '골반 점 · 궤적')}
            {layer('facing', '방향 화살표')}
            {layer('walls', '벽 라벨')}
            {layer('grid', '격자')}
          </div>
        </div>
      </details>
      <Field label="아바타 표시">
        <Segmented
          label="아바타 표시"
          value={s.avatar}
          onChange={(v) => set('avatar', v)}
          options={[
            { value: 'full', label: '전신' },
            { value: 'legs', label: '하체 강조' },
            { value: 'shoes', label: '신발만' },
          ]}
        />
      </Field>
      <Field label="다음 자세 미리 보기" hint="반투명한 다리 · 신발이 다음 카운트의 자세(▷를 누르면 갈 자리)를 보여 줍니다. 퀴즈 중에는 보이지 않습니다.">
        <Segmented
          label="다음 자세 미리 보기"
          value={s.ghost}
          onChange={(v) => set('ghost', v)}
          options={[
            { value: 'paused', label: '멈췄을 때' },
            { value: 'always', label: '항상' },
            { value: 'off', label: '끔' },
          ]}
        />
      </Field>
      {showStartFoot ? (
        <Field label="시작 발" hint="왼발: 블록 전체를 좌우 반전합니다">
          <Segmented
            label="시작 발"
            value={s.startFoot}
            onChange={(v) => set('startFoot', v)}
            options={[
              { value: 'R', label: '오른발' },
              { value: 'L', label: '왼발' },
            ]}
          />
        </Field>
      ) : null}
      <Field label="발 위치도 방향">
        <Segmented
          label="발 위치도 방향"
          value={s.mapUp}
          onChange={(v) => set('mapUp', v)}
          options={[
            { value: 'facing', label: '몸 방향이 위' },
            { value: 'wall12', label: '12시가 위' },
          ]}
        />
      </Field>
      <Field label="구령 표기">
        <Segmented
          label="구령 표기"
          value={s.cue}
          onChange={(v) => set('cue', v)}
          options={[
            { value: 'ko', label: '한국어' },
            { value: 'en', label: '영어식' },
            { value: 'off', label: '숨김' },
          ]}
        />
      </Field>
      <Field label="클릭음" hint="꺼도 화면의 카운트는 계속 갑니다">
        <Segmented
          label="클릭음"
          value={s.click}
          onChange={(v) => set('click', v)}
          options={[
            { value: 'on', label: '켬' },
            { value: 'noAnd', label: "'&'만 끔" },
            { value: 'off', label: '끔' },
          ]}
        />
      </Field>
      <Toggle label="큰 글씨" checked={s.largeText} onChange={(v) => set('largeText', v)} hint="카운트 바 · 상태 글자 1.4배, 버튼 높이 56px" />
    </div>
  );
}
