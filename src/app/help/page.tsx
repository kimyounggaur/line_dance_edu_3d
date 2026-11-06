import type { Metadata } from 'next';
import { HelpView } from '@/views/HelpView';

export const metadata: Metadata = { title: '도움말' };

export default function Page() {
  return <HelpView />;
}
