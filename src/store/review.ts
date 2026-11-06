'use client';
// 검수 메모와 검증을 통과한 수정본 (설계문서 8.12, 7.8). 키 ld.review.v1
import { create } from 'zustand';
import type { Figure, ReviewNote } from '@/engine/types';
import { KEYS, loadJSON, removeKey, saveJSON } from '@/lib/storage';

interface ReviewData {
  notes: ReviewNote[];
  edits: Record<string, Figure>; // 검증을 통과한 수정본만 저장된다
}

interface ReviewStore extends ReviewData {
  hydrated: boolean;
  hydrate(): void;
  addNote(note: Omit<ReviewNote, 'createdAt'>): void;
  removeNote(createdAt: string): void;
  saveEdit(fig: Figure): void;
  discardEdit(figureId: string): void;
  reset(): void;
}

export const useReview = create<ReviewStore>((set, get) => {
  const persist = (d: Partial<ReviewData>) => {
    const next: ReviewData = { notes: d.notes ?? get().notes, edits: d.edits ?? get().edits };
    saveJSON(KEYS.review, next);
    set(next);
  };
  return {
    notes: [],
    edits: {},
    hydrated: false,
    hydrate() {
      if (get().hydrated) return;
      const d = loadJSON<ReviewData>(KEYS.review, { notes: [], edits: {} });
      set({ notes: d.notes ?? [], edits: d.edits ?? {}, hydrated: true });
    },
    addNote(note) {
      persist({ notes: [...get().notes, { ...note, createdAt: new Date().toISOString() }] });
    },
    removeNote(createdAt) {
      persist({ notes: get().notes.filter((n) => n.createdAt !== createdAt) });
    },
    saveEdit(fig) {
      persist({ edits: { ...get().edits, [fig.id]: fig } });
    },
    discardEdit(figureId) {
      const edits = { ...get().edits };
      delete edits[figureId];
      persist({ edits });
    },
    reset() {
      removeKey(KEYS.review);
      set({ notes: [], edits: {} });
    },
  };
});
