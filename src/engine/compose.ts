// 합성기 — 동작 나열을 '걸음 목록'으로 (설계문서 8.1). 골반 지지점(8.5 ②)과 경로 찾기(8.4)를 함께 계산한다.
import type { DancerState, Figure, Foot, ResolvedStep, StepEvent, Vec2 } from './types';
import { DEFAULT_PARAMS, FOOT_KO, HOME, OTHER, LIMITS, SIDE_KO, type EngineParams } from './constants';
import { dist, footDims, footRect, fwd, localToWorld, overlapDepth, right, worldToLocalVec } from './geometry';
import { findPath } from './footPath';
import { reachLimit, supportPoint } from './weight';

export interface ComposeItem {
  figureId: string;
  blockIndex: number;
  blockId: string;
  unitIndex: number;
  wall: number;
}

export interface BlockInstance {
  seq: number; // 합성 결과 안의 순서
  blockIndex: number;
  blockId: string;
  unitIndex: number;
  wall: number;
  startBeat: number;
  endBeat: number;
  origin: Vec2; // 블록 좌표계 원점 (지지발이 홈에 오도록)
  heading: number;
  startState: DancerState;
}

export interface FigureInstance {
  seq: number;
  figureId: string;
  blockIndex: number;
  startBeat: number;
  endBeat: number;
  mirrored: boolean;
  origin: Vec2;
  heading: number;
  startState: DancerState;
  endState: DancerState;
  firstStep: number;
  lastStep: number;
}

export type ComposeIssueCode = 'V1' | 'V3' | 'V4' | 'V5' | 'V10' | 'UNKNOWN';
export interface ComposeIssue {
  code: ComposeIssueCode;
  beat: number;
  count: string;
  figureId: string;
  message: string;
}

export interface ComposeResult {
  steps: ResolvedStep[];
  end: DancerState;
  blocks: BlockInstance[];
  figures: FigureInstance[];
  issues: ComposeIssue[];
  endBeat: number;
}

export function readyState(startFoot: Foot = 'R'): DancerState {
  // 오른발부터 = 체중 왼발. 왼발부터 = 체중 오른발(전체 좌우 반전)
  return {
    pos: { L: [...HOME.L] as Vec2, R: [...HOME.R] as Vec2 },
    yaw: { L: 0, R: 0 },
    weightOn: startFoot === 'R' ? 'L' : 'R',
    heading: 0,
  };
}

export function cloneState(s: DancerState): DancerState {
  return {
    pos: { L: [...s.pos.L] as Vec2, R: [...s.pos.R] as Vec2 },
    yaw: { L: s.yaw.L, R: s.yaw.R },
    weightOn: s.weightOn,
    heading: s.heading,
    pelvisS: s.pelvisS ? ([...s.pelvisS] as Vec2) : undefined,
  };
}

/** 현재 지지발을 홈에 놓는 좌표계 원점 (앵커 규칙) */
export function frameOrigin(s: DancerState): Vec2 {
  const home = HOME[s.weightOn];
  const f = fwd(s.heading);
  const r = right(s.heading);
  const p = s.pos[s.weightOn];
  return [p[0] - home[0] * r[0] - home[1] * f[0], p[1] - home[0] * r[1] - home[1] * f[1]];
}

export function countLabel(beat: number): string {
  const whole = Math.floor(beat + 1e-9);
  const frac = beat - whole;
  const c = (((whole % 8) + 8) % 8) + 1;
  if (Math.abs(frac) < 1e-6) return String(c);
  if (Math.abs(frac - 0.5) < 1e-6) return `${c}&`;
  return `${c}+${Math.round(frac * 100) / 100}`;
}

/** 좌우 반전: 발 교체, to.x · turn · footYaw 부호 반전 */
export function mirrorEvent(e: StepEvent): StepEvent {
  return {
    ...e,
    foot: OTHER[e.foot],
    to: e.to ? [-e.to[0], e.to[1]] : undefined,
    turn: e.turn ? -e.turn : e.turn,
    footYaw: e.footYaw ? -e.footYaw : e.footYaw,
  };
}

export function defaultContact(e: StepEvent): ResolvedStep['contact'] {
  return e.contact ?? (e.action === 'touch' ? 'ball' : 'flat');
}

export function followFB(e: StepEvent, params: EngineParams): number {
  if (typeof e.pelvisFollowFB === 'number') return e.pelvisFollowFB;
  return e.dir === 'crossBehind' || e.dir === 'crossFront' ? params.followCross : 1;
}

/** 설명문 토큰: {M} 움직이는 발, {S} 지지발, {MD} 움직이는 발 쪽, {TD} 회전 방향 */
export function resolveDesc(desc: string, foot: Foot, turn: number): string {
  return desc
    .replaceAll('{MD}', SIDE_KO[foot])
    .replaceAll('{M}', FOOT_KO[foot])
    .replaceAll('{S}', FOOT_KO[OTHER[foot]])
    .replaceAll('{TD}', turn > 0 ? '오른쪽' : '왼쪽');
}

export interface ComposeOptions {
  figures: Record<string, Figure>;
  params?: EngineParams;
  beat0?: number;
}

/** 동작 나열 + 시작 상태 → 걸음 목록 + 끝 상태 */
export function compose(items: ComposeItem[], start: DancerState, opts: ComposeOptions): ComposeResult {
  const params = opts.params ?? DEFAULT_PARAMS;
  const dims = footDims(params.unitM);
  const st = cloneState(start);
  let beat = opts.beat0 ?? 0;
  let S: Vec2 = start.pelvisS ? ([...start.pelvisS] as Vec2) : supportPoint(st.pos, st.weightOn, params);
  const steps: ResolvedStep[] = [];
  const blocks: BlockInstance[] = [];
  const figureInstances: FigureInstance[] = [];
  const issues: ComposeIssue[] = [];
  let blockKey = '';

  items.forEach((item, figSeq) => {
    const fig = opts.figures[item.figureId];
    const key = `${item.unitIndex}:${item.blockIndex}`;
    if (key !== blockKey) {
      if (blocks.length) blocks[blocks.length - 1].endBeat = beat;
      blockKey = key;
      blocks.push({
        seq: blocks.length,
        blockIndex: item.blockIndex,
        blockId: item.blockId,
        unitIndex: item.unitIndex,
        wall: item.wall,
        startBeat: beat,
        endBeat: beat,
        origin: frameOrigin(st),
        heading: st.heading,
        startState: { ...cloneState(st), pelvisS: [...S] as Vec2 },
      });
    }
    if (!fig) {
      issues.push({ code: 'UNKNOWN', beat, count: countLabel(beat), figureId: item.figureId, message: `알 수 없는 동작 id: ${item.figureId}` });
      return;
    }
    const mirrored = st.weightOn === 'R'; // 정준형은 체중 왼발에서 시작
    if (mirrored && !fig.mirrorable) {
      issues.push({
        code: 'V10',
        beat,
        count: countLabel(beat),
        figureId: fig.id,
        message: `${fig.nameKo}: 왼발 시작(좌우 반전)이 필요하지만 반전할 수 없는 동작`,
      });
    }
    const origin = frameOrigin(st);
    const h0 = st.heading;
    const startState: DancerState = { ...cloneState(st), pelvisS: [...S] as Vec2 };
    const firstStep = steps.length;

    fig.events.forEach((e0, eventIndex) => {
      const e = mirrored ? mirrorEvent(e0) : e0;
      if (e.action === 'hold' || !e.to) return;
      const foot = e.foot;
      const at = beat + e.t;
      if (foot === st.weightOn) {
        issues.push({
          code: 'V1',
          beat: at,
          count: countLabel(at),
          figureId: fig.id,
          message: `${countLabel(at)}카운트: ${FOOT_KO[foot]}에 체중이 실려 있어 움직일 수 없음`,
        });
      }
      const to = localToWorld(origin, h0, e.to);
      const from: Vec2 = [...st.pos[foot]] as Vec2;
      const turn = e.turn ?? 0;
      const headingBefore = st.heading;
      const headingAfter = st.heading + turn;
      const sup = st.weightOn === foot ? OTHER[foot] : st.weightOn;
      const supYaw0 = st.yaw[sup];
      const supYaw1 = turn ? headingAfter : supYaw0;
      const yawFrom = st.yaw[foot];
      const yawTo = headingAfter + (e.footYaw ?? 0);
      const path = findPath(from, to, yawFrom, yawTo, st.pos[sup], supYaw0, supYaw1, dims);
      if (!path.ok) {
        issues.push({
          code: 'V4',
          beat: at,
          count: countLabel(at),
          figureId: fig.id,
          message: `${countLabel(at)}카운트: ${FOOT_KO[foot]}이 지나갈 길이 지지발과 겹침`,
        });
      }
      // 상태 갱신
      st.pos[foot] = to;
      st.yaw[foot] = yawTo;
      if (turn) st.yaw[sup] = headingAfter;
      st.heading = headingAfter;
      const overlap = overlapDepth(footRect(st.pos.L, st.yaw.L, dims), footRect(st.pos.R, st.yaw.R, dims));
      if (overlap > LIMITS.overlapEps) {
        issues.push({
          code: 'V3',
          beat: at,
          count: countLabel(at),
          figureId: fig.id,
          message: `${countLabel(at)}카운트: 착지한 두 발이 ${(overlap * params.unitM * 100).toFixed(1)} cm 겹침`,
        });
      }
      const weightBefore = st.weightOn;
      if (e.action === 'step') st.weightOn = foot;
      // 골반 지지점: 기본 규칙 + 앞뒤 추종 비율
      const naive = supportPoint(st.pos, st.weightOn, params);
      const fb = followFB(e0, params);
      const dl = worldToLocalVec(st.heading, [naive[0] - S[0], naive[1] - S[1]]);
      const f = fwd(st.heading);
      const r = right(st.heading);
      const Snew: Vec2 = [S[0] + dl[0] * r[0] + fb * dl[1] * f[0], S[1] + dl[0] * r[1] + fb * dl[1] * f[1]];
      const Smid: Vec2 = [(S[0] + Snew[0]) / 2, (S[1] + Snew[1]) / 2];
      const limMid = reachLimit(st.pos, st.yaw, Smid, st.heading, params);
      const limFull = reachLimit(st.pos, st.yaw, Snew, st.heading, params);
      const pelvisLimit = limMid < 0 || limFull < 0 ? -1 : Math.min(limMid, limFull);
      if (pelvisLimit < 0) {
        issues.push({
          code: 'V5',
          beat: at,
          count: countLabel(at),
          figureId: fig.id,
          message: `${countLabel(at)}카운트: 다리가 발에 닿지 않음`,
        });
      }
      S = Snew;
      steps.push({
        index: steps.length,
        beat: at,
        count: countLabel(at),
        blockIndex: item.blockIndex,
        blockId: item.blockId,
        unitIndex: item.unitIndex,
        wall: item.wall,
        figureId: fig.id,
        figureInstance: figSeq,
        eventIndex,
        side: mirrored ? 'L' : 'R',
        foot,
        action: e.action,
        contact: defaultContact(e),
        dir: e.dir,
        from,
        to,
        ctrl: path.ctrl,
        bendK: path.k,
        pathOk: path.ok,
        moveLocal: worldToLocalVec(headingAfter, [to[0] - from[0], to[1] - from[1]]),
        distance: dist(from, to),
        turn,
        headingBefore,
        headingAfter,
        weightBefore,
        weightAfter: st.weightOn,
        yawFrom,
        yawTo,
        pivotFoot: turn ? sup : null,
        pivotYawFrom: supYaw0,
        pivotYawTo: supYaw1,
        pelvisTarget: Snew,
        pelvisFollowFB: fb,
        pelvisLimit,
        stance: dist(st.pos.L, st.pos.R),
        overlap: Math.max(0, overlap),
        cueKo: e.cueKo,
        cueEn: e.cueEn,
        desc: resolveDesc(e.descKo, foot, turn),
      });
    });
    beat += fig.beats;
    figureInstances.push({
      seq: figSeq,
      figureId: fig.id,
      blockIndex: item.blockIndex,
      startBeat: beat - fig.beats,
      endBeat: beat,
      mirrored,
      origin,
      heading: h0,
      startState,
      endState: { ...cloneState(st), pelvisS: [...S] as Vec2 },
      firstStep,
      lastStep: steps.length - 1,
    });
  });
  if (blocks.length) blocks[blocks.length - 1].endBeat = beat;
  const end = cloneState(st);
  end.pelvisS = S;
  return { steps, end, blocks, figures: figureInstances, issues, endBeat: beat };
}

/** 끝 상태의 좌표계 원점이 시작 좌표계에서 어디인지(옆, 앞뒤 u)와 방향 변화(도) */
export function frameDelta(start: DancerState, end: DancerState): { shift: Vec2; turn: number } {
  const o0 = frameOrigin(start);
  const o1 = frameOrigin(end);
  const rel = worldToLocalVec(start.heading, [o1[0] - o0[0], o1[1] - o0[1]]);
  const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
  return { shift: [clean(rel[0]), clean(rel[1])], turn: end.heading - start.heading };
}

/** 이 걸음의 착지 자리를 블록 좌표계(블록 시작 자리 · 방향 기준)로 */
export function toBlockLocal(p: Vec2, block: Pick<BlockInstance, 'origin' | 'heading'>): Vec2 {
  const v = worldToLocalVec(block.heading, [p[0] - block.origin[0], p[1] - block.origin[1]]);
  const clean = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);
  return [clean(v[0]), clean(v[1])];
}
