// src/engine/types.ts — 설계문서 7.2 ~ 7.8의 타입. engine 폴더는 바깥(React · three · store)을 import하지 않는다.

export type Foot = 'L' | 'R';
export type Vec2 = [number, number]; // [x, y] 단위 u (바닥 좌표: x+ 오른쪽, y+ 앞 = 12시)
export type Vec3 = [number, number, number]; // [x, y, z] 단위 m (z = 높이). three.js 변환은 render3d에서 한다
export type StepAction = 'step' | 'touch' | 'hold'; // step = 체중 이동, touch = 체중 없음, hold = 멈춤
export type StepDir =
  | 'side'
  | 'forward'
  | 'back'
  | 'crossFront'
  | 'crossBehind'
  | 'together'
  | 'inPlace'
  | 'diagFwd'
  | 'diagBack';
export type Contact = 'flat' | 'ball' | 'heel' | 'toe';

export interface StepEvent {
  t: number; // 동작 시작 기준 박. 0 = 첫 카운트, 0.5 = '&'
  foot: Foot; // 움직이는 발 (정준형 기준)
  action: StepAction;
  to?: Vec2; // 착지 자리 (동작 좌표계). hold는 생략
  dir: StepDir; // 무용수 기준 방향 태그
  turn?: number; // 이 걸음 동안의 몸 회전(도). + 오른쪽. 기본 0
  contact?: Contact; // 기본: step = 'flat', touch = 'ball'
  weight?: number; // 착지 후 이 발의 체중 비율 (부분 체중은 2차)
  footYaw?: number; // 발끝 방향 보정(도, 몸 방향 기준, + 오른쪽). 기본 0
  pelvisFollowFB?: number; // 골반이 앞뒤로 따라가는 비율. 기본 1, 교차 걸음 기본 0.15 (8.5)
  cueKo: string;
  cueEn: string;
  descKo: string; // 토큰 {M} {S} {MD} {TD}
}

export type Evidence = 'strong' | 'medium' | 'weak';

export interface SourceRef {
  sourceId: string;
  ref: string;
  supports: ('name' | 'beats' | 'direction' | 'order' | 'usage' | 'timing')[];
  note?: string;
}

export interface Verification {
  status: 'draft' | 'in_review' | 'verified';
  reviewer?: string;
  reviewedAt?: string;
  method?: string;
  openQuestions: string[];
  changes?: string[];
}

export interface Figure {
  id: string;
  nameKo: string;
  nameEn: string;
  aliases?: string[];
  beats: number;
  mirrorable: boolean;
  events: StepEvent[];
  level: number;
  tags?: string[];
  evidence: Evidence;
  sources: SourceRef[];
  verification: Verification;
  /** 변형이면 원래 동작 id (예: jazzBox) */
  variantOf?: string;
  /** 변형 이름 (예: "4카운트 모으기") */
  variantLabel?: string;
}

export interface Block {
  id: string;
  nameKo: string;
  figures: string[]; // 길이의 합이 8박. 좌우는 엔진이 정한다
  level: number;
}

export interface Routine {
  id: string;
  nameKo: string;
  blocks: string[];
  walls: 1 | 2 | 4;
  rotation: 'none' | 'CW' | 'CCW';
  level: number;
}

export type Highlight = 'weight' | 'path' | 'facing' | 'and';

export interface Exercise {
  id: string;
  target: { kind: 'block' | 'routine'; id: string };
  bpm: number;
  loop: boolean;
  countInBeats: 0 | 4 | 8;
  startFoot: Foot;
  repeats?: number;
  view?: Partial<Settings>;
  highlight?: Highlight[];
}

export interface DancerState {
  pos: Record<Foot, Vec2>;
  yaw: Record<Foot, number>;
  weightOn: Foot;
  heading: number;
  pelvisS?: Vec2; // 마지막 골반 지지점(8.5). 이어서 합성할 때 넘겨준다
}

export interface ResolvedStep {
  index: number; // 걸음 목록 안의 순서
  beat: number; // 재생 시작 기준 절대 박
  count: string; // '1' … '8', '&' 걸음은 '1&'
  blockIndex: number; // 루틴 안의 블록 순서 (0부터)
  blockId: string;
  unitIndex: number; // 몇 번째 재생 단위인가 (루틴 한 벽 = 1단위)
  wall: number;
  figureId: string;
  figureInstance: number;
  eventIndex: number;
  side: 'R' | 'L'; // 정준형(R) / 반전(L)
  foot: Foot;
  action: StepAction;
  contact: Contact;
  dir: StepDir;
  from: Vec2;
  to: Vec2;
  ctrl: Vec2;
  bendK: number; // 경로를 휜 정도 (0 = 곧은 길)
  pathOk: boolean;
  moveLocal: Vec2; // (옆, 앞뒤) — 착지 뒤 몸 방향 기준
  distance: number; // u
  turn: number;
  headingBefore: number;
  headingAfter: number;
  weightBefore: Foot;
  weightAfter: Foot;
  yawFrom: number;
  yawTo: number;
  pivotFoot: Foot | null; // turn ≠ 0일 때 제자리에서 도는 지지발
  pivotYawFrom: number;
  pivotYawTo: number;
  pelvisTarget: Vec2; // 골반 지지점 S_i
  pelvisFollowFB: number;
  pelvisLimit: number; // 골반 높이 한계 (m). -1 = 다리가 닿지 않음
  stance: number; // 착지 뒤 두 발 간격 (u)
  overlap: number; // 착지 직후 두 발 사각형의 겹침 깊이 (u). 0보다 크면 겹침
  cueKo: string;
  cueEn: string;
  desc: string;
}

export interface FootPose {
  pos: Vec2;
  height: number; // m
  yaw: number; // 도
  heelLift: number; // m
  planted: boolean;
}

export interface Pose {
  beat: number;
  localBeat: number;
  count: string;
  blockIndex: number;
  wall: number;
  heading: number;
  feet: Record<Foot, FootPose>;
  weightR: number;
  supportFoot: Foot;
  pelvis: { pos: Vec2; height: number; yaw: number; roll: number; limit: number };
  current: ResolvedStep | null;
  next: ResolvedStep | null;
  currentIndex: number; // track.steps 안의 순서 (-1 = 아직 없음)
  shift: Vec2; // 루프 반복으로 생긴 평행 이동 (닫힌 동작은 [0, 0])
  rep: number;
}

// ---------- 레슨 (7.6) ----------
export type QuizKind = 'nextFoot' | 'weightFoot' | 'nextSpot' | 'facing' | 'freeAfter';
export type LessonSection =
  | { kind: 'text'; title?: string; markdown: string }
  | { kind: 'demo'; title?: string; exerciseId: string; caption: string }
  | { kind: 'footmap'; title?: string; exerciseId: string; caption: string }
  | { kind: 'stepThrough'; title?: string; exerciseId: string; notes: Record<string, string> }
  | { kind: 'practice'; title?: string; exerciseId: string; tempoSteps: number[]; minLoopsEach: number }
  | { kind: 'checklist'; title?: string; items: string[] }
  | { kind: 'quiz'; title?: string; mode: 'auto'; exerciseId: string; count: number; kinds: QuizKind[] }
  | {
      kind: 'quiz';
      title?: string;
      mode: 'manual';
      question: string;
      choices: string[];
      answer: number;
      explanation: string;
    };

export interface Lesson {
  id: string;
  level: number;
  title: string;
  summary: string;
  goals: string[];
  prerequisites: string[];
  estimatedMinutes: number;
  release: 1 | 2;
  sections: LessonSection[];
}

// ---------- 출처 (7.7) ----------
export interface Source {
  id: string;
  site: string;
  title: string;
  url: string;
  reuse: string;
  checkedAt: string;
}

// ---------- 사용자 데이터 (7.8) ----------
export type ViewMode = 'behind' | 'mirror' | 'top' | 'side' | 'free';
export interface Settings {
  view: ViewMode;
  followPos: boolean;
  followFacing: boolean;
  avatar: 'full' | 'legs' | 'shoes';
  layers: {
    footprints: 'block' | 'next2' | 'off';
    arrows: boolean;
    weight: boolean;
    pelvis: boolean;
    facing: boolean;
    walls: boolean;
    grid: boolean;
  };
  startFoot: Foot;
  mapUp: 'facing' | 'wall12';
  cue: 'ko' | 'en' | 'off';
  click: 'on' | 'noAnd' | 'off';
  largeText: boolean;
  unitM: number;
  audioOffsetMs: number;
  arms: 'swing' | 'hips';
}

export interface LessonProgress {
  completedSections: number[];
  completed: boolean;
  bestBpm?: number;
  quizBest?: number;
  updatedAt: string;
}
export type Progress = Record<string, LessonProgress>;

export interface ReviewNote {
  figureId: string;
  count?: string;
  answer?: string;
  note: string;
  createdAt: string;
}
