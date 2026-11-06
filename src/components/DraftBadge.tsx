// 검수 전 초안 배지 (설계문서 7.7, 6.9 — 노랑 + 글자)
import { cn } from '@/lib/cn';
import type { Evidence, Figure } from '@/engine/types';

export function DraftBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[6px] border border-draft bg-draft-tint px-2 py-0.5 text-[13px] font-semibold text-[#7a4a00]', className)}
      title="강사 검수를 거치기 전의 초기값입니다. 교재에 따라 다를 수 있습니다."
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-draft" />
      {compact ? '초안' : '검수 전 초안'}
    </span>
  );
}

export function FigureStatus({ figure, className }: { figure: Figure; className?: string }) {
  if (figure.verification.status === 'verified') {
    return <span className={cn('rounded-[6px] border border-ok px-2 py-0.5 text-[13px] font-semibold text-ok', className)}>검수 완료</span>;
  }
  return <DraftBadge className={className} />;
}

const EVIDENCE_KO: Record<Evidence, string> = { strong: '근거 강함', medium: '근거 보통', weak: '근거 약함' };

export function EvidenceTag({ evidence }: { evidence: Evidence }) {
  return (
    <span
      className={cn(
        'rounded-[6px] border px-2 py-0.5 text-[13px] font-semibold',
        evidence === 'weak' ? 'border-line-strong text-ink-2' : 'border-line text-muted',
      )}
      title="폴더 자료의 근거 수준 (설계문서 2.2)"
    >
      {EVIDENCE_KO[evidence]}
    </span>
  );
}
