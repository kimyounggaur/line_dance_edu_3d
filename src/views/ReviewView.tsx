'use client';
// 검수 모드 (설계문서 8.12, 6.1 '/review'): 강사가 코드를 모르고도 동작을 확인하고 고칠 수 있게.
// ① 보기(카운트별 표 + 3D, 0.25배속, 한 카운트씩) ② 질문 ③ 조정(좌표 0.05u · 회전 · 접지 · 앞뒤 추종, 발자국 끌기) ④ 변형 전환 ⑤ 내보내기
import { useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { Block, Contact, Figure, StepEvent, Vec2 } from '@/engine/types';
import { DEFAULT_PARAMS } from '@/engine/constants';
import { validateBlock, validateFigure, type ValidationIssue } from '@/engine/validate';
import { AppShell } from '@/components/AppShell';
import { FigureStatus, EvidenceTag } from '@/components/DraftBadge';
import { PracticeLayout } from '@/components/PracticeLayout';
import { CountTable } from '@/components/CountTable';
import { Button } from '@/components/ui/button';
import { Field, Segmented, Slider } from '@/components/ui/controls';
import { BASE_FIGURE_IDS, BLOCKS, COMMON_REVIEW_QUESTIONS, CROSS_CHECKS, FIGURES, PRACTICE_BLOCK, REVIEW_VIDEOS, SOURCE_MAP, blockWithVariant, variantsOf } from '@/content';
import { useSettings } from '@/store/settings';
import { useReview } from '@/store/review';
import { useDevParams, useEngineParams, usePracticeSession } from '@/lib/session';
import { player } from '@/lib/player';
import { cn } from '@/lib/cn';

type Mode = 'figure' | 'block';

const CODE_KO: Record<string, string> = {
  V1: '자유발 규칙',
  V2: '시간',
  V3: '착지 충돌',
  V4: '발 경로',
  V5: '다리 도달',
  V6: '보폭 상한',
  V7: '닫힘',
  V8: '벽',
  V9: '반복 가능',
  V10: '반전 가능',
  UNKNOWN: '알 수 없는 id',
};

const round05 = (v: number) => Math.round(v / 0.05) * 0.05;
const fix = (v: number) => Math.round(v * 1000) / 1000;

function figureBlock(fig: Figure): Block {
  const n = Math.max(1, Math.round(8 / fig.beats));
  return { id: `fig~${fig.id}`, nameKo: `${fig.nameKo} 반복`, figures: Array(n).fill(fig.id), level: fig.level };
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <Button size="icon" onClick={() => onChange(fix(round05(value - 0.05)))} aria-label={`${label} 0.05 줄이기`}>
          −
        </Button>
        <input
          type="number"
          step={0.05}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(fix(v));
          }}
          className="h-[var(--btn-h)] w-24 rounded-[8px] border border-line bg-surface px-2 text-center text-lg font-bold tabular-nums"
          aria-label={label}
        />
        <Button size="icon" onClick={() => onChange(fix(round05(value + 0.05)))} aria-label={`${label} 0.05 늘리기`}>
          +
        </Button>
        <span className="ml-1 text-sm text-muted">u</span>
      </div>
    </Field>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  const codes = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];
  const bad = new Set(issues.map((i) => i.code));
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 gap-1">
        {codes.map((c) => (
          <li
            key={c}
            className={cn('flex items-center justify-between gap-1 rounded-[8px] border px-2 py-1 text-[13px]', bad.has(c as never) ? 'border-danger bg-danger-tint font-bold text-danger' : 'border-line text-ink-2')}
          >
            <span className="truncate">
              <strong>{c}</strong> {CODE_KO[c]}
            </span>
            <span className="shrink-0">{bad.has(c as never) ? '실패' : '통과'}</span>
          </li>
        ))}
      </ul>
      {issues.length ? (
        <ul className="list-disc rounded-[8px] border border-danger bg-danger-tint py-2 pl-6 pr-3 text-sm text-danger" role="alert">
          {issues.slice(0, 8).map((i, k) => (
            <li key={k}>
              <strong>{i.code}</strong> {i.message}
            </li>
          ))}
          {issues.length > 8 ? <li>그 밖에 {issues.length - 8}개</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export function ReviewView() {
  const settings = useSettings((s) => s.settings);
  const params = useEngineParams();
  const saved = useReview((s) => s.edits);
  const notes = useReview((s) => s.notes);
  const addNote = useReview((s) => s.addNote);
  const removeNote = useReview((s) => s.removeNote);
  const saveEdit = useReview((s) => s.saveEdit);
  const discardEdit = useReview((s) => s.discardEdit);
  const dev = useDevParams();

  const [mode, setMode] = useState<Mode>('figure');
  const [baseId, setBaseId] = useState<string>('jazzBox');
  const [variantId, setVariantId] = useState<string>('jazzBox');
  const [draft, setDraft] = useState<Figure | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [exportText, setExportText] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const original = FIGURES[variantId];
  const current = draft ?? saved[variantId] ?? original;
  const figures = useMemo(() => ({ ...FIGURES, ...saved, [current.id]: current }), [saved, current]);
  const version = useMemo(() => JSON.stringify(current.events) + Object.keys(saved).join(','), [current, saved]);

  const block: Block = useMemo(() => {
    if (mode === 'figure') return figureBlock(current);
    return blockWithVariant(BLOCKS[PRACTICE_BLOCK[baseId]], baseId, variantId);
  }, [mode, current, baseId, variantId]);

  const figReport = useMemo(() => validateFigure(current, figures, { params }), [current, figures, params]);
  const blockReports = useMemo(() => {
    const pb = BLOCKS[PRACTICE_BLOCK[baseId]];
    const b = blockWithVariant(pb, baseId, variantId);
    return [validateBlock(b, figures, { params, startFoot: 'R' }), validateBlock(b, figures, { params, startFoot: 'L' })];
  }, [baseId, variantId, figures, params]);
  const issues = [...figReport.issues, ...blockReports[0].issues, ...blockReports[1].issues.map((i) => ({ ...i, message: `[왼발 시작] ${i.message}` }))];
  const dedup = issues.filter((i, k) => issues.findIndex((j) => j.message === i.message) === k);
  const ok = dedup.length === 0;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved[variantId] ?? original);

  const spec = useMemo(
    () => ({
      id: `review:${mode}:${variantId}:${settings.startFoot}`,
      target: { kind: 'block' as const, block },
      startFoot: settings.startFoot,
      loop: true,
      bpm: 60,
      countInBeats: 4 as const,
      figures,
      figuresVersion: version,
    }),
    [mode, variantId, settings.startFoot, version, block, figures],
  );
  const { bundle, controls } = usePracticeSession(spec);
  const track = bundle?.track ?? null;
  const first = track?.blocks[0];
  const tableSteps = track && first ? track.steps.filter((s) => s.beat < first.endBeat - 1e-9) : [];
  const failing = new Set(dedup.map((i) => i.count).filter(Boolean) as string[]);
  const selStep = sel !== null ? tableSteps[sel] : null;
  const evIndex = selStep && selStep.figureId === current.id ? selStep.eventIndex : null;
  const ev: StepEvent | null = evIndex !== null ? current.events[evIndex] : null;

  const pick = (base: string, variant?: string) => {
    player.stop();
    setBaseId(base);
    setVariantId(variant ?? base);
    setDraft(null);
    setSel(null);
    setExportText(null);
  };
  const updateEvent = (patch: Partial<StepEvent>) => {
    if (evIndex === null) return;
    const events = current.events.map((e, i) => (i === evIndex ? { ...e, ...patch } : e));
    setDraft({ ...current, events });
  };
  const onDragStep = (stepIndex: number, to: Vec2) => {
    const s = track?.steps[stepIndex];
    if (!s || s.figureInstance !== 0 || s.figureId !== current.id || settings.startFoot !== 'R') return;
    const events = current.events.map((e, i) => (i === s.eventIndex ? { ...e, to: [fix(to[0]), fix(to[1])] as Vec2 } : e));
    setDraft({ ...current, events });
    setSel(tableSteps.findIndex((t) => t.index === stepIndex));
  };

  const exportData = () => ({
    exportedAt: new Date().toISOString(),
    app: '라인댄스 첫걸음 3D — 검수 내보내기',
    note: '검증을 통과한 수정본만 들어 있습니다. 제작자가 src/content/figures/ 에 반영하고 verification을 갱신합니다.',
    figures: saved,
    notes,
  });
  const copy = async () => {
    const text = JSON.stringify(exportData(), null, 2);
    setExportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setMsg('클립보드에 복사했습니다.');
    } catch {
      setMsg('복사가 막혀 있습니다. 아래 상자의 글을 직접 선택해 복사하세요.');
    }
  };
  const download = () => {
    const text = JSON.stringify(exportData(), null, 2);
    setExportText(text);
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `linedance-review-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg('파일로 저장했습니다. 저장이 안 되면 아래 상자의 글을 복사하세요.');
    } catch {
      setMsg('이 화면에서는 파일 저장이 막혀 있습니다. 아래 상자의 글을 복사하세요.');
    }
  };

  const videos = REVIEW_VIDEOS.filter((v) => v.figureIds.includes(variantId) || v.figureIds.includes(baseId));
  const checks = CROSS_CHECKS.filter((c) => c.figureIds.includes(variantId) || c.figureIds.includes(baseId));
  const figNotes = notes.filter((n) => n.figureId === variantId || n.figureId === '공통');

  const left = (
    <div className="flex flex-col gap-5">
      <Field label="볼 것">
        <Segmented
          label="볼 것"
          value={mode}
          onChange={(m) => {
            player.stop();
            setMode(m);
            setSel(null);
          }}
          options={[
            { value: 'figure', label: '동작' },
            { value: 'block', label: '연습 블록' },
          ]}
        />
      </Field>
      <Field label="동작">
        <select
          value={baseId}
          onChange={(e) => pick(e.target.value)}
          className="h-[var(--btn-h)] rounded-[8px] border border-line bg-surface px-2 text-[15px] font-semibold"
          aria-label="동작 고르기"
        >
          {BASE_FIGURE_IDS.map((id) => (
            <option key={id} value={id}>
              {FIGURES[id].nameKo}
              {saved[id] ? ' (수정본)' : ''}
            </option>
          ))}
        </select>
      </Field>
      {variantsOf(baseId).length > 1 ? (
        <Field label="변형 전환">
          <Segmented label="변형" value={variantId} onChange={(v) => pick(baseId, v)} options={variantsOf(baseId).map((v) => ({ value: v.id, label: v.variantLabel ?? '기본형' }))} />
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <FigureStatus figure={current} />
        <EvidenceTag evidence={current.evidence} />
        {saved[variantId] ? <span className="rounded-[6px] border border-ink px-2 py-0.5 text-[13px] font-semibold">수정본 저장됨</span> : null}
      </div>

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="font-bold">걸음 조정 {sel !== null && selStep ? `— ${selStep.count}카운트` : ''}</h2>
        {ev ? (
          <>
            <p className="text-sm text-muted">정준형(오른발 시작) 좌표로 고칩니다. 바꾸는 즉시 다시 합성하고 검증합니다.</p>
            <div className="flex flex-wrap gap-3">
              <Stepper label="x (옆)" value={ev.to?.[0] ?? 0} onChange={(v) => updateEvent({ to: [v, ev.to?.[1] ?? 0] })} />
              <Stepper label="y (앞뒤)" value={ev.to?.[1] ?? 0} onChange={(v) => updateEvent({ to: [ev.to?.[0] ?? 0, v] })} />
            </div>
            <Field label="회전">
              <Segmented
                label="회전"
                value={ev.turn ?? 0}
                onChange={(v) => updateEvent({ turn: v || undefined })}
                options={[
                  { value: -90, label: '왼쪽 1/4' },
                  { value: 0, label: '없음' },
                  { value: 90, label: '오른쪽 1/4' },
                ]}
              />
            </Field>
            <Field label="접지">
              <Segmented
                label="접지"
                value={(ev.contact ?? (ev.action === 'touch' ? 'ball' : 'flat')) as Contact}
                onChange={(v) => updateEvent({ contact: v })}
                options={[
                  { value: 'flat', label: '발바닥' },
                  { value: 'ball', label: '앞꿈치' },
                  { value: 'heel', label: '뒤꿈치' },
                  { value: 'toe', label: '발끝' },
                ]}
              />
            </Field>
            <Field label={`골반 앞뒤 추종 ${(ev.pelvisFollowFB ?? (ev.dir === 'crossBehind' || ev.dir === 'crossFront' ? 0.15 : 1)).toFixed(2)}`}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[ev.pelvisFollowFB ?? (ev.dir === 'crossBehind' || ev.dir === 'crossFront' ? 0.15 : 1)]}
                onValueChange={(v) => updateEvent({ pelvisFollowFB: v[0] })}
                aria-label="골반 앞뒤 추종"
              />
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted">
            아래 카운트별 표에서 {mode === 'figure' ? '' : `${current.nameKo}의 `}걸음을 고르세요.{mode === 'figure' && settings.startFoot === 'R' ? ' 발 위치도에서 첫 번째 동작의 발자국을 끌어도 됩니다.' : ''}
          </p>
        )}
        <IssueList issues={dedup} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!ok || !dirty}
            onClick={() => {
              if (draft) saveEdit(draft);
              setDraft(null);
              setMsg('검증을 통과한 수정본을 저장했습니다.');
            }}
          >
            <Save className="h-4 w-4" />
            수정본 저장
          </Button>
          <Button
            disabled={!draft && !saved[variantId]}
            onClick={() => {
              setDraft(null);
              discardEdit(variantId);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            처음 값으로
          </Button>
        </div>
        {!ok && dirty ? <p className="text-sm font-semibold text-danger">검증에 실패하는 값은 저장되지 않습니다.</p> : null}
      </section>
    </div>
  );

  return (
    <AppShell section="review" wide>
      <div className="mb-3 max-w-[60em]">
        <h1 className="font-display text-[36px] leading-tight">검수 모드</h1>
        <p className="text-ink-2">
          동작마다 0.25배속과 한 카운트씩 보기로 발 접지 · 좌우 · 체중 이동 · 회전이 끝난 방향 · 루프 이음새를 시범과 대조합니다. 질문에 답을 남기고, 필요하면 수치를 고쳐 파일로 내보냅니다.
        </p>
      </div>
      {bundle ? (
        <PracticeLayout
          settings={{ ...settings, mapUp: 'wall12' }}
          controls={controls}
          left={left}
          leftLabel="검수"
          speeds={[1, 0.5, 0.25]}
          tempoSteps={[60, 80]}
          mapProps={{ onDragStep, draggable: (i) => mode === 'figure' && settings.startFoot === 'R' && (track?.steps[i]?.figureInstance ?? 1) === 0 }}
        />
      ) : null}

      {track && first ? (
        <section className="mt-4">
          <h2 className="mb-2 text-lg font-bold">카운트별 표 {mode === 'figure' ? `(${current.nameKo}를 8박 동안 반복)` : `(${block.nameKo})`}</h2>
          <CountTable
            steps={tableSteps}
            block={first}
            selected={sel}
            failing={failing}
            onSelect={(i) => {
              setSel(i);
              player.goTo(track.timing.rest[tableSteps[i].index], 0.5);
            }}
          />
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[14px] border border-line bg-surface p-4">
          <h2 className="mb-3 text-lg font-bold">검수 질문 — {current.nameKo}</h2>
          <ol className="flex flex-col gap-3">
            {[...current.verification.openQuestions.map((q) => ({ q, fig: variantId })), ...COMMON_REVIEW_QUESTIONS.map((c) => ({ q: `${c.question} (현재: ${c.current})`, fig: '공통' }))].map(({ q, fig }, i) => (
              <li key={q} className="flex flex-col gap-1.5">
                <span className="font-semibold">
                  {i + 1}. {q}
                  {fig === '공통' ? <span className="ml-1 text-sm font-normal text-muted">공통</span> : null}
                </span>
                <div className="flex gap-2">
                  <input
                    value={answer[q] ?? ''}
                    onChange={(e) => setAnswer((a) => ({ ...a, [q]: e.target.value }))}
                    placeholder="답 또는 메모"
                    className="h-[var(--btn-h)] min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3"
                    aria-label={`${q} 답`}
                  />
                  <Button
                    disabled={!answer[q]?.trim()}
                    onClick={() => {
                      addNote({ figureId: fig, answer: answer[q].trim(), note: q });
                      setAnswer((a) => ({ ...a, [q]: '' }));
                    }}
                  >
                    남기기
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <span className="font-semibold">카운트 메모 {selStep ? `(${selStep.count}카운트)` : ''}</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder={selStep ? `${selStep.count}카운트에서 본 것` : '표에서 카운트를 고르면 그 카운트에 붙습니다'}
              className="rounded-[8px] border border-line bg-surface p-3"
              aria-label="카운트 메모"
            />
            <Button
              disabled={!memo.trim()}
              onClick={() => {
                addNote({ figureId: variantId, count: selStep?.count, note: memo.trim() });
                setMemo('');
              }}
            >
              메모 남기기
            </Button>
          </div>
          {figNotes.length ? (
            <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
              {figNotes.map((n) => (
                <li key={n.createdAt} className="flex items-start gap-2 rounded-[8px] bg-paper p-2 text-sm">
                  <div className="flex-1">
                    <div className="font-semibold">
                      {n.figureId === '공통' ? '공통' : FIGURES[n.figureId]?.nameKo ?? n.figureId}
                      {n.count ? ` · ${n.count}카운트` : ''}
                    </div>
                    {n.answer ? (
                      <div>
                        <span className="text-muted">{n.note}</span> → <strong>{n.answer}</strong>
                      </div>
                    ) : (
                      <div>{n.note}</div>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" aria-label="메모 지우기" onClick={() => removeNote(n.createdAt)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-[14px] border border-line bg-surface p-4">
            <h2 className="mb-2 text-lg font-bold">내보내기</h2>
            <p className="text-sm text-ink-2">
              저장한 수정본 {Object.keys(saved).length}개와 메모 {notes.length}개를 JSON으로 내보냅니다. 제작자가 반영하고 검수 상태를 바꾸면 그 동작의 ‘검수 전 초안’ 배지가 사라집니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={copy}>
                <Copy className="h-4 w-4" />
                복사
              </Button>
              <Button onClick={download}>
                <Download className="h-4 w-4" />
                파일로 저장
              </Button>
            </div>
            {msg ? (
              <p className="mt-2 text-sm font-semibold" role="status">
                {msg}
              </p>
            ) : null}
            {exportText ? <textarea readOnly value={exportText} rows={8} className="mt-3 w-full rounded-[8px] border border-line bg-paper p-2 font-[ui-monospace,monospace] text-[12px]" aria-label="내보낸 JSON" /> : null}
          </div>
          <div className="rounded-[14px] border border-line bg-surface p-4">
            <h2 className="mb-2 text-lg font-bold">대조 자료</h2>
            <p className="mb-2 text-sm text-muted">외부 링크입니다. 개인 시청 · 열람용으로만 보고, 앱에 넣지 않습니다.</p>
            {videos.length || checks.length ? (
              <ul className="flex flex-col gap-2 text-[15px]">
                {videos.map((v) => (
                  <li key={v.url}>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline">
                      Val Myers 기초 강습 {v.order}번 {v.title}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
                {checks.map((c) => (
                  <li key={c.text}>
                    <span className="text-ink-2">{c.text}</span>
                    <span className="ml-1 inline-flex flex-wrap gap-2">
                      {c.links.map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-ink underline">
                          {l.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">이 동작에 연결된 대조 자료가 없습니다.</p>
            )}
            {current.sources.length ? (
              <div className="mt-3 border-t border-line pt-3 text-sm">
                <div className="font-semibold">폴더 근거</div>
                <ul className="list-disc pl-5 text-ink-2">
                  {current.sources.map((s) => (
                    <li key={s.ref}>
                      {SOURCE_MAP[s.sourceId]?.site ?? s.sourceId}: {s.ref}
                      {s.note ? ` — ${s.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="rounded-[14px] border border-line bg-surface p-4">
            <h2 className="mb-1 text-lg font-bold">골반 값 조정 (개발용)</h2>
            <p className="mb-3 text-sm text-muted">아바타의 움직임을 눈으로 맞출 때 씁니다. 저장되지 않고, 바꾸면 검증을 다시 합니다.</p>
            {(
              [
                ['pelvisGain', '지지발 쪽 비율', 0.5, 0.9, 0.01],
                ['pelvisMaxOff', '최대 이동 (u)', 0.15, 0.45, 0.01],
                ['followCross', '교차 걸음 앞뒤 추종', 0, 0.5, 0.01],
                ['dipDepth', '내려앉음 (m)', 0, 0.03, 0.001],
                ['pelvisBaseH', '기본 높이 (m)', 0.8, 0.88, 0.005],
              ] as const
            ).map(([k, label, min, max, step]) => {
              const v = (dev.overrides[k] ?? DEFAULT_PARAMS[k]) as number;
              return (
                <Field key={k} label={`${label}: ${v.toFixed(step < 0.01 ? 3 : 2)}`}>
                  <Slider min={min} max={max} step={step} value={[v]} onValueChange={(x) => dev.set({ [k]: x[0] })} aria-label={label} />
                </Field>
              );
            })}
            <Button className="mt-2" onClick={dev.reset}>
              초기값으로
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
