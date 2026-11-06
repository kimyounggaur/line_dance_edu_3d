'use client';
import { useEffect, useState } from 'react';

export function useMediaQuery(q: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia(q);
    const fn = () => setOn(m.matches);
    fn();
    m.addEventListener?.('change', fn);
    return () => m.removeEventListener?.('change', fn);
  }, [q]);
  return on;
}

export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

let webglCache: boolean | null = null;
/** 3D를 쓸 수 있는 기기인가 */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export interface ShortcutHandlers {
  toggle?(): void;
  stop?(): void;
  prev?(): void;
  next?(): void;
  bpm?(delta: number): void;
  loop?(): void;
  view?(n: number): void;
  mute?(): void;
  bigMap?(): void;
}

/** 6.8 키보드 단축키: Space · Esc · ←/→ · ↑/↓ · L · 1~5 · M · F */
export function useShortcuts(h: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
        if (t.closest('[role="slider"],[role="radiogroup"],[role="tablist"],[role="dialog"]')) {
          if (e.key.startsWith('Arrow')) return;
        }
      }
      const k = e.key;
      if (k === ' ' || k === 'Spacebar') {
        if (t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return; // 버튼 위의 스페이스는 그 버튼을 누른다
        e.preventDefault();
        h.toggle?.();
      } else if (k === 'Escape') h.stop?.();
      else if (k === 'ArrowLeft') {
        e.preventDefault();
        h.prev?.();
      } else if (k === 'ArrowRight') {
        e.preventDefault();
        h.next?.();
      } else if (k === 'ArrowUp') {
        e.preventDefault();
        h.bpm?.(4);
      } else if (k === 'ArrowDown') {
        e.preventDefault();
        h.bpm?.(-4);
      } else if (k === 'l' || k === 'L') h.loop?.();
      else if (k === 'm' || k === 'M') h.mute?.();
      else if (k === 'f' || k === 'F') h.bigMap?.();
      else if (/^[1-5]$/.test(k)) h.view?.(Number(k));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h, enabled]);
}
