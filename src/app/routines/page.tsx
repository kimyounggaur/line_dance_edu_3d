import type { Metadata } from 'next';
import { RoutinesView } from '@/views/RoutinesView';

export const metadata: Metadata = { title: '연결 연습' };

export default function Page() {
  return <RoutinesView />;
}
