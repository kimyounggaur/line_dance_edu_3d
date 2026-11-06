import type { Metadata } from 'next';
import { SourcesView } from '@/views/SourcesView';

export const metadata: Metadata = { title: '출처 · 이용 안내' };

export default function Page() {
  return <SourcesView />;
}
