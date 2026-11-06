import type { Metadata } from 'next';
import { ReviewView } from '@/views/ReviewView';

export const metadata: Metadata = { title: '검수 모드' };

export default function Page() {
  return <ReviewView />;
}
