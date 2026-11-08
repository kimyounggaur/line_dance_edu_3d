// 표시 묶음 (설계문서 6.5): 표시 요소 일곱 가지를 상황에 맞게 한 번에 고른다. 세부 토글은 '직접 고르기'에 접어 둔다.
import type { Settings } from '@/engine/types';

export type Layers = Settings['layers'];
export type LayerPresetId = 'learn' | 'practice' | 'clean';

export interface LayerPreset {
  id: LayerPresetId;
  label: string;
  hint: string;
  layers: Layers;
}

export const LAYER_PRESETS: LayerPreset[] = [
  {
    id: 'learn',
    label: '처음 배울 때',
    hint: '발자국 · 이동 화살표 · 체중 원 · 골반 · 방향을 모두 봅니다.',
    layers: { footprints: 'block', arrows: true, weight: true, pelvis: true, facing: true, walls: true, grid: true },
  },
  {
    id: 'practice',
    label: '익숙해질 때',
    hint: '다음 2걸음과 체중 원 · 방향 화살표만 봅니다.',
    layers: { footprints: 'next2', arrows: false, weight: true, pelvis: false, facing: true, walls: true, grid: true },
  },
  {
    id: 'clean',
    label: '깔끔하게',
    hint: '아바타와 벽 라벨만 남깁니다. 외워서 따라 할 때 씁니다.',
    layers: { footprints: 'off', arrows: false, weight: false, pelvis: false, facing: false, walls: true, grid: false },
  },
];

const KEYS = Object.keys(LAYER_PRESETS[0].layers) as (keyof Layers)[];

/** 지금 표시 요소가 어느 묶음과 똑같은가 (직접 바꿨으면 null) */
export function matchLayerPreset(layers: Layers): LayerPresetId | null {
  for (const p of LAYER_PRESETS) if (KEYS.every((k) => layers[k] === p.layers[k])) return p.id;
  return null;
}

export function presetLayers(id: LayerPresetId): Layers {
  const p = LAYER_PRESETS.find((x) => x.id === id) ?? LAYER_PRESETS[0];
  return { ...p.layers };
}
