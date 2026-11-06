import type { Metadata } from 'next';
import { LESSONS, LESSON_MAP } from '@/content';
import { LessonView } from '@/views/LessonView';

export const dynamicParams = false;

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = LESSON_MAP[id];
  return { title: l ? `Lv${l.level} ${l.title}` : '레슨' };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonView id={id} />;
}
