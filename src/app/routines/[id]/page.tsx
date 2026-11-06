import type { Metadata } from 'next';
import { ROUTINE_LIST, ROUTINES } from '@/content';
import { RoutinePracticeView } from '@/views/RoutinePracticeView';

export const dynamicParams = false;

export function generateStaticParams() {
  return ROUTINE_LIST.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: ROUTINES[id]?.nameKo ?? '연결 연습' };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoutinePracticeView id={id} />;
}
