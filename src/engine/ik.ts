// 2관절 IK와 마네킹 관절 위치 (설계문서 8.6). 좌표는 m, z = 높이. three.js 변환은 render3d에서 한다.
import type { Foot, Pose, Vec3 } from './types';
import { BODY } from './constants';
import { v3 } from './geometry';
import { hipAnkle } from './pose';
import type { Track } from './track';

export interface TwoBoneResult {
  knee: Vec3;
  end: Vec3; // 실제로 닿은 끝점 (목표가 너무 멀면 목표 쪽으로 최대한)
  reached: boolean;
}

/** H(뿌리) → K(중간) → A(끝). pole은 무릎(팔꿈치)이 향할 쪽 */
export function solveTwoBone(H: Vec3, A: Vec3, L1: number, L2: number, pole: Vec3): TwoBoneResult {
  const dv = v3.sub(A, H);
  const D = v3.len(dv);
  const maxD = BODY.reachFactor * (L1 + L2);
  const d = Math.max(1e-6, Math.min(D, maxD));
  const u: Vec3 = D > 1e-9 ? v3.scale(dv, 1 / D) : [0, 0, -1];
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  let n = v3.sub(pole, v3.scale(u, v3.dot(pole, u)));
  if (v3.len(n) < 1e-6) n = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  n = v3.norm(n);
  const knee = v3.add(H, v3.add(v3.scale(u, a), v3.scale(n, h)));
  const end = v3.add(H, v3.scale(u, d));
  return { knee, end, reached: D <= maxD + 1e-9 };
}

export interface AvatarJoints {
  pelvis: Vec3;
  yaw: number; // 도
  roll: number; // 도
  hips: Record<Foot, Vec3>;
  knees: Record<Foot, Vec3>;
  ankles: Record<Foot, Vec3>;
  chest: Vec3; // 어깨 중심
  shoulders: Record<Foot, Vec3>;
  elbows: Record<Foot, Vec3>;
  hands: Record<Foot, Vec3>;
  head: Vec3;
  shoes: Record<Foot, { center: Vec3; yaw: number; pitch: number }>;
  reached: Record<Foot, boolean>;
}

const dirOf = (deg: number): Vec3 => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180), 0];
const rightOf = (deg: number): Vec3 => [Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180), 0];

export function avatarJoints(track: Track, pose: Pose, opts: { arms: 'swing' | 'hips'; pelvisHeight?: number }): AvatarJoints {
  const U = track.params.unitM;
  const base = opts.pelvisHeight ?? pose.pelvis.height;
  let p: Pose = { ...pose, pelvis: { ...pose.pelvis, height: base } };
  let ha = hipAnkle(track, p);
  // 골반 기울기와 뒤꿈치 들림까지 넣어도 다리가 닿도록 골반을 몇 mm 낮춘다 (8.5 ③의 한계를 그리는 쪽에서 보정)
  const maxD = BODY.reachFactor * (BODY.thigh + BODY.shin);
  let drop = 0;
  for (const foot of ['L', 'R'] as const) {
    const { hip, ankle } = ha[foot];
    const dxy = Math.hypot(hip[0] - ankle[0], hip[1] - ankle[1]);
    const maxDz = Math.sqrt(Math.max(maxD * maxD - dxy * dxy, 0));
    const dz = hip[2] - ankle[2];
    if (dz > maxDz) drop = Math.max(drop, dz - maxDz + 1e-6);
  }
  if (drop > 0) {
    p = { ...pose, pelvis: { ...pose.pelvis, height: base - drop } };
    ha = hipAnkle(track, p);
  }
  const f = dirOf(p.pelvis.yaw);
  const r = rightOf(p.pelvis.yaw);
  const pelvis: Vec3 = [p.pelvis.pos[0] * U, p.pelvis.pos[1] * U, p.pelvis.height];
  const hips = { L: ha.L.hip, R: ha.R.hip };
  const knees = {} as Record<Foot, Vec3>;
  const ankles = {} as Record<Foot, Vec3>;
  const reached = {} as Record<Foot, boolean>;
  const shoes = {} as AvatarJoints['shoes'];
  for (const foot of ['L', 'R'] as const) {
    const fp = p.feet[foot];
    const toe = dirOf(fp.yaw);
    // 무릎이 향할 쪽 = 발끝 방향과 몸 방향의 평균(수평)
    const pole = v3.norm(v3.add(toe, f));
    const res = solveTwoBone(ha[foot].hip, ha[foot].ankle, BODY.thigh, BODY.shin, pole);
    knees[foot] = res.knee;
    ankles[foot] = res.end;
    reached[foot] = res.reached;
    const pitch = Math.asin(Math.min(0.9, fp.heelLift / BODY.footLen)); // 뒤꿈치가 들리면 발끝이 내려간다
    shoes[foot] = {
      center: [fp.pos[0] * U, fp.pos[1] * U, fp.height + BODY.footH / 2 + fp.heelLift / 2],
      yaw: fp.yaw,
      pitch,
    };
  }
  // 상체: 몸통은 골반 위에 세우고 어깨선은 수평 (골반 roll을 상쇄)
  const chest: Vec3 = [pelvis[0], pelvis[1], pelvis[2] + BODY.pelvisToShoulder];
  const shoulders = {
    L: v3.add(chest, v3.scale(r, -BODY.shoulderHalf)),
    R: v3.add(chest, v3.scale(r, BODY.shoulderHalf)),
  };
  const elbows = {} as Record<Foot, Vec3>;
  const hands = {} as Record<Foot, Vec3>;
  if (opts.arms === 'hips') {
    for (const [foot, sgn] of [
      ['L', -1],
      ['R', 1],
    ] as const) {
      const target = v3.add(hips[foot], v3.add(v3.scale(r, sgn * 0.07), [0, 0, 0.1]));
      const pole = v3.norm(v3.add(v3.scale(r, sgn), v3.scale(f, -0.6)));
      const res = solveTwoBone(shoulders[foot], target, BODY.upperArm, BODY.forearm, pole);
      elbows[foot] = res.knee;
      hands[foot] = res.end;
    }
  } else {
    const swing = 6 * (2 * p.weightR - 1); // 걸음에 맞춰 ±6°
    for (const [foot, sgn] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      const a = (sgn * swing * Math.PI) / 180;
      const down: Vec3 = v3.norm(v3.add(v3.scale(f, Math.sin(a)), v3.add(v3.scale(r, (foot === 'L' ? -1 : 1) * 0.12), [0, 0, -Math.cos(a)])));
      const elbow = v3.add(shoulders[foot], v3.scale(down, BODY.upperArm));
      const fore: Vec3 = v3.norm(v3.add(down, v3.scale(f, 0.25)));
      elbows[foot] = elbow;
      hands[foot] = v3.add(elbow, v3.scale(fore, BODY.forearm));
    }
  }
  const head: Vec3 = [chest[0], chest[1], chest[2] + BODY.shoulderToHead];
  return { pelvis, yaw: p.pelvis.yaw, roll: p.pelvis.roll, hips, knees, ankles, chest, shoulders, elbows, hands, head, shoes, reached };
}
