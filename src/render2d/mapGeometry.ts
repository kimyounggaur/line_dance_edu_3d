// 2D 발 위치도의 기하 (설계문서 7.1의 SVG 변환 sx = x, sy = −y, 8.9). React 없이 쓸 수 있어 스크립트도 같이 쓴다.
import type { Foot, ResolvedStep, Vec2 } from '@/engine/types';
import { BODY, HOME } from '@/engine/constants';
import { localToWorld } from '@/engine/geometry';
import type { BlockInstance } from '@/engine/compose';

export const FOOT_COLOR: Record<Foot, string> = { L: '#2563EB', R: '#EA580C' };

export interface MapFrame {
  cx: number;
  cy: number;
  r: number; // 보이는 범위의 반지름 (u) — 회전해도 잘리지 않게 원으로 잡는다
}

/** 블록의 모든 착지 자리 + 홈을 감싸는 범위 + 여백 0.8u */
export function blockFrame(steps: ResolvedStep[], block: Pick<BlockInstance, 'origin' | 'heading'>, unitM: number, margin = 0.8): MapFrame {
  const pts: Vec2[] = steps.map((s) => s.to);
  for (const f of ['L', 'R'] as Foot[]) pts.push(localToWorld(block.origin, block.heading, HOME[f]));
  if (!pts.length) pts.push(block.origin);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = BODY.footLen / unitM / 2;
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
  return { cx, cy, r: Math.max(1.2, r + half + margin) };
}

export function footDimsU(unitM: number) {
  return { len: BODY.footLen / unitM, wid: BODY.footWid / unitM };
}

/** 원점에 놓인 발 모양 경로 (SVG 좌표, 위 = 발끝) */
export function footPathD(unitM: number, inset = 0): string {
  const { len, wid } = footDimsU(unitM);
  const l = len - inset * 2;
  const w = wid - inset * 2;
  const r = Math.min(w / 2, l * 0.3);
  const x0 = -w / 2;
  const y0 = -l / 2;
  return [
    `M ${x0 + r} ${y0}`,
    `L ${x0 + w - r} ${y0}`,
    `Q ${x0 + w} ${y0} ${x0 + w} ${y0 + r}`,
    `L ${x0 + w} ${y0 + l - r}`,
    `Q ${x0 + w} ${y0 + l} ${x0 + w - r} ${y0 + l}`,
    `L ${x0 + r} ${y0 + l}`,
    `Q ${x0} ${y0 + l} ${x0} ${y0 + l - r}`,
    `L ${x0} ${y0 + r}`,
    `Q ${x0} ${y0} ${x0 + r} ${y0}`,
    'Z',
  ].join(' ');
}

export const sx = (p: Vec2) => p[0];
export const sy = (p: Vec2) => -p[1];

/** 발 모양을 자리 · 발끝 방향에 놓는 SVG transform */
export function footTransform(p: Vec2, yaw: number): string {
  return `translate(${p[0].toFixed(4)} ${(-p[1]).toFixed(4)}) rotate(${yaw.toFixed(2)})`;
}

/** 다음 걸음 경로 (2차 베지어) */
export function stepPathD(s: ResolvedStep, shift: Vec2 = [0, 0]): string {
  const a: Vec2 = [s.from[0] + shift[0], s.from[1] + shift[1]];
  const c: Vec2 = [s.ctrl[0] + shift[0], s.ctrl[1] + shift[1]];
  const b: Vec2 = [s.to[0] + shift[0], s.to[1] + shift[1]];
  return `M ${sx(a)} ${sy(a)} Q ${sx(c)} ${sy(c)} ${sx(b)} ${sy(b)}`;
}

export function footLabel(s: ResolvedStep): string {
  return `${s.foot}${s.count}`;
}

export interface FootprintGroup {
  key: string;
  foot: Foot;
  pos: Vec2;
  yaw: number;
  steps: ResolvedStep[];
  anyStep: boolean;
  label: string;
}

/** 같은 발 · 같은 자리의 발자국을 묶는다: 'R1,5' (대문자 = 디딤), 'l2,6' (소문자 = 터치) — 5.3 글자 그림과 같은 표기 */
export function groupFootprints(steps: ResolvedStep[]): FootprintGroup[] {
  const groups: FootprintGroup[] = [];
  for (const s of steps) {
    const g = groups.find((q) => q.foot === s.foot && Math.hypot(q.pos[0] - s.to[0], q.pos[1] - s.to[1]) < 0.02 && Math.abs(((q.yaw - s.yawTo + 540) % 360) - 180) < 1);
    if (g) {
      g.steps.push(s);
      g.anyStep = g.anyStep || s.action === 'step';
    } else groups.push({ key: String(s.index), foot: s.foot, pos: s.to, yaw: s.yawTo, steps: [s], anyStep: s.action === 'step', label: '' });
  }
  for (const g of groups) g.label = `${g.anyStep ? g.foot : g.foot.toLowerCase()}${g.steps.map((x) => x.count).join(',')}`;
  return groups;
}

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 발자국 글자 크기 (u): 글자가 길면 발 너비 안에 들어가게 줄인다 */
export function labelSize(label: string, base = 0.14): number {
  return Math.min(base, 0.64 / Math.max(1, label.length));
}

/** 스크립트 · 정적 그림용: 블록 하나의 발 위치도 SVG 문자열 */
export function blockSvg(steps: ResolvedStep[], block: Pick<BlockInstance, 'origin' | 'heading'>, unitM: number, title: string): string {
  const fr = blockFrame(steps, block, unitM);
  const size = fr.r * 2;
  const vb = `${fr.cx - fr.r} ${-fr.cy - fr.r} ${size} ${size}`;
  const d = footPathD(unitM);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="640" height="640" font-family="IBM Plex Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">`);
  out.push(`<title>${xml(title)}</title>`);
  out.push(`<rect x="${fr.cx - fr.r}" y="${-fr.cy - fr.r}" width="${size}" height="${size}" fill="#E5E8ED"/>`);
  const g0 = Math.floor((fr.cx - fr.r) / 0.5) * 0.5;
  for (let x = g0; x <= fr.cx + fr.r; x += 0.5) out.push(`<line x1="${x}" y1="${-fr.cy - fr.r}" x2="${x}" y2="${-fr.cy + fr.r}" stroke="#C9CFD8" stroke-width="0.01"/>`);
  const h0 = Math.floor((-fr.cy - fr.r) / 0.5) * 0.5;
  for (let y = h0; y <= -fr.cy + fr.r; y += 0.5) out.push(`<line x1="${fr.cx - fr.r}" y1="${y}" x2="${fr.cx + fr.r}" y2="${y}" stroke="#C9CFD8" stroke-width="0.01"/>`);
  out.push(`<text x="${fr.cx}" y="${-fr.cy - fr.r + 0.22}" text-anchor="middle" font-size="0.16" fill="#172033">12시 · 앞</text>`);
  for (const f of ['L', 'R'] as Foot[]) {
    const p = localToWorld(block.origin, block.heading, HOME[f]);
    out.push(`<path d="${d}" transform="${footTransform(p, block.heading)}" fill="none" stroke="#172033" stroke-width="0.02" stroke-dasharray="0.05 0.04"/>`);
  }
  for (const s of steps) out.push(`<path d="${stepPathD(s)}" fill="none" stroke="${FOOT_COLOR[s.foot]}" stroke-width="0.012" stroke-opacity="0.5"/>`);
  for (const g of groupFootprints(steps)) {
    const c = FOOT_COLOR[g.foot];
    out.push(`<path d="${d}" transform="${footTransform(g.pos, g.yaw)}" fill="${g.anyStep ? c : 'none'}" fill-opacity="0.85" stroke="${c}" stroke-width="0.03"/>`);
    out.push(
      `<text x="${g.pos[0]}" y="${-g.pos[1] + 0.05}" text-anchor="middle" font-size="${labelSize(g.label)}" font-weight="700" fill="${g.anyStep ? '#ffffff' : c}">${xml(g.label)}</text>`,
    );
  }
  out.push('</svg>');
  return out.join('\n');
}
