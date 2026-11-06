'use client';
// 출처 · 이용 안내 (6.1 '/sources', 2.5의 원칙, 13장 결정 12: 사이트 단위 링크만)
import { ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { DraftBadge, EvidenceTag } from '@/components/DraftBadge';
import { BASE_FIGURE_IDS, FIGURES, SOURCES, TERMS_LINKS } from '@/content';

const PRINCIPLES: [string, string][] = [
  ['자체 제작', '설명문 · 그림 · 3D 동작 · 소리는 모두 새로 만들었습니다. 출처의 정의 원문 · 스텝시트 본문 · 영상 · 음악 · 이미지는 넣지 않았습니다.'],
  ['링크만', '출처는 새 탭으로 여는 외부 링크로만 보여 줍니다. 임베드 · 내려받기 · 화면 캡처는 하지 않습니다.'],
  ['남의 안무를 재현하지 않음', '앱의 루틴은 기본 동작을 이어 붙인 자체 구성 연습용입니다.'],
  ['영상에서 동작을 뽑지 않음', '수집한 영상으로 모션을 추출하거나 학습시키지 않습니다. 검수는 동의받은 강사의 새 시범으로 합니다.'],
  ['음악', '상업 음원을 넣지 않습니다. 클릭음만 씁니다.'],
  ['상태 표시', '모든 동작에 근거 수준과 검수 상태를 표시합니다.'],
];

export function SourcesView() {
  return (
    <AppShell section="sources">
      <h1 className="mb-2 font-display text-[40px] leading-tight">출처 · 이용 안내</h1>
      <p className="mb-6 max-w-[46em] text-ink-2">
        이 앱의 발 자리 · 체중 · 카운트 수치는 참고 자료에 없는 값을 널리 쓰이는 스텝 정의로 새로 설계한 초기값입니다. 참고 자료는 동작의 이름 · 박자 · 방향과 학습 순서를 확인하는 데만 썼습니다.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[14px] border border-line bg-surface p-5">
          <h2 className="mb-3 text-xl font-bold">앱의 여섯 가지 원칙</h2>
          <ol className="flex flex-col gap-3">
            {PRINCIPLES.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="font-display text-[24px] leading-none text-muted">{i + 1}</span>
                <span>
                  <strong>{t}.</strong> <span className="text-ink-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-[14px] border border-line bg-surface p-5">
          <h2 className="mb-3 text-xl font-bold">검수 상태</h2>
          <p className="mb-3 text-ink-2">
            <DraftBadge className="mr-1" /> 표시가 붙은 동작은 강사 검수를 거치기 전의 값입니다. 검수 모드에서 강사가 질문에 답하고 수치를 고쳐 내보내면, 제작자가 반영한 뒤 표시를 뗍니다.
          </p>
          <ul className="flex flex-col gap-2">
            {BASE_FIGURE_IDS.map((id) => {
              const f = FIGURES[id];
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                  <span className="min-w-[9em] font-semibold">{f.nameKo}</span>
                  <EvidenceTag evidence={f.evidence} />
                  <span className="text-sm text-muted">{f.verification.status === 'verified' ? '검수 완료' : '검수 전 초안'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <section className="mt-6 rounded-[14px] border border-line bg-surface p-5">
        <h2 className="mb-1 text-xl font-bold">참고 출처</h2>
        <p className="mb-4 text-sm text-muted">자료 확인일 2026-11-05. 각 사이트의 이용조건 요지와 이 앱에서의 처리입니다(법률 자문이 아닙니다).</p>
        <ul className="flex flex-col divide-y divide-line">
          {SOURCES.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 py-3 md:flex-row md:gap-6">
              <div className="md:w-[300px] md:shrink-0">
                <div className="text-sm font-semibold text-muted">{s.site}</div>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-ink underline">
                  {s.title}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-[15px] text-ink-2">{s.reuse}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-sm">
          <span className="text-muted">이용조건 확인처</span>
          {TERMS_LINKS.map((t) => (
            <a key={t.url} href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline">
              {t.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
