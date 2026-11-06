'use client';
import { AppShell } from '@/components/AppShell';
import { AppLink } from '@/platform';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundView() {
  return (
    <AppShell section="none">
      <div className="mx-auto flex max-w-[560px] flex-col items-start gap-4 py-16">
        <p className="font-display text-[64px] leading-none text-muted">5 · 6 · 7 · 8</p>
        <h1 className="text-2xl font-bold">없는 주소입니다</h1>
        <p className="text-ink-2">주소가 바뀌었거나 잘못 입력되었습니다. 학습 지도에서 레슨을 고르거나 스텝 사전에서 동작을 찾으세요.</p>
        <div className="flex flex-wrap gap-2">
          <AppLink to={{ name: 'home' }} className={buttonVariants({ variant: 'primary' })}>
            학습 지도로
          </AppLink>
          <AppLink to={{ name: 'steps' }} className={buttonVariants({ variant: 'outline' })}>
            스텝 사전
          </AppLink>
        </div>
      </div>
    </AppShell>
  );
}
