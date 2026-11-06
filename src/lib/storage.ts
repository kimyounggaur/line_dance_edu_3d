// localStorage 래퍼 (설계문서 7.8). 저장소를 쓸 수 없는 환경(사생활 보호 모드 · 샌드박스)에서는 메모리에만 둔다.
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.localStorage;
    const k = '__ld_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

let cached: Storage | null | undefined;
function store(): Storage | null {
  if (cached === undefined) cached = ls();
  return cached;
}

export const KEYS = {
  settings: 'ld.settings.v1',
  progress: 'ld.progress.v1',
  review: 'ld.review.v1',
  last: 'ld.last.v1',
} as const;

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(key) ?? memory.get(key) ?? null;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    store()?.setItem(key, raw);
  } catch {
    /* 용량 초과 · 차단 — 메모리 사본만 유지 */
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  try {
    store()?.removeItem(key);
  } catch {
    /* 무시 */
  }
}

export function storageAvailable(): boolean {
  return store() !== null;
}
