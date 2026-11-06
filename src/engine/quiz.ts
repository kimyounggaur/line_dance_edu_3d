// 자동 퀴즈 (설계문서 8.11). 걸음 목록에서 문제를 만든다. 문구는 고정 틀에 값을 채운다.
import type { Figure, Foot, QuizKind, ResolvedStep, Vec2 } from './types';
import { FOOT_KO, OTHER } from './constants';
import { dist, normAngle, worldToLocalVec, fwd, right } from './geometry';
import type { Track } from './track';

/** 씨앗 값이 있는 난수 (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuizChoice {
  label: string;
  value: string;
  spot?: Vec2; // nextSpot 보기의 자리 (세계 좌표 u)
}

export interface QuizQuestion {
  id: string;
  kind: QuizKind;
  prompt: string;
  choices: QuizChoice[];
  answer: number; // 정답 보기의 순서
  explanation: string;
  stepIndex: number; // 관련 걸음 (track.steps 안의 순서)
  showBeat: number; // 문제를 낼 때 멈춰 보여 줄 박
  revealBeat: number; // 해설과 함께 보여 줄 박 (그 카운트의 자세)
}

export const WALL_NAMES = ['12시', '3시', '6시', '9시'] as const;

export function wallName(heading: number): string {
  const q = Math.round(normAngle(heading) / 90) % 4;
  return WALL_NAMES[q];
}

const footKo = (f: Foot) => FOOT_KO[f];

/** 받침에 따라 조사를 붙인다: josa('스텝터치', '이', '가') → '스텝터치가' */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const plain = word.replace(/\([^)]*\)$/, '');
  const last = plain.charCodeAt(plain.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    const hasFinal = (last - 0xac00) % 28 !== 0;
    return word + (hasFinal ? withFinal : withoutFinal);
  }
  // 한글이 아니면(영문 · 숫자) 받침 없는 쪽으로
  return word + withoutFinal;
}

interface Candidate {
  kind: QuizKind;
  weight: number;
  key: string;
  make: (rnd: () => number) => Omit<QuizQuestion, 'id'> | null;
}

function cueOf(s: ResolvedStep) {
  return s.cueKo;
}

/** 이 걸음 바로 전에 멈출 박: 발이 뜨기 직전 (앞 걸음의 착지 뒤) */
function beforeBeat(track: Track, i: number): number {
  const tm = track.timing;
  const prevT = i > 0 ? tm.T[i - 1] : -1;
  return Math.max(prevT + 0.01, tm.lift[i] - 0.02);
}

export interface QuizOptions {
  count: number;
  kinds: QuizKind[];
  seed: number;
  figures?: Record<string, Figure>;
}

/** 재생 단위 한 번(첫 회)의 걸음에서 문제를 고른다 */
export function generateQuiz(track: Track, opts: QuizOptions): QuizQuestion[] {
  const rnd = mulberry32(opts.seed);
  const unitEnd = track.unitLength;
  const steps = track.steps.filter((s) => s.beat < unitEnd - 1e-9);
  const tm = track.timing;
  const cands: Candidate[] = [];

  for (const s of steps) {
    const i = s.index;
    const prev = i > 0 ? track.steps[i - 1] : null;
    // nextFoot — k카운트 직전에 멈추고 "다음에 움직이는 발은?"
    cands.push({
      kind: 'nextFoot',
      key: `nextFoot-${i}`,
      weight: prev && prev.action === 'touch' ? 2 : 1,
      make: () => {
        const weightNow = s.weightBefore;
        const extra =
          prev && prev.action === 'touch' && prev.foot === s.foot
            ? ` 바로 앞의 ${prev.count}카운트는 터치라 ${footKo(s.foot)}에 체중이 없습니다. 그래서 터치한 발이 다시 움직입니다.`
            : '';
        return {
          kind: 'nextFoot',
          prompt: `${s.count}카운트 직전입니다. 다음에 움직이는 발은?`,
          choices: [
            { label: '왼발', value: 'L' },
            { label: '오른발', value: 'R' },
          ],
          answer: s.foot === 'L' ? 0 : 1,
          explanation: `지금 체중은 ${footKo(weightNow)}에 있어서 ${footKo(OTHER[weightNow])}만 움직일 수 있습니다.${extra} ${s.count}카운트: ${s.desc}.`,
          stepIndex: i,
          showBeat: beforeBeat(track, i),
          revealBeat: tm.rest[i],
        };
      },
    });
    // weightFoot — k카운트 직후에 멈추고 "지금 체중은 어느 발?" (터치 직후를 자주)
    cands.push({
      kind: 'weightFoot',
      key: `weightFoot-${i}`,
      weight: s.action === 'touch' ? 4 : 1,
      make: () => ({
        kind: 'weightFoot',
        prompt: `${s.count}카운트(${cueOf(s)})를 막 마쳤습니다. 지금 체중은 어느 발에 있나요?`,
        choices: [
          { label: '왼발', value: 'L' },
          { label: '오른발', value: 'R' },
        ],
        answer: s.weightAfter === 'L' ? 0 : 1,
        explanation:
          s.action === 'touch'
            ? `${s.count}카운트는 터치라 체중이 옮겨 가지 않습니다. 체중은 그대로 ${footKo(s.weightAfter)}에 있습니다.`
            : `${s.count}카운트에 ${footKo(s.foot)}로 디뎠으므로 체중은 ${footKo(s.weightAfter)}에 있습니다.`,
        stepIndex: i,
        showBeat: tm.rest[i],
        revealBeat: tm.rest[i],
      }),
    });
    // nextSpot — "다음 발은 어디에 놓일까요?"
    cands.push({
      kind: 'nextSpot',
      key: `nextSpot-${i}`,
      weight: s.distance > 0.3 ? 1 : 0.3,
      make: (r) => {
        const sup = OTHER[s.foot];
        const supPos = posBefore(track, i, sup);
        // ① 지지발 기준 좌우 대칭 자리 (몸 방향 기준)
        const h = s.headingBefore;
        const rel = worldToLocalVec(h, [s.to[0] - supPos[0], s.to[1] - supPos[1]]);
        const rr = right(h);
        const ff = fwd(h);
        const mirror: Vec2 = [supPos[0] - rel[0] * rr[0] + rel[1] * ff[0], supPos[1] - rel[0] * rr[1] + rel[1] * ff[1]];
        const next = track.steps[i + 1];
        const raw: Vec2[] = [mirror, s.from];
        if (next) raw.push(next.to);
        const distractors: Vec2[] = [];
        for (const p of raw) {
          if (dist(p, s.to) <= 0.3) continue;
          if (distractors.some((q) => dist(q, p) <= 0.3)) continue;
          if (dist(p, supPos) < 0.2) continue; // 지지발 자리와 같은 보기는 빼기
          distractors.push(p);
        }
        if (distractors.length < 1) return null;
        const spots = shuffle([s.to, ...distractors], r);
        const letters = ['A', 'B', 'C', 'D'];
        return {
          kind: 'nextSpot',
          prompt: `${s.count}카운트에 ${footKo(s.foot)}은 어디에 놓일까요?`,
          choices: spots.map((p, k) => ({ label: letters[k], value: `${p[0].toFixed(2)},${p[1].toFixed(2)}`, spot: p })),
          answer: spots.findIndex((p) => p === s.to),
          explanation: `${s.count}카운트: ${s.desc}. (${cueOf(s)})`,
          stepIndex: i,
          showBeat: beforeBeat(track, i),
          revealBeat: tm.rest[i],
        };
      },
    });
    // facing — "이 카운트가 끝나면 어느 벽을 보나요?"
    cands.push({
      kind: 'facing',
      key: `facing-${i}`,
      weight: s.turn !== 0 ? 6 : 0.4,
      make: () => {
        const correct = wallName(s.headingAfter);
        const choices = WALL_NAMES.map((w) => ({ label: w, value: w }));
        const turnTxt =
          s.turn !== 0
            ? `${s.count}카운트에 ${s.turn > 0 ? '오른쪽' : '왼쪽'}으로 1/4 돌아 ${correct}를 봅니다.`
            : `${s.count}카운트에는 회전이 없어서 ${correct}를 그대로 봅니다.`;
        return {
          kind: 'facing',
          prompt: `${s.count}카운트(${cueOf(s)})가 끝나면 어느 벽을 보나요?`,
          choices,
          answer: WALL_NAMES.indexOf(correct as (typeof WALL_NAMES)[number]),
          explanation: `${turnTxt} 발이 대각선으로 나가도 몸이 돌지 않으면 보는 벽은 바뀌지 않습니다.`,
          stepIndex: i,
          showBeat: beforeBeat(track, i),
          revealBeat: tm.rest[i],
        };
      },
    });
  }
  // freeAfter — "이 동작이 끝나면 어느 발이 자유롭나요?"
  for (const f of track.figures) {
    if (f.startBeat >= unitEnd - 1e-9 || f.lastStep < 0) continue;
    const name = opts.figures?.[f.figureId]?.nameKo ?? f.figureId;
    const free = OTHER[f.endState.weightOn];
    const last = track.steps[f.lastStep];
    cands.push({
      kind: 'freeAfter',
      key: `freeAfter-${f.seq}`,
      weight: 1,
      make: () => ({
        kind: 'freeAfter',
        prompt: `${track.steps[f.firstStep].count}카운트부터 시작한 ${josa(name + (f.mirrored ? '(왼발 시작)' : ''), '이', '가')} 끝나면 어느 발이 자유롭나요?`,
        choices: [
          { label: '왼발', value: 'L' },
          { label: '오른발', value: 'R' },
        ],
        answer: free === 'L' ? 0 : 1,
        explanation:
          last.action === 'touch'
            ? `마지막 ${last.count}카운트가 터치라 체중은 ${footKo(f.endState.weightOn)}에 남습니다. 그래서 ${footKo(free)}이 다음 걸음을 시작합니다.`
            : `마지막 ${last.count}카운트에 ${footKo(last.foot)}로 디뎌 체중이 ${footKo(f.endState.weightOn)}에 있습니다. 그래서 ${footKo(free)}이 자유롭습니다.`,
        stepIndex: f.lastStep,
        showBeat: tm.rest[f.lastStep],
        revealBeat: tm.rest[f.lastStep],
      }),
    });
  }

  // 종류를 고르게 섞어 count개를 고른다
  const kinds = opts.kinds.length ? opts.kinds : (['nextFoot', 'weightFoot'] as QuizKind[]);
  const order: QuizKind[] = [];
  while (order.length < opts.count) order.push(...shuffle(kinds, rnd));
  const used = new Set<string>();
  const out: QuizQuestion[] = [];
  for (let qi = 0; qi < order.length && out.length < opts.count; qi++) {
    let pool = cands.filter((c) => c.kind === order[qi] && !used.has(c.key));
    if (!pool.length) pool = cands.filter((c) => kinds.includes(c.kind) && !used.has(c.key));
    let made: Omit<QuizQuestion, 'id'> | null = null;
    let tries = 0;
    while (pool.length && !made && tries < 20) {
      tries++;
      const total = pool.reduce((a, c) => a + c.weight, 0);
      let x = rnd() * total;
      let pick = pool[pool.length - 1];
      for (const c of pool) {
        x -= c.weight;
        if (x <= 0) {
          pick = c;
          break;
        }
      }
      used.add(pick.key);
      made = pick.make(rnd);
      pool = pool.filter((c) => c !== pick);
    }
    if (!made) continue;
    // 두 발 보기는 순서를 섞지 않는다(왼발 · 오른발이 늘 같은 자리), 벽 · 자리 보기는 섞는다
    if (made.kind === 'facing') {
      const perm = shuffle(
        made.choices.map((c, k) => ({ c, k })),
        rnd,
      );
      made = { ...made, choices: perm.map((p) => p.c), answer: perm.findIndex((p) => p.k === made!.answer) };
    }
    out.push({ ...made, id: `q${out.length + 1}-${made.kind}-${made.stepIndex}` });
  }
  return out;
}

/** 걸음 i 직전의 발 자리 */
function posBefore(track: Track, i: number, foot: Foot): Vec2 {
  for (let j = i - 1; j >= 0; j--) if (track.steps[j].foot === foot) return track.steps[j].to;
  return track.start.pos[foot];
}
