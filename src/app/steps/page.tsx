import type { Metadata } from 'next';
import { StepsView } from '@/views/StepsView';

export const metadata: Metadata = { title: '스텝 사전' };

export default function Page() {
  return <StepsView />;
}
