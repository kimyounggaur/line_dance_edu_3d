import type { Metadata } from 'next';
import { BASE_FIGURE_IDS, FIGURES } from '@/content';
import { StepPracticeView } from '@/views/StepPracticeView';

export const dynamicParams = false;

export function generateStaticParams() {
  return BASE_FIGURE_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${FIGURES[id]?.nameKo ?? '동작'} 자유 연습` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StepPracticeView id={id} />;
}
