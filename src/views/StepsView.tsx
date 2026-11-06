'use client';
// 스텝 사전 (6.1 '/steps'): 동작마다 발 위치도 · 구령 · 길이 · 근거 · 검수 상태. 고르면 자유 연습으로
import { AppShell } from '@/components/AppShell';
import { EvidenceTag, FigureStatus } from '@/components/DraftBadge';
import { StaticFootmap } from '@/components/StaticFootmap';
import { AppLink } from '@/platform';
import { BASE_FIGURE_IDS, FIGURES, variantsOf } from '@/content';
import type { Figure } from '@/engine/types';

const LEVEL_NOTE: Record<number, string> = { 0: '준비', 7: '방향 전환' };

export function cueLine(f: Figure): string {
  return f.events.map((e) => e.cueKo).join(' · ');
}

export function StepsView() {
  return (
    <AppShell section="steps">
      <div className="mb-5 max-w-[46em]">
        <h1 className="font-display text-[40px] leading-tight">스텝 사전</h1>
        <p className="mt-2 text-ink-2">
          동작을 고르면 그 동작의 8카운트 연습 블록을 자유롭게 연습합니다. 그림은 오른발로 시작할 때(체중 왼발) 위에서 본 발자국입니다. 채운 발자국은 디딤, 빈 발자국은 터치, 점선은 홈입니다.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {BASE_FIGURE_IDS.map((id) => {
          const f = FIGURES[id];
          const variants = variantsOf(id).length - 1;
          return (
            <li key={id}>
              <AppLink
                to={{ name: 'step', id }}
                className="flex h-full gap-4 rounded-[14px] border border-line bg-surface p-3 no-underline transition-colors hover:border-ink"
              >
                <StaticFootmap figureIds={[id]} figures={FIGURES} className="w-[132px] shrink-0 self-start" title={`${f.nameKo} 발 위치도`} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className="text-[20px] font-bold leading-tight text-ink">{f.nameKo}</h2>
                    <span className="text-sm text-muted">{f.nameEn}</span>
                  </div>
                  <p className="font-display text-[22px] leading-tight text-ink">{cueLine(f)}</p>
                  <p className="text-sm text-ink-2">
                    {f.beats}박에 {f.events.length}걸음{f.events.some((e) => e.t % 1 !== 0) ? ", '&' 카운트 포함" : ''}
                    {f.events.some((e) => e.turn) ? ', 1/4 회전' : ''}
                    {LEVEL_NOTE[f.level] ? `, ${LEVEL_NOTE[f.level]}` : ''}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="rounded-[6px] bg-paper px-2 py-0.5 text-[13px] font-semibold text-ink-2">Lv{f.level}</span>
                    <FigureStatus figure={f} />
                    <EvidenceTag evidence={f.evidence} />
                    {variants ? <span className="text-[13px] text-muted">변형 {variants}개</span> : null}
                  </div>
                </div>
              </AppLink>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
