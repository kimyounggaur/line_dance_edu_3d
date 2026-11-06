// 검증기 V1 ~ V10 (설계문서 8.2). 콘텐츠를 불러올 때와 검수 모드에서 값을 바꿀 때마다 실행한다.
import type { Block, DancerState, Figure, Foot, ResolvedStep, Routine, Vec2 } from './types';
import { DEFAULT_PARAMS, LIMITS, OTHER, type EngineParams } from './constants';
import {
  compose,
  frameDelta,
  readyState,
  toBlockLocal,
  type BlockInstance,
  type ComposeItem,
  type ComposeResult,
} from './compose';
import { closeCount } from './timeline';
import { angleDiff, normAngle } from './geometry';

export type ValidationCode = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'UNKNOWN';

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
  beat?: number;
  count?: string;
  figureId?: string;
}

export interface ValidationMetrics {
  steps: number;
  endWeight: Foot;
  shift: Vec2; // 한 번 실행한 뒤 좌표계 이동 (u, 시작 방향 기준)
  turn: number; // 한 번 실행한 뒤 방향 변화 (도)
  minPelvisLimit: number; // 골반 높이 한계의 최솟값 (m). −1 = 다리가 닿지 않는 순간이 있음
  minPelvisAt: string; // 그 카운트
  maxMove: number; // 한 걸음 이동의 최댓값 (u)
  maxStance: number; // 두 발 간격의 최댓값 (u)
  bendCounts: string[]; // 경로를 휘어야 하는 카운트 (첫 회)
  repeatSame: boolean | null; // 두 번째 실행의 착지 좌표가 첫 번째와 같은가
  closeN: number; // 처음 상태로 닫히는 재생 횟수
  wallHeadings: number[]; // 벽(재생 단위)마다 시작 방향
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
  metrics: ValidationMetrics;
}

export interface ValidateOptions {
  params?: EngineParams;
  startFoot?: Foot;
}

const EPS = 1e-6;

function emptyMetrics(weight: Foot): ValidationMetrics {
  return {
    steps: 0,
    endWeight: weight,
    shift: [0, 0],
    turn: 0,
    minPelvisLimit: -1,
    minPelvisAt: '',
    maxMove: 0,
    maxStance: 0,
    bendCounts: [],
    repeatSame: null,
    closeN: 1,
    wallHeadings: [0],
  };
}
const near = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps;

/** 합성 결과에서 V1 · V3 · V4 · V5 · V6 · V10을 모은다 */
function stepIssues(res: ComposeResult): ValidationIssue[] {
  const issues: ValidationIssue[] = res.issues.map((i) => ({
    code: i.code,
    message: i.message,
    beat: i.beat,
    count: i.count,
    figureId: i.figureId,
  }));
  for (const s of res.steps) {
    if (s.pelvisLimit >= 0 && s.pelvisLimit < LIMITS.pelvisMin) {
      issues.push({
        code: 'V5',
        beat: s.beat,
        count: s.count,
        figureId: s.figureId,
        message: `${s.count}카운트: 골반 높이 한계 ${s.pelvisLimit.toFixed(3)} m < ${LIMITS.pelvisMin} m (다리가 모자람)`,
      });
    }
    if (s.distance > LIMITS.maxMove + EPS) {
      issues.push({
        code: 'V6',
        beat: s.beat,
        count: s.count,
        figureId: s.figureId,
        message: `${s.count}카운트: 한 걸음 이동 ${s.distance.toFixed(2)}u > ${LIMITS.maxMove}u`,
      });
    }
    if (s.stance > LIMITS.maxStance + EPS) {
      issues.push({
        code: 'V6',
        beat: s.beat,
        count: s.count,
        figureId: s.figureId,
        message: `${s.count}카운트: 두 발 간격 ${s.stance.toFixed(2)}u > ${LIMITS.maxStance}u`,
      });
    }
  }
  return issues;
}

function metricsOf(res: ComposeResult, start: DancerState, unitEnd: DancerState, unitSteps: ResolvedStep[]): Omit<ValidationMetrics, 'repeatSame' | 'closeN' | 'wallHeadings'> {
  let minLim = Infinity;
  let minAt = '';
  let maxMove = 0;
  let maxStance = 0;
  for (const s of res.steps) {
    const lim = s.pelvisLimit < 0 ? -1 : s.pelvisLimit;
    if (lim < minLim) {
      minLim = lim;
      minAt = s.count;
    }
    maxMove = Math.max(maxMove, s.distance);
    maxStance = Math.max(maxStance, s.stance);
  }
  const d = frameDelta(start, unitEnd);
  const bend: string[] = [];
  for (const s of unitSteps) if (s.bendK !== 0 && !bend.includes(s.count)) bend.push(s.count);
  return {
    steps: unitSteps.length,
    endWeight: unitEnd.weightOn,
    shift: d.shift,
    turn: d.turn,
    minPelvisLimit: minLim === Infinity ? -1 : minLim,
    minPelvisAt: minAt,
    maxMove,
    maxStance,
    bendCounts: bend,
  };
}

/** 같은 나열을 units번 이어서 합성. 블록 인스턴스는 단위마다 따로 */
function composeUnits(
  items: Omit<ComposeItem, 'unitIndex' | 'wall'>[],
  units: number,
  start: DancerState,
  figures: Record<string, Figure>,
  params: EngineParams,
) {
  const all: ComposeItem[] = [];
  for (let u = 0; u < units; u++) for (const it of items) all.push({ ...it, unitIndex: u, wall: u + 1 });
  return compose(all, start, { figures, params });
}

function unitStarts(res: ComposeResult): BlockInstance[] {
  const out: BlockInstance[] = [];
  let last = -1;
  for (const b of res.blocks) {
    if (b.unitIndex !== last) {
      out.push(b);
      last = b.unitIndex;
    }
  }
  return out;
}

/** 단위 k의 착지 좌표(그 단위의 시작 좌표계)가 단위 0과 같은가 */
function sameLandings(res: ComposeResult, units: number, perUnit: number): boolean {
  const starts = unitStarts(res);
  if (starts.length < units) return false;
  for (let u = 1; u < units; u++) {
    for (let i = 0; i < perUnit; i++) {
      const a = res.steps[i];
      const b = res.steps[u * perUnit + i];
      if (!a || !b) return false;
      const pa = toBlockLocal(a.to, starts[0]);
      const pb = toBlockLocal(b.to, starts[u]);
      if (!near(pa[0], pb[0], 1e-6) || !near(pa[1], pb[1], 1e-6) || a.foot !== b.foot || a.action !== b.action) return false;
    }
  }
  return true;
}

function figureItems(ids: string[], blockIndex = 0, blockId = 'figure'): Omit<ComposeItem, 'unitIndex' | 'wall'>[] {
  return ids.map((figureId) => ({ figureId, blockIndex, blockId }));
}

/** 정해진 나열(블록 · 루틴 · 순서쌍)을 검사한다. units = 닫힘을 확인할 재생 횟수 */
export function validateItems(
  items: Omit<ComposeItem, 'unitIndex' | 'wall'>[],
  figures: Record<string, Figure>,
  opts: ValidateOptions & { checkClosure?: boolean; expectedWalls?: number; rotation?: Routine['rotation'] } = {},
): ValidationReport {
  const params = opts.params ?? DEFAULT_PARAMS;
  const start = readyState(opts.startFoot ?? 'R');
  const issues: ValidationIssue[] = [];
  for (const it of items) {
    if (!figures[it.figureId]) issues.push({ code: 'UNKNOWN', message: `알 수 없는 동작 id: ${it.figureId}`, figureId: it.figureId });
  }
  if (issues.length) return { ok: false, issues, metrics: emptyMetrics(start.weightOn) };
  const one = composeUnits(items, 1, start, figures, params);
  const n = closeCount(one.end.heading - start.heading);
  const unitsComposed = opts.checkClosure ? (n === 1 ? 2 : n) : 1;
  const res = unitsComposed === 1 ? one : composeUnits(items, unitsComposed, start, figures, params);
  // 첫 단위만으로 V1 ~ V6. 이어진 단위에서 생기는 문제(루프 2회째)도 함께 본다
  issues.push(...stepIssues(res));
  const base = metricsOf(res, start, one.end, one.steps);
  let repeatSame: boolean | null = null;
  const wallHeadings = unitStarts(res)
    .slice(0, n)
    .map((b) => Math.round(normAngle(b.heading) * 1e6) / 1e6);
  if (opts.checkClosure) {
    repeatSame = sameLandings(res, unitsComposed, one.steps.length);
    if (n === 1) {
      // V7 닫힘 (회전 없음)
      if (!near(base.shift[0], 0) || !near(base.shift[1], 0)) {
        issues.push({ code: 'V7', message: `한 번 실행한 뒤 자리가 (${base.shift[0].toFixed(2)}, ${base.shift[1].toFixed(2)})u 옮겨짐 — 제자리로 닫히지 않음` });
      }
      if (one.end.weightOn !== start.weightOn) {
        issues.push({ code: 'V7', message: `끝 체중이 ${one.end.weightOn === 'L' ? '왼발' : '오른발'} — 시작(${start.weightOn === 'L' ? '왼발' : '오른발'})과 다름` });
      }
      if (!repeatSame) issues.push({ code: 'V7', message: '끝 상태에서 한 번 더 실행한 착지 좌표가 첫 번째와 다름' });
    } else {
      // V8 벽: 모든 벽을 돌면 누적 이동 0 · 방향 0
      const total = frameDelta(start, res.end);
      if (!near(total.shift[0], 0, 1e-6) || !near(total.shift[1], 0, 1e-6) || Math.abs(angleDiff(0, total.turn)) > 1e-6) {
        issues.push({
          code: 'V8',
          message: `${n}번 돈 뒤 누적 이동 (${total.shift[0].toFixed(2)}, ${total.shift[1].toFixed(2)})u · 방향 ${normAngle(total.turn)}° — 처음으로 닫히지 않음`,
        });
      }
      if (res.end.weightOn !== start.weightOn) issues.push({ code: 'V8', message: '모든 벽을 돈 뒤 체중 발이 시작과 다름' });
      if (!repeatSame) issues.push({ code: 'V8', message: '벽마다 착지 좌표(그 벽의 좌표계)가 같지 않음' });
    }
    if (opts.expectedWalls !== undefined && opts.expectedWalls !== n) {
      issues.push({ code: 'V8', message: `벽 수 ${opts.expectedWalls}로 적혀 있지만 회전을 모두 더하면 ${n}벽` });
    }
    if (opts.rotation) {
      const want = opts.rotation === 'CW' ? [0, 90, 180, 270] : opts.rotation === 'CCW' ? [0, 270, 180, 90] : [0];
      const got = wallHeadings.slice(0, n);
      const okOrder = n === 1 ? opts.rotation === 'none' : want.length === got.length && want.every((h, i) => near(h, got[i], 1e-6));
      if (!okOrder) {
        issues.push({ code: 'V8', message: `벽 시작 방향 ${got.join(' → ')}° — ${opts.rotation} 순서(${want.join(' → ')}°)와 다름` });
      }
    }
    // V9 반복 가능: 끝났을 때 자유발 = 시작할 때 자유발
    if (OTHER[one.end.weightOn] !== OTHER[start.weightOn]) {
      issues.push({ code: 'V9', message: '끝났을 때 자유발이 시작할 때와 달라 다음 반복이 다른 발로 시작됨' });
    }
  }
  return {
    ok: issues.length === 0,
    issues,
    metrics: { ...base, repeatSame, closeN: n, wallHeadings },
  };
}

/** V2 — 사건의 시간 */
export function figureTimeIssues(fig: Figure): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let prev = -Infinity;
  fig.events.forEach((e, i) => {
    if (!(e.t > prev)) issues.push({ code: 'V2', figureId: fig.id, message: `${fig.nameKo}: ${i + 1}번째 사건의 t(${e.t})가 앞 사건보다 크지 않음` });
    if (e.t < 0 || e.t >= fig.beats) issues.push({ code: 'V2', figureId: fig.id, message: `${fig.nameKo}: t = ${e.t}가 0 이상 ${fig.beats} 미만이 아님` });
    if (e.action !== 'hold' && !e.to) issues.push({ code: 'V2', figureId: fig.id, message: `${fig.nameKo}: ${i + 1}번째 사건에 착지 자리(to)가 없음` });
    prev = e.t;
  });
  return issues;
}

/** 동작 하나 — 정준형과 좌우 반전 모두 V1 ~ V6, V10 */
export function validateFigure(fig: Figure, figures: Record<string, Figure>, opts: ValidateOptions = {}): ValidationReport {
  const all = { ...figures, [fig.id]: fig };
  const timeIssues = figureTimeIssues(fig);
  const r = validateItems(figureItems([fig.id]), all, { ...opts, startFoot: 'R' });
  const l = fig.mirrorable ? validateItems(figureItems([fig.id]), all, { ...opts, startFoot: 'L' }) : null;
  const issues = [...timeIssues, ...r.issues, ...(l ? l.issues.map((i) => ({ ...i, message: `[왼발 시작] ${i.message}` })) : [])];
  return { ok: issues.length === 0, issues, metrics: r.metrics };
}

/** 블록 — V2(길이 합 8) + V1 ~ V6 + 닫힘(V7, 회전 블록은 네 번 이어 V8) */
export function validateBlock(block: Block, figures: Record<string, Figure>, opts: ValidateOptions = {}): ValidationReport {
  const issues: ValidationIssue[] = [];
  let sum = 0;
  for (const id of block.figures) {
    const f = figures[id];
    if (!f) continue;
    sum += f.beats;
    issues.push(...figureTimeIssues(f));
  }
  if (!near(sum, 8)) issues.push({ code: 'V2', message: `${block.nameKo}: 동작 길이의 합이 ${sum}박 (8박이어야 함)` });
  const r = validateItems(figureItems(block.figures, 0, block.id), figures, { ...opts, checkClosure: true });
  const all = [...issues, ...r.issues];
  return { ok: all.length === 0, issues: all, metrics: r.metrics };
}

/** 루틴 — 블록마다 V2 + 모든 벽을 이어 V1 ~ V6 · V7/V8 · V9 */
export function validateRoutine(
  routine: Routine,
  blocks: Record<string, Block>,
  figures: Record<string, Figure>,
  opts: ValidateOptions = {},
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const items: Omit<ComposeItem, 'unitIndex' | 'wall'>[] = [];
  routine.blocks.forEach((bid, bi) => {
    const b = blocks[bid];
    if (!b) {
      issues.push({ code: 'UNKNOWN', message: `알 수 없는 블록 id: ${bid}` });
      return;
    }
    let sum = 0;
    for (const id of b.figures) sum += figures[id]?.beats ?? 0;
    if (!near(sum, 8)) issues.push({ code: 'V2', message: `${b.nameKo}: 동작 길이의 합이 ${sum}박 (8박이어야 함)` });
    for (const figureId of b.figures) items.push({ figureId, blockIndex: bi, blockId: bid });
  });
  if (issues.some((i) => i.code === 'UNKNOWN')) {
    return { ok: false, issues, metrics: emptyMetrics(opts.startFoot === 'L' ? 'R' : 'L') };
  }
  const r = validateItems(items, figures, { ...opts, checkClosure: true, expectedWalls: routine.walls, rotation: routine.rotation });
  const all = [...issues, ...r.issues];
  return { ok: all.length === 0, issues: all, metrics: r.metrics };
}

export interface ContentReport {
  figures: Record<string, ValidationReport>;
  blocks: Record<string, ValidationReport>;
  routines: Record<string, ValidationReport>;
  /** 블록 순서쌍 "A 다음 B" — 실패한 쌍만 */
  pairFailures: { a: string; b: string; issues: ValidationIssue[] }[];
}

/** 콘텐츠 전체를 검사한다 (오른발 시작 + 왼발 시작) */
export function validateContent(
  content: { figures: Record<string, Figure>; blocks: Record<string, Block>; routines: Record<string, Routine> },
  opts: { params?: EngineParams; pairs?: boolean } = {},
): ContentReport {
  const { figures, blocks, routines } = content;
  const merge = (a: ValidationReport, b: ValidationReport): ValidationReport => ({
    ok: a.ok && b.ok,
    issues: [...a.issues, ...b.issues.map((i) => ({ ...i, message: `[왼발 시작] ${i.message}` }))],
    metrics: a.metrics,
  });
  const out: ContentReport = { figures: {}, blocks: {}, routines: {}, pairFailures: [] };
  for (const f of Object.values(figures)) out.figures[f.id] = validateFigure(f, figures, { params: opts.params });
  for (const b of Object.values(blocks)) {
    out.blocks[b.id] = merge(
      validateBlock(b, figures, { params: opts.params, startFoot: 'R' }),
      validateBlock(b, figures, { params: opts.params, startFoot: 'L' }),
    );
  }
  for (const r of Object.values(routines)) {
    out.routines[r.id] = merge(
      validateRoutine(r, blocks, figures, { params: opts.params, startFoot: 'R' }),
      validateRoutine({ ...r, rotation: r.rotation === 'CW' ? 'CCW' : r.rotation === 'CCW' ? 'CW' : 'none' }, blocks, figures, {
        params: opts.params,
        startFoot: 'L',
      }),
    );
  }
  if (opts.pairs) {
    const ids = Object.keys(blocks);
    for (const a of ids) {
      for (const b of ids) {
        const items = [
          ...blocks[a].figures.map((figureId) => ({ figureId, blockIndex: 0, blockId: a })),
          ...blocks[b].figures.map((figureId) => ({ figureId, blockIndex: 1, blockId: b })),
        ];
        const rep = validateItems(items, figures, { params: opts.params });
        const bad = rep.issues.filter((i) => ['V1', 'V3', 'V4', 'V5', 'V6'].includes(i.code));
        if (bad.length) out.pairFailures.push({ a, b, issues: bad });
      }
    }
  }
  return out;
}

/** 사람이 읽는 한 줄 요약 */
export function summarize(report: ValidationReport): string {
  if (report.ok) return '검증 통과';
  const codes = [...new Set(report.issues.map((i) => i.code))];
  return `검증 실패 (${codes.join(', ')})`;
}


