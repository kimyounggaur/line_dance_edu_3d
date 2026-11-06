// 콘텐츠 레지스트리 — JSON을 한곳에서 불러와 타입을 붙인다 (설계문서 7.2 ~ 7.7).
// 문구와 수치는 JSON만 고치면 된다(1.2). 이 파일은 목록만 관리한다.
import type { Block, Exercise, Figure, Lesson, Routine, Source } from '@/engine/types';
import { validateContent, type ContentReport } from '@/engine/validate';
import { DEFAULT_PARAMS, type EngineParams } from '@/engine/constants';

import markTime from './figures/markTime.json';
import sideTouch from './figures/sideTouch.json';
import vine from './figures/vine.json';
import jazzBox from './figures/jazzBox.json';
import vStep from './figures/vStep.json';
import coaster from './figures/coaster.json';
import vineQuarter from './figures/vineQuarter.json';
import jazzBoxQuarter from './figures/jazzBoxQuarter.json';
import jazzBoxTogether from './figures/jazzBoxTogether.json';
import jazzBoxQuarterOn2 from './figures/jazzBoxQuarterOn2.json';
import sideTouchFwd from './figures/sideTouchFwd.json';

import blocksJson from './blocks.json';
import routinesJson from './routines.json';
import sourcesJson from './sources.json';
import reviewQuestionsJson from './reviewQuestions.json';

import b0demo from './exercises/b0-demo-60.json';
import b0loop from './exercises/b0-loop.json';
import b1demo from './exercises/b1-demo-60.json';
import b1loop from './exercises/b1-loop.json';
import b2demo from './exercises/b2-demo-60.json';
import b2loop from './exercises/b2-loop.json';
import b3demo from './exercises/b3-demo-60.json';
import b3loop from './exercises/b3-loop.json';
import b4demo from './exercises/b4-demo-60.json';
import b4loop from './exercises/b4-loop.json';
import b5demo from './exercises/b5-demo-60.json';
import b5loop from './exercises/b5-loop.json';
import b6demo from './exercises/b6-demo.json';
import b6loop from './exercises/b6-loop.json';
import b7demo from './exercises/b7-demo.json';
import b7loop from './exercises/b7-loop.json';
import ra16demo from './exercises/r-a16-demo.json';
import ra16 from './exercises/r-a16.json';
import rb32 from './exercises/r-b32.json';
import rc32 from './exercises/r-c32.json';
import re16 from './exercises/r-e16.json';
import rd32 from './exercises/r-d32.json';

import lv00 from './lessons/ko/lv00-ready.json';
import lv01 from './lessons/ko/lv01-step-touch.json';
import lv02 from './lessons/ko/lv02-vine.json';
import lv03 from './lessons/ko/lv03-jazz-box.json';
import lv04 from './lessons/ko/lv04-v-step.json';
import lv05 from './lessons/ko/lv05-coaster.json';
import lv06 from './lessons/ko/lv06-linking.json';
import lv07 from './lessons/ko/lv07-walls.json';

const asFigure = (x: unknown) => x as Figure;

/** 기본 동작 8종 (스텝 사전에 보이는 순서) */
export const BASE_FIGURE_IDS = ['markTime', 'sideTouch', 'vine', 'jazzBox', 'vStep', 'coaster', 'vineQuarter', 'jazzBoxQuarter'] as const;

export const FIGURES: Record<string, Figure> = Object.fromEntries(
  [markTime, sideTouch, vine, jazzBox, vStep, coaster, vineQuarter, jazzBoxQuarter, jazzBoxTogether, jazzBoxQuarterOn2, sideTouchFwd]
    .map(asFigure)
    .map((f) => [f.id, f]),
);

export const BLOCK_LIST = blocksJson as Block[];
export const BLOCKS: Record<string, Block> = Object.fromEntries(BLOCK_LIST.map((b) => [b.id, b]));
export const ROUTINE_LIST = routinesJson as Routine[];
export const ROUTINES: Record<string, Routine> = Object.fromEntries(ROUTINE_LIST.map((r) => [r.id, r]));

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(
  [b0demo, b0loop, b1demo, b1loop, b2demo, b2loop, b3demo, b3loop, b4demo, b4loop, b5demo, b5loop, b6demo, b6loop, b7demo, b7loop, ra16demo, ra16, rb32, rc32, re16, rd32]
    .map((e) => e as unknown as Exercise)
    .map((e) => [e.id, e]),
);

export const LESSONS: Lesson[] = [lv00, lv01, lv02, lv03, lv04, lv05, lv06, lv07]
  .map((l) => l as unknown as Lesson)
  .sort((a, b) => a.level - b.level);
export const LESSON_MAP: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

export interface ReviewVideo {
  order: number;
  title: string;
  url: string;
  figureIds: string[];
}
export interface CrossCheck {
  text: string;
  figureIds: string[];
  links: { label: string; url: string }[];
}
export const SOURCES = sourcesJson.sources as Source[];
export const SOURCE_MAP: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
export const TERMS_LINKS = sourcesJson.termsLinks as { label: string; url: string }[];
export const REVIEW_VIDEOS = sourcesJson.reviewVideos as ReviewVideo[];
export const CROSS_CHECKS = sourcesJson.crossChecks as CrossCheck[];
export const COMMON_REVIEW_QUESTIONS = reviewQuestionsJson.common as { question: string; current: string }[];

/** 동작 → 연습 블록 (5.3 · 5.5) */
export const PRACTICE_BLOCK: Record<string, string> = {
  markTime: 'B0-markTime',
  sideTouch: 'B1-stepTouch',
  vine: 'B2-vine',
  jazzBox: 'B3-jazzBox',
  vStep: 'B4-vStep',
  coaster: 'B5-coaster',
  vineQuarter: 'B6-vineQuarter',
  jazzBoxQuarter: 'B7-jazzQuarter',
};

/** 동작의 변형 목록 (자기 자신 포함, 기본형이 먼저) */
export function variantsOf(baseId: string): Figure[] {
  const base = FIGURES[baseId];
  if (!base) return [];
  return [base, ...Object.values(FIGURES).filter((f) => f.variantOf === baseId)];
}

/** 블록 안의 기본 동작을 변형으로 바꾼 블록 */
export function blockWithVariant(block: Block, baseId: string, variantId: string): Block {
  if (baseId === variantId) return block;
  return { ...block, id: `${block.id}~${variantId}`, figures: block.figures.map((f) => (f === baseId ? variantId : f)) };
}

let reportCache: { key: string; report: ContentReport } | null = null;

/** 콘텐츠 검증 결과 (보폭 단위마다 한 번 계산) */
export function contentReport(params: EngineParams = DEFAULT_PARAMS): ContentReport {
  const key = JSON.stringify(params);
  if (reportCache?.key === key) return reportCache.report;
  const report = validateContent({ figures: FIGURES, blocks: BLOCKS, routines: ROUTINES }, { params });
  reportCache = { key, report };
  return report;
}

export function isDraft(f: Figure): boolean {
  return f.verification.status !== 'verified';
}
