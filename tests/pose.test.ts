// 설계문서 7.5 · 8.4 · 8.5 · 8.7 · 11.1 — beat → Pose
import { describe, expect, it } from 'vitest';
import { poseAt, rawPoseAt } from '@/engine/pose';
import { avatarJoints, solveTwoBone } from '@/engine/ik';
import { dist } from '@/engine/geometry';
import type { Pose } from '@/engine/types';
import type { Track } from '@/engine/track';
import { BLOCK_IDS, ROUTINE_IDS, blockTrack, routineTrack } from './helpers';

function scan(track: Track, from: number, to: number, step = 0.01) {
  let prev: Pose | null = null;
  let worst = 0;
  let worstAt = from;
  for (let b = from; b <= to + 1e-9; b += step) {
    const p = poseAt(track, b);
    if (prev) {
      const d = Math.max(dist(prev.feet.L.pos, p.feet.L.pos), dist(prev.feet.R.pos, p.feet.R.pos), dist(prev.pelvis.pos, p.pelvis.pos));
      if (d > worst) {
        worst = d;
        worstAt = b;
      }
    }
    prev = p;
  }
  return { worst, worstAt };
}

describe('자세 pose(beat)', () => {
  it('pose(T_i): 착지하는 발의 자리 = to, 높이 0 (모든 블록 · 루틴)', () => {
    const tracks = [...BLOCK_IDS.map((id) => blockTrack(id, false)), ...ROUTINE_IDS.map((id) => routineTrack(id, false))];
    for (const t of tracks) {
      t.steps.forEach((s) => {
        const p = poseAt(t, s.beat);
        expect(p.feet[s.foot].pos[0]).toBeCloseTo(s.to[0], 12);
        expect(p.feet[s.foot].pos[1]).toBeCloseTo(s.to[1], 12);
        expect(p.feet[s.foot].height).toBe(0);
      });
    }
  });

  it('지지발 고정: 착지 뒤 다음에 뜰 때까지 자리 변화 0 (회전 피벗의 방향 변화만 허용)', () => {
    for (const id of [...BLOCK_IDS]) {
      const t = blockTrack(id, false, { repeats: id === 'B6-vineQuarter' || id === 'B7-jazzQuarter' ? 4 : 1 });
      t.steps.forEach((s, i) => {
        // 이 발이 다음에 뜨는 박
        let nextLift = t.totalBeats;
        for (let j = i + 1; j < t.steps.length; j++) {
          if (t.steps[j].foot === s.foot) {
            nextLift = t.timing.lift[j];
            break;
          }
        }
        for (let b = s.beat; b < nextLift - 1e-6; b += 0.05) {
          const p = poseAt(t, b);
          expect(dist(p.feet[s.foot].pos, s.to), `${id} ${s.count} @${b.toFixed(2)}`).toBeLessThan(1e-12);
          expect(p.feet[s.foot].height).toBe(0);
        }
      });
    }
  });

  it('연속성: 0.01박 간격으로 훑을 때 발 · 골반이 한 번에 0.05u 넘게 움직이지 않는다', () => {
    for (const id of BLOCK_IDS) {
      const t = blockTrack(id, false, { repeats: 4 });
      const r = scan(t, -2, t.totalBeats);
      expect(r.worst, `${id} @${r.worstAt.toFixed(2)}`).toBeLessThanOrEqual(0.05);
    }
    for (const id of ROUTINE_IDS) {
      const t = routineTrack(id, false);
      const r = scan(t, -2, t.totalBeats);
      expect(r.worst, `${id} @${r.worstAt.toFixed(2)}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('루프 이음새: 재즈박스와 R-B32를 루프로 돌릴 때 경계에서 발 · 골반이 튀지 않는다', () => {
    const j = blockTrack('B3-jazzBox', true);
    for (const k of [1, 2, 3, 7]) {
      const r = scan(j, k * 8 - 1.5, k * 8 + 1.5);
      expect(r.worst, `B3 loop ${k}`).toBeLessThanOrEqual(0.05);
    }
    const rb = routineTrack('R-B32', true);
    for (const k of [1, 2, 3]) {
      const r = scan(rb, k * 32 - 1.5, k * 32 + 1.5);
      expect(r.worst, `R-B32 loop ${k}`).toBeLessThanOrEqual(0.05);
    }
    // 루프 2회째부터 재즈박스 1카운트의 오른발은 홈이 아니라 (0.3, −0.4)에서 출발한다
    const before = poseAt(j, 16 - 0.65);
    expect(before.feet.R.pos[0]).toBeCloseTo(0.3, 9);
    expect(before.feet.R.pos[1]).toBeCloseTo(-0.4, 9);
  });

  it('4벽 루프에서도 경계가 이어지고 네 벽을 돌면 처음 자리 · 12시로 돌아온다', () => {
    for (const id of ['R-E16', 'R-D32']) {
      const t = routineTrack(id, true);
      const L = t.loopBeats;
      const r = scan(t, L - 1.5, L + 1.5);
      expect(r.worst, id).toBeLessThanOrEqual(0.05);
      const a = poseAt(t, 0.5);
      const b = poseAt(t, L + 0.5);
      const c = poseAt(t, 3 * L + 0.5);
      for (const p of [b, c]) {
        expect(p.feet.L.pos[0]).toBeCloseTo(a.feet.L.pos[0], 9);
        expect(p.feet.R.pos[1]).toBeCloseTo(a.feet.R.pos[1], 9);
        expect(((p.heading % 360) + 360) % 360).toBeCloseTo(((a.heading % 360) + 360) % 360, 9);
      }
    }
  });

  it('회전은 회전 걸음이 떠 있는 동안에만 일어나고, 지지발은 제자리에서 돈다', () => {
    const t = blockTrack('B7-jazzQuarter', false, { repeats: 1 });
    const i = t.steps.findIndex((s) => s.turn !== 0);
    const s = t.steps[i];
    expect(poseAt(t, t.timing.lift[i] - 1e-6).heading).toBeCloseTo(0, 9);
    expect(poseAt(t, s.beat).heading).toBeCloseTo(90, 9);
    const mid = poseAt(t, (t.timing.lift[i] + s.beat) / 2);
    expect(mid.heading).toBeGreaterThan(0);
    expect(mid.heading).toBeLessThan(90);
    const piv = s.pivotFoot!;
    const p0 = poseAt(t, t.timing.lift[i]).feet[piv];
    const p1 = poseAt(t, s.beat).feet[piv];
    expect(dist(p0.pos, p1.pos)).toBeLessThan(1e-12);
    expect(p1.yaw).toBeCloseTo(90, 9);
  });

  it('준비 구간(음수 박)에는 준비 자세, 카운트인 숫자는 5 · 6 · 7 · 8', () => {
    const t = blockTrack('B1-stepTouch', true);
    const p = poseAt(t, -3.5);
    expect(p.feet.L.pos).toEqual([-0.2, 0]);
    expect(p.feet.R.pos).toEqual([0.2, 0]);
    expect(p.weightR).toBe(0);
    expect(p.count).toBe('5&');
    expect(poseAt(t, -1).count).toBe('8');
  });

  it('같은 박을 넣으면 항상 같은 자세 (순수 함수)', () => {
    const t = routineTrack('R-C32', true);
    expect(JSON.stringify(poseAt(t, 37.37))).toBe(JSON.stringify(poseAt(t, 37.37)));
    expect(JSON.stringify(rawPoseAt(t, 5.5))).toBe(JSON.stringify(rawPoseAt(t, 5.5)));
  });
});

describe('다리 IK (8.6)', () => {
  it('닿는 거리면 무릎을 지나 발목에 정확히 닿는다', () => {
    const r = solveTwoBone([0, 0, 0.85], [0.1, 0.05, 0.1], 0.4, 0.4, [0, 1, 0]);
    expect(r.reached).toBe(true);
    expect(Math.hypot(r.knee[0], r.knee[1], r.knee[2] - 0.85)).toBeCloseTo(0.4, 9);
    expect(Math.hypot(r.end[0] - 0.1, r.end[1] - 0.05, r.end[2] - 0.1)).toBeLessThan(1e-9);
    expect(r.knee[1]).toBeGreaterThan(0.025); // 무릎은 pole(앞) 쪽으로 굽는다
  });

  it('아바타 관절: 모든 블록에서 무릎이 뒤로 꺾이지 않고 다리가 닿는다', () => {
    for (const id of BLOCK_IDS) {
      const t = blockTrack(id, false);
      for (let b = 0; b < 8; b += 0.1) {
        const j = avatarJoints(t, poseAt(t, b), { arms: 'swing' });
        for (const f of ['L', 'R'] as const) {
          expect(j.reached[f], `${id} @${b.toFixed(1)} ${f}`).toBe(true);
          // 무릎은 엉덩 관절과 발목 사이 높이
          expect(j.knees[f][2]).toBeLessThan(j.hips[f][2]);
          expect(j.knees[f][2]).toBeGreaterThan(j.ankles[f][2]);
        }
      }
    }
  });
});
