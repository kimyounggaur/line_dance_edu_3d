'use client';
// 설정 스토어 (설계문서 6.5 · 7.8). 키 ld.settings.v1
import { create } from 'zustand';
import type { Settings } from '@/engine/types';
import { DEFAULT_UNIT_M, UNIT_RANGE } from '@/engine/constants';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';

export const DEFAULT_SETTINGS: Settings = {
  view: 'behind',
  followPos: false,
  followFacing: true,
  avatar: 'full',
  layers: { footprints: 'block', arrows: true, weight: true, pelvis: true, facing: true, walls: true, grid: true },
  startFoot: 'R',
  mapUp: 'facing',
  cue: 'ko',
  click: 'on',
  largeText: false,
  unitM: DEFAULT_UNIT_M,
  audioOffsetMs: 0,
  arms: 'swing',
  closeUp: false,
  ghost: 'paused',
};

const GHOST_MODES: Settings['ghost'][] = ['paused', 'always', 'off'];

export function sanitize(s: Partial<Settings>): Settings {
  const merged: Settings = { ...DEFAULT_SETTINGS, ...s, layers: { ...DEFAULT_SETTINGS.layers, ...(s.layers ?? {}) } };
  if (!(merged.unitM >= UNIT_RANGE[0] && merged.unitM <= UNIT_RANGE[1])) merged.unitM = DEFAULT_UNIT_M;
  if (!Number.isFinite(merged.audioOffsetMs)) merged.audioOffsetMs = 0;
  if (!GHOST_MODES.includes(merged.ghost)) merged.ghost = DEFAULT_SETTINGS.ghost;
  merged.closeUp = merged.closeUp === true;
  return merged;
}

interface SettingsStore {
  settings: Settings;
  hydrated: boolean;
  hydrate(): void;
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  setLayer<K extends keyof Settings['layers']>(key: K, value: Settings['layers'][K]): void;
  reset(): void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    set({ settings: sanitize(loadJSON<Partial<Settings>>(KEYS.settings, {})), hydrated: true });
  },
  set(key, value) {
    const settings = { ...get().settings, [key]: value };
    saveJSON(KEYS.settings, settings);
    set({ settings });
  },
  setLayer(key, value) {
    const settings = { ...get().settings, layers: { ...get().settings.layers, [key]: value } };
    saveJSON(KEYS.settings, settings);
    set({ settings });
  },
  reset() {
    saveJSON(KEYS.settings, DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

/** 연습 하나에서만 바꾸는 보기 옵션(Exercise.view)을 겹친 값 */
export function effectiveSettings(base: Settings, override?: Partial<Settings> | null): Settings {
  if (!override) return base;
  return { ...base, ...override, layers: { ...base.layers, ...(override.layers ?? {}) } };
}
