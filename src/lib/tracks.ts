'use client';
// 연습 대상(블록 · 루틴) → 재생용 걸음 목록. 거울 모드용 좌우 반전 목록도 함께 만든다 (8.10).
import { buildTrack, type Track } from '@/engine/track';
import { readyState, type ComposeItem } from '@/engine/compose';
import { DEFAULT_PARAMS, type EngineParams } from '@/engine/constants';
import type { Block, Figure, Foot, Routine } from '@/engine/types';
import { BLOCKS, FIGURES } from '@/content';

export type TrackTarget = { kind: 'block'; block: Block } | { kind: 'routine'; routine: Routine; blocks?: Record<string, Block> };

export interface TrackBundle {
  key: string;
  track: Track;
  mirror: Track;
  target: TrackTarget;
  unitLength: number;
  blockList: Block[];
  figures: Record<string, Figure>;
}

export interface BundleOptions {
  startFoot: Foot;
  loop: boolean;
  repeats?: number;
  params?: EngineParams;
  figures?: Record<string, Figure>;
  figuresVersion?: string;
}

export function targetBlocks(target: TrackTarget): Block[] {
  if (target.kind === 'block') return [target.block];
  const lookup = target.blocks ?? BLOCKS;
  return target.routine.blocks.map((id) => lookup[id]).filter(Boolean);
}

export function targetName(target: TrackTarget): string {
  return target.kind === 'block' ? target.block.nameKo : target.routine.nameKo;
}

export function targetKey(target: TrackTarget): string {
  return target.kind === 'block' ? `b:${target.block.id}:${target.block.figures.join(',')}` : `r:${target.routine.id}:${targetBlocks(target).map((b) => b.figures.join(',')).join('|')}`;
}

const cache = new Map<string, TrackBundle>();

export function buildBundle(target: TrackTarget, opts: BundleOptions): TrackBundle {
  const params = opts.params ?? DEFAULT_PARAMS;
  const key = [targetKey(target), opts.startFoot, opts.loop ? 'loop' : `x${opts.repeats ?? 'n'}`, JSON.stringify(params), opts.figuresVersion ?? 'base'].join('#');
  const hit = cache.get(key);
  if (hit) return hit;
  const figures = opts.figures ?? FIGURES;
  const blockList = targetBlocks(target);
  const items: Omit<ComposeItem, 'unitIndex' | 'wall'>[] = blockList.flatMap((b, bi) => b.figures.map((figureId) => ({ figureId, blockIndex: bi, blockId: b.id })));
  const unitLength = 8 * blockList.length;
  const make = (foot: Foot) =>
    buildTrack({ unit: { items, unitLength }, start: readyState(foot), loop: opts.loop, repeats: opts.repeats }, figures, params);
  const bundle: TrackBundle = {
    key,
    track: make(opts.startFoot),
    mirror: make(opts.startFoot === 'R' ? 'L' : 'R'),
    target,
    unitLength,
    blockList,
    figures,
  };
  cache.set(key, bundle);
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return bundle;
}
