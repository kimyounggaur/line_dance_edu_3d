// 테스트 공통 도우미
import { BLOCKS, FIGURES, ROUTINES } from '@/content';
import { compose, readyState, toBlockLocal, type ComposeItem } from '@/engine/compose';
import { buildTrack, type Track } from '@/engine/track';
import { DEFAULT_PARAMS, type EngineParams } from '@/engine/constants';
import type { Foot, Vec2 } from '@/engine/types';

export const BLOCK_IDS = Object.keys(BLOCKS);
export const ROUTINE_IDS = Object.keys(ROUTINES);

export function blockItems(blockId: string, blockIndex = 0): Omit<ComposeItem, 'unitIndex' | 'wall'>[] {
  return BLOCKS[blockId].figures.map((figureId) => ({ figureId, blockIndex, blockId }));
}

export function routineItems(routineId: string): Omit<ComposeItem, 'unitIndex' | 'wall'>[] {
  return ROUTINES[routineId].blocks.flatMap((bid, bi) => blockItems(bid, bi));
}

export function composeBlock(blockId: string, opts: { startFoot?: Foot; units?: number; params?: EngineParams } = {}) {
  const items: ComposeItem[] = [];
  for (let u = 0; u < (opts.units ?? 1); u++) for (const it of blockItems(blockId)) items.push({ ...it, unitIndex: u, wall: u + 1 });
  return compose(items, readyState(opts.startFoot ?? 'R'), { figures: FIGURES, params: opts.params ?? DEFAULT_PARAMS });
}

export function blockTrack(blockId: string, loop: boolean, opts: { startFoot?: Foot; repeats?: number; params?: EngineParams } = {}): Track {
  return buildTrack(
    { unit: { items: blockItems(blockId), unitLength: 8 }, start: readyState(opts.startFoot ?? 'R'), loop, repeats: opts.repeats },
    FIGURES,
    opts.params ?? DEFAULT_PARAMS,
  );
}

export function routineTrack(routineId: string, loop: boolean, opts: { startFoot?: Foot; repeats?: number } = {}): Track {
  return buildTrack(
    { unit: { items: routineItems(routineId), unitLength: 8 * ROUTINES[routineId].blocks.length }, start: readyState(opts.startFoot ?? 'R'), loop, repeats: opts.repeats },
    FIGURES,
  );
}

/** 걸음 목록의 착지 좌표를 (그 걸음이 속한 블록 인스턴스의) 블록 기준 좌표로 */
export function landingsLocal(res: ReturnType<typeof composeBlock>): Vec2[] {
  return res.steps.map((s) => {
    const b = res.blocks.find((bl) => s.beat >= bl.startBeat - 1e-9 && s.beat < bl.endBeat - 1e-9)!;
    return toBlockLocal(s.to, b);
  });
}

export function expectVec(actual: Vec2, expected: Vec2, tol = 1e-6) {
  const ok = Math.abs(actual[0] - expected[0]) <= tol && Math.abs(actual[1] - expected[1]) <= tol;
  if (!ok) throw new Error(`expected (${expected.join(', ')}) ± ${tol}, got (${actual.map((v) => v.toFixed(4)).join(', ')})`);
}
