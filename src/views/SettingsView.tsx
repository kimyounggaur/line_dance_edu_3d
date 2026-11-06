'use client';
// 설정 (6.1 '/settings'): 시점 기본값 · 큰 글씨 · 클릭음 · 지연 보정 · 구령 표기 · 보폭 · 데이터 초기화
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ViewOptions } from '@/components/ViewOptions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger, Field, Segmented, Slider } from '@/components/ui/controls';
import { useSettings } from '@/store/settings';
import { useProgress } from '@/store/progress';
import { useReview } from '@/store/review';
import { contentReport } from '@/content';
import { DEFAULT_PARAMS, UNIT_RANGE } from '@/engine/constants';
import { player } from '@/lib/player';
import { storageAvailable } from '@/lib/storage';

function LatencyHelper() {
  const offset = useSettings((s) => s.settings.audioOffsetMs);
  const set = useSettings((s) => s.set);
  const dot = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const start = () => {
    const times = player.calibrationClicks(16, 0.6);
    if (!times.length) return;
    setRunning(true);
    const end = times[times.length - 1] + 0.4;
    const loop = () => {
      const t = player.audioTimeNow() - offset / 1000;
      const near = times.some((c) => t >= c && t < c + 0.12);
      if (dot.current) dot.current.style.opacity = near ? '1' : '0.12';
      if (t < end) raf.current = requestAnimationFrame(loop);
      else setRunning(false);
    };
    raf.current = requestAnimationFrame(loop);
  };
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-4">
      <div className="flex items-center gap-4">
        <div ref={dot} className="h-14 w-14 shrink-0 rounded-full bg-ink" style={{ opacity: 0.12 }} aria-hidden />
        <p className="text-ink-2">
          블루투스 스피커처럼 소리가 늦게 나면 화면의 발이 소리보다 먼저 닿습니다. 버튼을 누르면 클릭 16번에 맞춰 원이 깜빡입니다. 원이 소리보다 먼저 깜빡이면 값을 올리세요.
        </p>
      </div>
      <Field label={`지연 보정: ${offset} ms`}>
        <Slider min={-100} max={400} step={10} value={[offset]} onValueChange={(v) => set('audioOffsetMs', v[0])} aria-label="지연 보정 (ms)" />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" onClick={start} disabled={running}>
          {running ? '맞추는 중…' : '박자 맞추기 시작'}
        </Button>
        <Button onClick={() => set('audioOffsetMs', 0)}>0으로</Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const s = useSettings((st) => st.settings);
  const set = useSettings((st) => st.set);
  const resetSettings = useSettings((st) => st.reset);
  const resetProgress = useProgress((st) => st.reset);
  const resetReview = useReview((st) => st.reset);
  const [unitDraft, setUnitDraft] = useState(s.unitM);
  useEffect(() => setUnitDraft(s.unitM), [s.unitM]);
  const unitReport = contentReport({ ...DEFAULT_PARAMS, unitM: unitDraft });
  const unitOk = Object.values(unitReport.blocks).every((b) => b.ok);
  const minLimit = Math.min(...Object.values(unitReport.blocks).map((b) => b.metrics.minPelvisLimit));
  const [done, setDone] = useState<string | null>(null);
  // 저장소 확인은 브라우저에서만 (서버에서 미리 그린 글과 달라지지 않게)
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => setStorageOk(storageAvailable()), []);

  return (
    <AppShell section="settings">
      <h1 className="mb-1 font-display text-[40px] leading-tight">설정</h1>
      <p className="mb-6 text-ink-2">이 기기에만 저장됩니다{storageOk ? '' : ' (지금은 저장소를 쓸 수 없어 이 창을 닫으면 사라집니다)'}.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[14px] border border-line bg-surface p-5">
          <h2 className="mb-4 text-xl font-bold">보기 기본값</h2>
          <ViewOptions />
          <div className="mt-5">
            <Field label="팔 동작">
              <Segmented
                label="팔 동작"
                value={s.arms}
                onChange={(v) => set('arms', v)}
                options={[
                  { value: 'swing', label: '편하게 내림' },
                  { value: 'hips', label: '손 허리' },
                ]}
              />
            </Field>
          </div>
        </section>
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-xl font-bold">소리와 화면 맞추기</h2>
            <LatencyHelper />
          </section>
          <section className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="mb-1 text-xl font-bold">보폭 단위</h2>
            <p className="mb-3 text-ink-2">
              옆으로 한 걸음(1u)의 길이입니다. 발 크기는 그대로라 바꾸면 다시 검증합니다. 검산을 통과한 {UNIT_RANGE[0]}~{UNIT_RANGE[1]} m만 고를 수 있습니다.
            </p>
            <Field label={`1u = ${unitDraft.toFixed(2)} m (${Math.round(unitDraft * 100)} cm)`}>
              <Slider min={UNIT_RANGE[0]} max={UNIT_RANGE[1]} step={0.01} value={[unitDraft]} onValueChange={(v) => setUnitDraft(Math.round(v[0] * 100) / 100)} aria-label="보폭 단위" />
            </Field>
            <p className={unitOk ? 'mt-2 text-sm text-ok' : 'mt-2 text-sm font-semibold text-danger'} role="status">
              {unitOk ? `검증 통과 — 골반 높이 한계의 최솟값 ${minLimit.toFixed(3)} m` : '검증 실패 — 이 값은 쓸 수 없습니다'}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" disabled={!unitOk || unitDraft === s.unitM} onClick={() => set('unitM', unitDraft)}>
                적용
              </Button>
              <Button onClick={() => setUnitDraft(DEFAULT_PARAMS.unitM)}>기본값 0.36 m</Button>
            </div>
          </section>
          <section className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="mb-3 text-xl font-bold">데이터 초기화</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['진도 지우기', '진도를 지울까요?', '레슨 진도와 퀴즈 점수를 모두 지웁니다.', '진도를 지웠습니다.', resetProgress],
                  ['설정 되돌리기', '설정을 처음 값으로 되돌릴까요?', '보기 · 소리 설정이 처음 값으로 돌아갑니다.', '설정을 처음 값으로 되돌렸습니다.', resetSettings],
                  ['검수 메모 지우기', '검수 메모를 지울까요?', '검수 메모와 저장한 수정본을 모두 지웁니다.', '검수 메모를 지웠습니다.', resetReview],
                ] as const
              ).map(([name, title, desc, doneMsg, fn]) => (
                <Dialog key={name}>
                  <DialogTrigger asChild>
                    <Button variant="outline">{name}</Button>
                  </DialogTrigger>
                  <DialogContent title={title} description={`${desc} 되돌릴 수 없습니다.`}>
                    <div className="flex justify-end gap-2">
                      <DialogClose asChild>
                        <Button>취소</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="danger"
                          onClick={() => {
                            fn();
                            setDone(doneMsg);
                          }}
                        >
                          {name.endsWith('되돌리기') ? '되돌리기' : '지우기'}
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
            {done ? (
              <p className="mt-3 text-sm font-semibold" role="status">
                {done}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
