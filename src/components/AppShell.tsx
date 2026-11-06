'use client';
// 공통 머리말 · 꼬리말. 저장된 설정 · 진도를 불러오고 큰 글씨 모드를 적용한다.
import { useEffect, type ReactNode } from 'react';
import { BookOpen, Footprints, HelpCircle, Link2, Settings as Gear, Waypoints } from 'lucide-react';
import { AppLink } from '@/platform';
import type { Route } from '@/platform/types';
import { useSettings } from '@/store/settings';
import { useProgress } from '@/store/progress';
import { useReview } from '@/store/review';
import { cn } from '@/lib/cn';

export type Section = 'home' | 'steps' | 'routines' | 'review' | 'settings' | 'help' | 'sources' | 'none';

const NAV: { section: Section; to: Route; label: string; icon: ReactNode }[] = [
  { section: 'home', to: { name: 'home' }, label: '학습 지도', icon: <BookOpen className="h-[18px] w-[18px]" /> },
  { section: 'steps', to: { name: 'steps' }, label: '스텝 사전', icon: <Footprints className="h-[18px] w-[18px]" /> },
  { section: 'routines', to: { name: 'routines' }, label: '연결 연습', icon: <Waypoints className="h-[18px] w-[18px]" /> },
  { section: 'help', to: { name: 'help' }, label: '도움말', icon: <HelpCircle className="h-[18px] w-[18px]" /> },
  { section: 'settings', to: { name: 'settings' }, label: '설정', icon: <Gear className="h-[18px] w-[18px]" /> },
];

export function useHydrateStores() {
  const hs = useSettings((s) => s.hydrate);
  const hp = useProgress((s) => s.hydrate);
  const hr = useReview((s) => s.hydrate);
  useEffect(() => {
    hs();
    hp();
    hr();
  }, [hs, hp, hr]);
}

export function AppShell({ section, children, wide }: { section: Section; children: ReactNode; wide?: boolean }) {
  useHydrateStores();
  const large = useSettings((s) => s.settings.largeText);
  useEffect(() => {
    document.documentElement.classList.toggle('large-text', large);
  }, [large]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        본문으로 건너뛰기
      </a>
      <header className="border-b border-line bg-surface">
        <div className={cn('mx-auto flex flex-col gap-x-6 gap-y-1 px-4 py-2 md:flex-row md:items-center', wide ? 'max-w-[1720px]' : 'max-w-[1200px]')}>
          <AppLink to={{ name: 'home' }} className="flex items-center gap-2 py-1 no-underline">
            <Logo />
            <span className="font-display text-[22px] leading-none text-ink">라인댄스 첫걸음 3D</span>
          </AppLink>
          <nav aria-label="주 메뉴" className="-mx-1 flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5">
            {NAV.map((n) => (
              <AppLink
                key={n.section}
                to={n.to}
                aria-current={n.section === section ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-[var(--btn-h)] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-[15px] font-semibold no-underline',
                  n.section === section ? 'bg-ink text-white' : 'text-ink-2 hover:bg-ink/[0.06]',
                )}
              >
                {n.icon}
                {n.label}
              </AppLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className={cn('mx-auto w-full flex-1 px-3 py-4 sm:px-4', wide ? 'max-w-[1720px]' : 'max-w-[1200px]')}>
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className={cn('mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-sm text-muted', wide ? 'max-w-[1720px]' : 'max-w-[1200px]')}>
          <span>동작 설명 · 그림 · 3D 동작 · 소리는 모두 자체 제작입니다. 모든 동작은 강사 검수 전 초안입니다.</span>
          <AppLink to={{ name: 'sources' }} className="inline-flex items-center gap-1 font-semibold text-ink-2">
            <Link2 className="h-4 w-4" />
            출처 · 이용 안내
          </AppLink>
          <AppLink to={{ name: 'review' }} className="font-semibold text-ink-2">
            검수 모드
          </AppLink>
        </div>
      </footer>
    </div>
  );
}

/** 로고: 두 발자국 (왼발 디딤 ● · 오른발 터치 ○) */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <rect x="6" y="9" width="7" height="17" rx="3.5" fill="#2563EB" />
      <rect x="18.5" y="5" width="7" height="17" rx="3.5" fill="none" stroke="#EA580C" strokeWidth="2.4" />
    </svg>
  );
}
