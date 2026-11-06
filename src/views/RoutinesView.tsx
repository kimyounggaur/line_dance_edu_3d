'use client';
// 연결 연습 목록 (6.1 '/routines'): 루틴 5종
import { AppShell } from '@/components/AppShell';
import { AppLink } from '@/platform';
import { BLOCKS, ROUTINE_LIST, contentReport } from '@/content';
import { cn } from '@/lib/cn';

const ORDER: Record<string, string> = {
  none: '12시',
  CW: '12시 → 3시 → 6시 → 9시',
  CCW: '12시 → 9시 → 6시 → 3시',
};

export function RoutinesView() {
  const report = contentReport();
  return (
    <AppShell section="routines">
      <div className="mb-5 max-w-[46em]">
        <h1 className="font-display text-[40px] leading-tight">연결 연습</h1>
        <p className="mt-2 text-ink-2">
          기본 동작 블록을 이어 붙인 자체 구성 연습 순서입니다. 블록이 끝났을 때 체중이 없는 발이 다음 블록을 시작합니다. 4벽 루틴은 한 번 출 때마다 1/4씩 돌아 네 번 추면 12시로 돌아옵니다.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {ROUTINE_LIST.map((r) => {
          const ok = report.routines[r.id]?.ok ?? false;
          return (
            <li key={r.id}>
              <AppLink to={{ name: 'routine', id: r.id }} className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-4 no-underline transition-colors hover:border-ink sm:flex-row sm:items-center">
                <div className="sm:w-[220px] sm:shrink-0">
                  <div className="text-sm font-semibold text-muted">Lv{r.level}</div>
                  <h2 className="text-[20px] font-bold leading-tight text-ink">{r.nameKo}</h2>
                  <p className="text-sm text-ink-2">
                    {r.blocks.length * 8}카운트, {r.walls}벽
                  </p>
                </div>
                <ol className="flex flex-1 flex-wrap items-center gap-1.5" aria-label="블록 순서">
                  {r.blocks.map((b, i) => (
                    <li key={`${b}-${i}`} className="flex items-center gap-1.5">
                      <span className="rounded-[8px] border border-line bg-paper px-2 py-1 text-[14px] font-semibold text-ink">{BLOCKS[b]?.nameKo ?? b}</span>
                      {i < r.blocks.length - 1 ? <span aria-hidden className="text-muted">›</span> : null}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
                  <span className="text-sm text-ink-2">{ORDER[r.rotation]}</span>
                  <span className={cn('text-[13px] font-semibold', ok ? 'text-ok' : 'text-danger')}>{ok ? '검증 통과' : '검증 실패'}</span>
                </div>
              </AppLink>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
