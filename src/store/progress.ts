'use client';
// 진도 스토어 (설계문서 7.8). 키 ld.progress.v1, 마지막 레슨 ld.last.v1
import { create } from 'zustand';
import type { LessonProgress, Progress } from '@/engine/types';
import { KEYS, loadJSON, removeKey, saveJSON } from '@/lib/storage';

export interface LastVisit {
  lessonId: string;
  section: number;
}

interface ProgressStore {
  progress: Progress;
  last: LastVisit | null;
  hydrated: boolean;
  hydrate(): void;
  completeSection(lessonId: string, index: number): void;
  completeLesson(lessonId: string): void;
  recordBpm(lessonId: string, bpm: number): void;
  recordQuiz(lessonId: string, score: number): void;
  visit(lessonId: string, section: number): void;
  reset(): void;
}

const now = () => new Date().toISOString();
const blank = (): LessonProgress => ({ completedSections: [], completed: false, updatedAt: now() });

export const useProgress = create<ProgressStore>((set, get) => {
  const update = (lessonId: string, fn: (p: LessonProgress) => LessonProgress) => {
    const cur = get().progress[lessonId] ?? blank();
    const progress = { ...get().progress, [lessonId]: { ...fn(cur), updatedAt: now() } };
    saveJSON(KEYS.progress, progress);
    set({ progress });
  };
  return {
    progress: {},
    last: null,
    hydrated: false,
    hydrate() {
      if (get().hydrated) return;
      set({ progress: loadJSON<Progress>(KEYS.progress, {}), last: loadJSON<LastVisit | null>(KEYS.last, null), hydrated: true });
    },
    completeSection(lessonId, index) {
      update(lessonId, (p) => (p.completedSections.includes(index) ? p : { ...p, completedSections: [...p.completedSections, index].sort((a, b) => a - b) }));
    },
    completeLesson(lessonId) {
      update(lessonId, (p) => ({ ...p, completed: true }));
    },
    recordBpm(lessonId, bpm) {
      update(lessonId, (p) => ({ ...p, bestBpm: Math.max(p.bestBpm ?? 0, bpm) }));
    },
    recordQuiz(lessonId, score) {
      update(lessonId, (p) => ({ ...p, quizBest: Math.max(p.quizBest ?? 0, score) }));
    },
    visit(lessonId, section) {
      const last = { lessonId, section };
      saveJSON(KEYS.last, last);
      set({ last });
    },
    reset() {
      removeKey(KEYS.progress);
      removeKey(KEYS.last);
      set({ progress: {}, last: null });
    },
  };
});
