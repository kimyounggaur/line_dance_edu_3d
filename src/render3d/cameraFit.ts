// 카메라 구도 (설계문서 8.10 표 + 화면 크기 맞춤). three.js 없이 거리 · 높이만 계산한다.
// 큰 무대(높이 520px 이상)는 설계값 그대로 4.2 m. 폰처럼 작은 무대(300px 이하)는 3.4 m까지 당겨 아바타를 크게 보인다.
// 무대가 세로로 길면 발자국이 퍼지는 폭(2.2 m)이 가로로 다 들어오도록 물러난다.
import type { ViewMode } from '@/engine/types';

export const FOV_DEG = 40;
const TAN = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);

export interface CamSpec {
  dist: number; // target에서 카메라까지 수평 거리 (m)
  height: number; // 카메라 높이 (m)
  lookH: number; // 바라보는 높이 (m)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 가로 폭 w(m)가 다 보이는 최소 거리 */
function distForWidth(w: number, aspect: number): number {
  return w / (2 * TAN * aspect);
}

export function presetCamera(view: Exclude<ViewMode, 'top' | 'free'>, closeUp: boolean, widthPx: number, heightPx: number): CamSpec {
  const aspect = widthPx > 0 && heightPx > 0 ? widthPx / heightPx : 4 / 3;
  if (closeUp) {
    // 발 확대: 낮은 자리에서 발목 높이를 본다. 발 둘레 1.5 m는 가로로 들어오게
    const dist = Math.max(2.1, distForWidth(1.5, aspect));
    return view === 'side' ? { dist, height: 0.6, lookH: 0.25 } : { dist, height: 0.95, lookH: 0.22 };
  }
  const t = clamp01((heightPx - 300) / (520 - 300));
  const base = 3.4 + (4.2 - 3.4) * t;
  const dist = Math.min(5.5, Math.max(base, distForWidth(2.2, aspect)));
  return view === 'side' ? { dist, height: 1.2, lookH: 0.8 } : { dist, height: 1.7, lookH: 0.8 };
}

/** 위에서 보기(직교)에서 화면의 짧은 변에 들어오는 바닥 길이 (m) */
export function topSpan(closeUp: boolean): number {
  return closeUp ? 1.9 : 3.2;
}
