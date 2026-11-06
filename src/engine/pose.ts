// beat → Pose. 발 궤적(8.4) · 체중과 골반(8.5) · 회전(8.7)을 묶는다. 같은 박을 넣으면 항상 같은 자세가 나온다.
import type { Foot, Pose, Vec3 } from './types';
import { BODY } from './constants';
import { easeSine, lerp } from './geometry';
import { footAt, liftIndexAt } from './footPath';
import { pelvisHeightAt, pelvisRoll, supportFootAt, weightAt } from './weight';
import { mapBeat, type Track } from './track';
import { countAt } from './timeline';

/** 8.7 몸 방향: 회전 걸음이 떠 있는 동안 headingBefore → headingAfter */
export function headingAt(track: Track, b: number, m = liftIndexAt(track, b)): number {
  const { steps, timing: tm, idx, start } = track;
  if (m < 0) return start.heading;
  const k = idx.lastTurn[m];
  if (k < 0) return start.heading;
  const sk = steps[k];
  return b < tm.T[k] ? lerp(sk.headingBefore, sk.headingAfter, easeSine((b - tm.lift[k]) / (tm.T[k] - tm.lift[k]))) : sk.headingAfter;
}

export type RawPose = Omit<Pose, 'beat' | 'count' | 'blockIndex' | 'wall' | 'shift' | 'rep'>;

/** 걸음 목록 안의 박(local)에서 자세. 평행 이동(shift)은 더하지 않는다 */
export function rawPoseAt(track: Track, b: number): RawPose {
  const { steps } = track;
  const n = steps.length;
  const m = liftIndexAt(track, b); // 마지막으로 뜬 걸음
  const feet = { L: footAt(track, 'L', b, m), R: footAt(track, 'R', b, m) };
  const heading = headingAt(track, b, m);
  const { weightR, pelvisPos } = weightAt(track, b);
  const supportFoot = supportFootAt(track, b);
  const { height, limit } = pelvisHeightAt(track, b, feet, pelvisPos, heading);
  return {
    localBeat: b,
    heading,
    feet,
    weightR,
    supportFoot,
    pelvis: { pos: pelvisPos, height, yaw: heading, roll: pelvisRoll(weightR), limit },
    current: m >= 0 ? steps[m] : null,
    next: m + 1 < n ? steps[m + 1] : null,
    currentIndex: m,
  };
}

/** 재생 박 → 자세 (루프 · 평행 이동 포함) */
export function poseAt(track: Track, beat: number): Pose {
  const map = mapBeat(track, beat);
  const raw = rawPoseAt(track, map.local);
  const [dx, dy] = map.shift;
  if (dx !== 0 || dy !== 0) {
    raw.feet.L.pos = [raw.feet.L.pos[0] + dx, raw.feet.L.pos[1] + dy];
    raw.feet.R.pos = [raw.feet.R.pos[0] + dx, raw.feet.R.pos[1] + dy];
    raw.pelvis.pos = [raw.pelvis.pos[0] + dx, raw.pelvis.pos[1] + dy];
  }
  const b = Math.min(beat, track.totalBeats);
  const unitBeat = b < 0 ? 0 : ((b % track.unitLength) + track.unitLength) % track.unitLength;
  const blocksPerUnit = Math.max(1, Math.round(track.unitLength / 8));
  return {
    ...raw,
    beat,
    count: countAt(b).label,
    blockIndex: Math.min(blocksPerUnit - 1, Math.floor(unitBeat / 8)),
    wall: b < 0 || track.closeN <= 1 ? 1 : (Math.floor(Math.min(b, track.totalBeats - 1e-9) / track.unitLength) % track.closeN) + 1,
    shift: map.shift,
    rep: map.rep,
  };
}

/** 골반 위치에서 엉덩 관절 · 발목까지 — IK 입력 (m, z = 높이) */
export function hipAnkle(track: Track, pose: Pose): Record<Foot, { hip: Vec3; ankle: Vec3 }> {
  const U = track.params.unitM;
  const h = pose.pelvis.yaw * (Math.PI / 180);
  const rx = Math.cos(h);
  const ry = -Math.sin(h);
  const rollRad = pose.pelvis.roll * (Math.PI / 180);
  const out = {} as Record<Foot, { hip: Vec3; ankle: Vec3 }>;
  for (const [foot, sgn] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    const hip: Vec3 = [
      pose.pelvis.pos[0] * U + sgn * BODY.hipHalf * rx,
      pose.pelvis.pos[1] * U + sgn * BODY.hipHalf * ry,
      pose.pelvis.height + sgn * BODY.hipHalf * Math.sin(rollRad),
    ];
    const f = pose.feet[foot];
    const yr = f.yaw * (Math.PI / 180);
    const ankle: Vec3 = [
      f.pos[0] * U - BODY.ankleBack * Math.sin(yr),
      f.pos[1] * U - BODY.ankleBack * Math.cos(yr),
      BODY.ankleH + f.height + f.heelLift * 0.5,
    ];
    out[foot] = { hip, ankle };
  }
  return out;
}

/** 이 걸음까지 다 실린 '착지 자세'의 박 (한 카운트씩 보기의 정지 지점, 8.3) */
export function restBeat(track: Track, stepIndex: number): number {
  return track.timing.rest[stepIndex];
}
