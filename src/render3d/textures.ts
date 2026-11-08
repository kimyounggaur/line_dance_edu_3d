'use client';
// 3D 글자는 캔버스 텍스처로 그린다 (외부 글꼴 파일을 불러오지 않는다)
import * as THREE from 'three';

export const COLORS = {
  L: '#2563EB',
  R: '#EA580C',
  turn: '#7C3AED',
  pelvis: '#16A34A',
  ink: '#172033',
  floor: '#E5E8ED',
  grid: '#B3BBC7',
  mannequin: '#C8CDD6',
  mannequinDark: '#9EA5B2',
};

/** 마네킹 색 (8.6). 다리는 신발과 같은 계열 — 체중이 0이면 연하게(light), 다 실리면 진하게(full) */
export const BODY_COLORS = {
  skin: '#E1E4EA',
  hair: '#3A4354',
  shirtFront: '#B9C3D3',
  shirtBack: '#76839A',
  sleeve: '#8592A8',
  shorts: '#58637A',
  legLight: { L: '#C3D1F0', R: '#F3D3C1' },
  legFull: { L: '#5D84E2', R: '#EC8A55' },
  ghost: '#7A879C',
};

/** 가운데가 진하고 가장자리로 갈수록 사라지는 원 (접지 그림자) */
let blob: THREE.CanvasTexture | null = null;
export function blobTexture(): THREE.CanvasTexture {
  if (blob) return blob;
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  blob = new THREE.CanvasTexture(canvas);
  blob.colorSpace = THREE.SRGBColorSpace;
  return blob;
}

const cache = new Map<string, THREE.CanvasTexture>();

export interface TextOpts {
  color?: string;
  bg?: string | null;
  weight?: number;
  size?: number; // px (캔버스 안)
  padX?: number;
  padY?: number;
  radius?: number;
}

/** 글자 하나 또는 짧은 낱말을 텍스처로. 결과의 aspect = 가로 / 세로 */
export function textTexture(text: string, opts: TextOpts = {}): { tex: THREE.CanvasTexture; aspect: number } {
  const key = JSON.stringify([text, opts]);
  const hit = cache.get(key);
  if (hit) return { tex: hit, aspect: hit.image.width / hit.image.height };
  const size = opts.size ?? 96;
  const padX = opts.padX ?? size * 0.35;
  const padY = opts.padY ?? size * 0.22;
  const font = `${opts.weight ?? 700} ${size}px "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width + padX * 2);
  const h = Math.ceil(size * 1.25 + padY * 2);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (opts.bg) {
    const r = opts.radius ?? h * 0.22;
    ctx.fillStyle = opts.bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
  }
  ctx.font = font;
  ctx.fillStyle = opts.color ?? COLORS.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return { tex, aspect: w / h };
}

/** 둥근 사각형 발 모양 (가로 = 발 너비, 세로 = 발 길이, 단위 m). 위쪽(+y)이 발끝 */
export function footShape(len: number, wid: number, inset = 0): THREE.Shape {
  const l = len - inset * 2;
  const w = wid - inset * 2;
  const r = Math.min(w / 2, l * 0.28);
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -l / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + l - r);
  s.quadraticCurveTo(x0 + w, y0 + l, x0 + w - r, y0 + l);
  s.lineTo(x0 + r, y0 + l);
  s.quadraticCurveTo(x0, y0 + l, x0, y0 + l - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** 테두리만 있는 발 모양 (터치 · 홈 표시) */
export function footOutlineShape(len: number, wid: number, stroke: number): THREE.Shape {
  const outer = footShape(len, wid);
  const inner = footShape(len, wid, stroke);
  outer.holes.push(new THREE.Path(inner.getPoints(24).reverse()));
  return outer;
}
