// 설계문서 7.1 · 8.2 · 8.4 · 8.5 · 8.6의 초기값. 바꾸면 docs/DESIGN.md 부록 A.4의 검산을 다시 한다.
import type { Foot, Vec2 } from './types';

export const DEFAULT_UNIT_M = 0.36; // 1u = 0.36 m
export const UNIT_RANGE: [number, number] = [0.34, 0.4]; // 검산을 통과한 보폭 범위 (부록 A.4)

export const HOME: Record<Foot, Vec2> = { L: [-0.2, 0], R: [0.2, 0] };
export const OTHER: Record<Foot, Foot> = { L: 'R', R: 'L' };

/** 마네킹 치수 (m) — 8.6 */
export const BODY = {
  height: 1.65,
  pelvisH: 0.85,
  hipHalf: 0.09,
  thigh: 0.4,
  shin: 0.4,
  ankleH: 0.075,
  ankleBack: 0.06, // 발 중심에서 발뒤꿈치 쪽으로
  pelvisToShoulder: 0.5,
  shoulderHalf: 0.19,
  upperArm: 0.28,
  forearm: 0.25,
  shoulderToHead: 0.2,
  headR: 0.1,
  footLen: 0.25,
  footWid: 0.1,
  footH: 0.07,
  reachFactor: 0.98,
} as const;

export const REACH = BODY.reachFactor * (BODY.thigh + BODY.shin); // 0.784 m

/** 엔진에서 바꿔 볼 수 있는 값 (개발용 조정 패널) */
export interface EngineParams {
  unitM: number;
  pelvisGain: number; // 두 발 중점 → 지지발 쪽으로 가는 비율
  pelvisMaxOff: number; // 중점에서 벗어나는 최대 거리 (u)
  followCross: number; // 교차 걸음의 앞뒤 추종 비율
  dipDepth: number; // 디딤마다 내려앉는 깊이 (m)
  pelvisBaseH: number; // 골반 기본 높이 (m)
}

export const DEFAULT_PARAMS: EngineParams = {
  unitM: DEFAULT_UNIT_M,
  pelvisGain: 0.7,
  pelvisMaxOff: 0.3,
  followCross: 0.15,
  dipDepth: 0.015,
  pelvisBaseH: BODY.pelvisH,
};

/** 시간 규칙 (8.4 · 8.5) */
export const TIMING = {
  firstGap: 1.0, // 첫 걸음의 앞 간격
  liftFrac: 0.6, // 착지 0.6 × 간격 전에 뜬다
  sameFootMinFrac: 0.1, // 같은 발이 연달아 움직일 때 직전 착지 + 0.1 × 간격 이후에 뜬다
  weightPre: 0.25, // 체중 이동 구간 시작: 착지 0.25 × 앞 간격 전
  weightPost: 0.3, // 체중 이동 구간 끝: 착지 0.30 × 다음 간격 뒤
  dipWidth: 0.18,
  heelLift: 0.04, // m
  stepRestFrac: 0.3, // 한 카운트씩 보기의 정지 지점: 착지 + 0.3 × 다음 간격
  rollDeg: 3,
};

/** 검증 기준 (8.2) */
export const LIMITS = {
  pelvisMin: 0.73, // V5 골반 높이 한계 (m)
  maxMove: 2.0, // V6 한 걸음 이동 (u)
  maxStance: 1.5, // V6 두 발 간격 (u)
  overlapEps: 1e-6,
  closeEps: 1e-6,
};

/** 경로 찾기 (8.4) */
export const PATH = { kStep: 0.1, kSteps: 20, samples: 19 };

export const FOOT_KO: Record<Foot, string> = { L: '왼발', R: '오른발' };
export const SIDE_KO: Record<Foot, string> = { L: '왼쪽', R: '오른쪽' };
