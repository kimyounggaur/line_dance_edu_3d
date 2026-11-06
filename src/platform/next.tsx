'use client';
// Next.js 앱용 플랫폼 구현: next/link · next/navigation · 브라우저에서만 불러오는 3D 무대 (설계문서 8.10)
import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { pathOf, type Route } from './types';
import type { StageProps } from '@/render3d/types';

export const PLATFORM = 'next' as const;

export function AppLink({ to, className, children, ...rest }: { to: Route; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link href={pathOf(to)} className={className} {...rest}>
      {children}
    </Link>
  );
}

export function useNavigate(): (to: Route) => void {
  const router = useRouter();
  return React.useCallback((to: Route) => router.push(pathOf(to)), [router]);
}

export function useCurrentPath(): string {
  return usePathname() ?? '/';
}

const StageDynamic = dynamic(() => import('@/render3d/Stage'), {
  ssr: false,
  loading: () => <StageLoading />,
});

function StageLoading() {
  return <div className="flex h-full w-full items-center justify-center bg-floor text-muted">3D 무대를 불러오는 중…</div>;
}

export function Stage3D(props: StageProps) {
  return <StageDynamic {...props} />;
}
