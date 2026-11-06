'use client';
// 미리보기 단일 페이지용 플랫폼 구현: #해시 경로 · React.lazy로 3D 무대를 나중에 불러온다
import * as React from 'react';
import { hashOf, type Route } from './types';
import type { StageProps } from '@/render3d/types';

export const PLATFORM = 'spa' as const;

export function AppLink({ to, className, children, onClick, ...rest }: { to: Route; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a
      href={hashOf(to)}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) window.scrollTo(0, 0);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function useNavigate(): (to: Route) => void {
  return React.useCallback((to: Route) => {
    window.location.hash = hashOf(to);
    window.scrollTo(0, 0);
  }, []);
}

export function useCurrentPath(): string {
  const [h, setH] = React.useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  React.useEffect(() => {
    const on = () => setH(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return h;
}

const StageLazy = React.lazy(() => import('@/render3d/Stage'));

export function Stage3D(props: StageProps) {
  return (
    <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center bg-floor text-muted">3D 무대를 불러오는 중…</div>}>
      <StageLazy {...props} />
    </React.Suspense>
  );
}
