// 재생용 걸음 목록(Track). 루프의 이음새는 걸음 목록을 두 벌 이상 만들어 해결한다 (설계문서 8.3).
import type { DancerState, Figure, Foot, ResolvedStep, Vec2 } from './types';
import { DEFAULT_PARAMS, TIMING, type EngineParams } from './constants';
import {
  compose,
  cloneState,
  frameOrigin,
  type BlockInstance,
  type ComposeIssue,
  type ComposeItem,
  type FigureInstance,
} from './compose';
import { closeCount } from './timeline';
import { supportPoint } from './weight';
import { clamp } from './geometry';

export interface UnitSpec {
  /** 재생 단위 한 번(블록 하나 또는 루틴 한 벽)의 동작 나열 */
  items: Omit<ComposeItem, 'unitIndex' | 'wall'>[];
  unitLength: number; // 박
}

export interface TrackSpec {
  unit: UnitSpec;
  start: DancerState;
  loop: boolean;
  repeats?: number; // loop = false일 때 재생 횟수 (기본 = 닫히는 횟수)
}

export interface TrackTiming {
  T: Float64Array;
  gap: Float64Array;
  gapNext: Float64Array;
  lift: Float64Array;
  ws: Float64Array; // 체중 이동 구간 시작
  we: Float64Array; // 체중 이동 구간 끝
  H: Float64Array; // 발이 뜨는 최고 높이 (m)
  heelLand: Float64Array; // 착지 순간 뒤꿈치 들림 (m)
  heelLowers: Uint8Array; // 착지 뒤 뒤꿈치가 내려오는가
  rest: Float64Array; // 한 카운트씩 보기의 정지 박
}

export interface TrackIndex {
  lastOfFoot: Record<Foot, Int32Array>;
  lastPivot: Record<Foot, Int32Array>;
  lastTurn: Int32Array;
  lastWeightStep: Int32Array;
}

export interface Track {
  steps: ResolvedStep[];
  timing: TrackTiming;
  idx: TrackIndex;
  blocks: BlockInstance[];
  figures: FigureInstance[];
  start: DancerState;
  startPelvis: Vec2;
  unitLength: number;
  closeN: number; // 처음 상태로 닫히는 재생 횟수
  turnPerUnit: number;
  loopBeats: number;
  loop: boolean;
  totalBeats: number; // loop = true면 Infinity
  loopShift: Vec2; // 닫히는 단위마다 생기는 평행 이동 (닫힌 동작은 0)
  halfBeats: Set<number>; // '&' 걸음이 있는 반 박 (2 × 박)
  issues: ComposeIssue[];
  params: EngineParams;
}

const BALL_FIRST = new Set(['side', 'back', 'crossBehind', 'together', 'inPlace', 'diagBack']);

function composeUnits(
  spec: UnitSpec,
  units: number,
  closeN: number,
  start: DancerState,
  figures: Record<string, Figure>,
  params: EngineParams,
) {
  const items: ComposeItem[] = [];
  for (let u = 0; u < units; u++) {
    for (const it of spec.items) items.push({ ...it, unitIndex: u, wall: closeN > 1 ? (u % closeN) + 1 : 1 });
  }
  return compose(items, start, { figures, params });
}

export function buildTrack(spec: TrackSpec, figures: Record<string, Figure>, params: EngineParams = DEFAULT_PARAMS): Track {
  // 한 단위를 먼저 합성해 한 번에 도는 각을 잰다
  const probe = composeUnits(spec.unit, 1, 1, spec.start, figures, params);
  const turnPerUnit = probe.end.heading - spec.start.heading;
  const closeN = closeCount(turnPerUnit);
  const loopBeats = spec.unit.unitLength * closeN;
  const units = spec.loop ? closeN * 3 : Math.max(1, spec.repeats ?? closeN);
  const res = composeUnits(spec.unit, units, closeN, spec.start, figures, params);
  const steps = res.steps;
  const n = steps.length;

  // 루프마다 생기는 평행 이동: 2회째 시작 원점 → 3회째 시작 원점
  let loopShift: Vec2 = [0, 0];
  if (spec.loop) {
    const b1 = res.blocks.find((b) => Math.abs(b.startBeat - loopBeats) < 1e-9);
    const b2 = res.blocks.find((b) => Math.abs(b.startBeat - 2 * loopBeats) < 1e-9);
    if (b1 && b2) {
      const o1 = frameOrigin(b1.startState);
      const o2 = frameOrigin(b2.startState);
      loopShift = [o2[0] - o1[0], o2[1] - o1[1]];
      if (Math.hypot(loopShift[0], loopShift[1]) < 1e-9) loopShift = [0, 0];
    }
  }

  const T = new Float64Array(n);
  const gap = new Float64Array(n);
  const gapNext = new Float64Array(n);
  const lift = new Float64Array(n);
  const ws = new Float64Array(n);
  const we = new Float64Array(n);
  const H = new Float64Array(n);
  const heelLand = new Float64Array(n);
  const heelLowers = new Uint8Array(n);
  const rest = new Float64Array(n);
  for (let i = 0; i < n; i++) T[i] = steps[i].beat;
  for (let i = 0; i < n; i++) {
    gap[i] = i > 0 ? T[i] - T[i - 1] : TIMING.firstGap;
    gapNext[i] = i < n - 1 ? T[i + 1] - T[i] : TIMING.firstGap;
    let l = T[i] - TIMING.liftFrac * gap[i];
    if (i > 0 && steps[i - 1].foot === steps[i].foot) l = Math.max(l, T[i - 1] + TIMING.sameFootMinFrac * gap[i]);
    lift[i] = l;
    ws[i] = T[i] - TIMING.weightPre * gap[i];
    we[i] = T[i] + TIMING.weightPost * gapNext[i];
    const dM = steps[i].distance * params.unitM;
    H[i] = steps[i].distance < 1e-6 ? 0.04 : clamp(0.22 * dM, 0.03, 0.09);
    const s = steps[i];
    const ball = s.action === 'touch' || s.contact === 'ball' || s.contact === 'toe';
    if (ball) heelLand[i] = TIMING.heelLift;
    else if (s.action === 'step' && s.contact === 'flat' && BALL_FIRST.has(s.dir)) {
      heelLand[i] = TIMING.heelLift;
      heelLowers[i] = 1;
    }
    rest[i] = T[i] + TIMING.stepRestFrac * gapNext[i];
  }

  const lastOfFoot = { L: new Int32Array(n), R: new Int32Array(n) };
  const lastPivot = { L: new Int32Array(n), R: new Int32Array(n) };
  const lastTurn = new Int32Array(n);
  const lastWeightStep = new Int32Array(n);
  let lf = { L: -1, R: -1 };
  let lp = { L: -1, R: -1 };
  let lt = -1;
  let lw = -1;
  for (let i = 0; i < n; i++) {
    const s = steps[i];
    lf = { ...lf, [s.foot]: i };
    if (s.turn !== 0) {
      lt = i;
      if (s.pivotFoot) lp = { ...lp, [s.pivotFoot]: i };
    }
    if (s.action === 'step') lw = i;
    lastOfFoot.L[i] = lf.L;
    lastOfFoot.R[i] = lf.R;
    lastPivot.L[i] = lp.L;
    lastPivot.R[i] = lp.R;
    lastTurn[i] = lt;
    lastWeightStep[i] = lw;
  }

  const halfBeats = new Set<number>();
  for (const s of steps) {
    const h = Math.round(s.beat * 2);
    if (h % 2 !== 0) halfBeats.add(h);
  }

  const start = cloneState(spec.start);
  return {
    steps,
    timing: { T, gap, gapNext, lift, ws, we, H, heelLand, heelLowers, rest },
    idx: { lastOfFoot, lastPivot, lastTurn, lastWeightStep },
    blocks: res.blocks,
    figures: res.figures,
    start,
    startPelvis: start.pelvisS ? ([...start.pelvisS] as Vec2) : supportPoint(start.pos, start.weightOn, params),
    unitLength: spec.unit.unitLength,
    closeN,
    turnPerUnit,
    loopBeats,
    loop: spec.loop,
    totalBeats: spec.loop ? Infinity : spec.unit.unitLength * units,
    loopShift,
    halfBeats,
    issues: res.issues,
    params,
  };
}



export interface BeatMap {
  local: number; // 걸음 목록 안에서의 박
  shift: Vec2; // 화면에 그릴 때 더할 평행 이동
  rep: number; // 몇 번째 닫힘 단위인가
}

/** 재생 박 → 걸음 목록 안의 박. 루프면 2회째 구간 [L, 2L)을 되풀이해 쓴다 */
export function mapBeat(track: Track, beat: number): BeatMap {
  if (!track.loop) return { local: Math.min(beat, track.totalBeats), shift: [0, 0], rep: 0 };
  const L = track.loopBeats;
  if (beat < L) return { local: beat, shift: [0, 0], rep: 0 };
  const k = Math.floor(beat / L);
  const local = beat - (k - 1) * L;
  return { local, shift: [track.loopShift[0] * (k - 1), track.loopShift[1] * (k - 1)], rep: k };
}

/** 걸음 목록 안의 박이 속한 블록 */
export function blockAtLocal(track: Track, local: number): BlockInstance {
  const bs = track.blocks;
  if (local < bs[0].startBeat) return bs[0];
  for (const b of bs) if (local >= b.startBeat && local < b.endBeat) return b;
  return bs[bs.length - 1];
}

export function stepsInBlock(track: Track, block: BlockInstance): ResolvedStep[] {
  return track.steps.filter((s) => s.beat >= block.startBeat - 1e-9 && s.beat < block.endBeat - 1e-9);
}
