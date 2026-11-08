'use client';
// 마네킹 (설계문서 8.6): 골반 높이 필터(시정수 0.06초, 8.5 ③) → 2관절 IK → 캡슐 팔다리 · 둥근 몸통.
// 앞뒤를 알 수 있게 얼굴 · 코 · 뒷머리와 몸통 앞뒤 색을 다르게 하고, 다리는 신발과 같은 색 계열로 칠해
// 체중이 실린 다리를 진하게 한다(거울 모드는 신발처럼 좌우 색을 서로 바꾼다).
// GhostDancer = 다음 착지 자세(한 카운트씩 ▷가 가는 곳)를 반투명 하체(골반 · 다리 · 신발)로 겹쳐 그린다 (6.6).
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Foot, Settings, Vec3 } from '@/engine/types';
import { avatarJoints, type AvatarJoints } from '@/engine/ik';
import { poseAt } from '@/engine/pose';
import type { Track } from '@/engine/track';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { ghostBeat } from '@/lib/ghost';
import { BODY_COLORS } from './textures';
import { DEG, m3 } from './coords';
import { GHOST_ORDER, Shoes, useShoes } from './Shoes';
import { bodyGeometry, SEG, TORSO } from './bodyGeometry';

const UP = new THREE.Vector3(0, 1, 0);
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const D = new THREE.Vector3();

/** 뼈 하나: a(뿌리) → b(끝). 모양의 +y가 a → b를 향하게 놓는다. IK가 길이를 지키므로 늘이는 비율은 보통 1 */
function placeBone(m: THREE.Object3D | null, a: Vec3, b: Vec3, len0: number) {
  if (!m) return;
  A.set(...m3(a));
  B.set(...m3(b));
  D.subVectors(B, A);
  const len = Math.max(1e-4, D.length());
  m.position.addVectors(A, B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, D.multiplyScalar(1 / len));
  m.scale.set(1, len / len0, 1);
}

function placePoint(m: THREE.Object3D | null, p: Vec3) {
  if (m) m.position.set(...m3(p));
}

type Avatar = Settings['avatar'];
type Arms = Settings['arms'];

const LEG_LIGHT = { L: new THREE.Color(BODY_COLORS.legLight.L), R: new THREE.Color(BODY_COLORS.legLight.R) };
const LEG_FULL = { L: new THREE.Color(BODY_COLORS.legFull.L), R: new THREE.Color(BODY_COLORS.legFull.R) };
const GHOST_OPACITY = 0.34;
const LEGS_MODE_OPACITY = 0.22; // 하체 강조: 상체를 반투명으로

function useMannequin(swap: boolean, ghost: boolean, avatar: Avatar) {
  const refs = {
    pelvis: useRef<THREE.Mesh>(null),
    torso: useRef<THREE.Mesh>(null),
    neck: useRef<THREE.Mesh>(null),
    head: useRef<THREE.Group>(null),
    shoulderL: useRef<THREE.Mesh>(null),
    shoulderR: useRef<THREE.Mesh>(null),
    thighL: useRef<THREE.Mesh>(null),
    thighR: useRef<THREE.Mesh>(null),
    shinL: useRef<THREE.Mesh>(null),
    shinR: useRef<THREE.Mesh>(null),
    upperL: useRef<THREE.Mesh>(null),
    upperR: useRef<THREE.Mesh>(null),
    foreL: useRef<THREE.Mesh>(null),
    foreR: useRef<THREE.Mesh>(null),
    handL: useRef<THREE.Mesh>(null),
    handR: useRef<THREE.Mesh>(null),
  };
  const mats = useMemo(() => {
    const mk = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...(ghost ? { transparent: true, opacity: GHOST_OPACITY, depthWrite: false } : {}), ...extra });
    if (ghost) {
      const body = mk(BODY_COLORS.ghost);
      return { skin: body, hair: body, shirt: body, torso: body, shorts: body, legs: { L: mk(BODY_COLORS.legFull.L), R: mk(BODY_COLORS.legFull.R) } };
    }
    return {
      skin: mk(BODY_COLORS.skin),
      hair: mk(BODY_COLORS.hair, { roughness: 0.92 }),
      shirt: mk(BODY_COLORS.sleeve),
      torso: mk('#ffffff', { vertexColors: true }),
      shorts: mk(BODY_COLORS.shorts),
      legs: { L: mk(BODY_COLORS.legLight.L), R: mk(BODY_COLORS.legLight.R) },
    };
  }, [ghost]);

  // 하체 강조: 상체 재질만 반투명으로 (셰이더가 바뀌므로 needsUpdate)
  useEffect(() => {
    if (ghost) return;
    const see = avatar === 'legs';
    for (const m of [mats.skin, mats.hair, mats.shirt, mats.torso]) {
      m.transparent = see;
      m.opacity = see ? LEGS_MODE_OPACITY : 1;
      m.depthWrite = !see;
      m.needsUpdate = true;
    }
  }, [avatar, ghost, mats]);

  const update = (j: AvatarJoints, weightR: number) => {
    const r = refs;
    const yaw = -j.yaw * DEG;
    const pel = r.pelvis.current;
    if (pel) {
      pel.position.set(...m3(j.pelvis));
      pel.rotation.set(0, yaw, j.roll * DEG, 'YXZ');
    }
    const torso = r.torso.current;
    if (torso) {
      const mid: Vec3 = [(j.pelvis[0] + j.chest[0]) / 2, (j.pelvis[1] + j.chest[1]) / 2, (j.pelvis[2] + TORSO.lift + j.chest[2]) / 2];
      torso.position.set(...m3(mid));
      torso.rotation.set(0, yaw, 0);
    }
    placeBone(r.neck.current, j.chest, [j.head[0], j.head[1], j.head[2] - 0.08], SEG.neck);
    const head = r.head.current;
    if (head) {
      head.position.set(...m3(j.head));
      head.rotation.set(0, yaw, 0);
    }
    placePoint(r.shoulderL.current, j.shoulders.L);
    placePoint(r.shoulderR.current, j.shoulders.R);
    placeBone(r.thighL.current, j.hips.L, j.knees.L, SEG.thigh);
    placeBone(r.thighR.current, j.hips.R, j.knees.R, SEG.thigh);
    placeBone(r.shinL.current, j.knees.L, j.ankles.L, SEG.shin);
    placeBone(r.shinR.current, j.knees.R, j.ankles.R, SEG.shin);
    placeBone(r.upperL.current, j.shoulders.L, j.elbows.L, SEG.upperArm);
    placeBone(r.upperR.current, j.shoulders.R, j.elbows.R, SEG.upperArm);
    placeBone(r.foreL.current, j.elbows.L, j.hands.L, SEG.forearm);
    placeBone(r.foreR.current, j.elbows.R, j.hands.R, SEG.forearm);
    placePoint(r.handL.current, j.hands.L);
    placePoint(r.handR.current, j.hands.R);
    for (const foot of ['L', 'R'] as const) {
      const shown: Foot = swap ? (foot === 'L' ? 'R' : 'L') : foot;
      const m = mats.legs[foot];
      if (ghost) m.color.copy(LEG_FULL[shown]);
      else m.color.copy(LEG_LIGHT[shown]).lerp(LEG_FULL[shown], foot === 'R' ? weightR : 1 - weightR);
    }
  };
  return { refs, mats, update, ghost, avatar };
}

function MannequinBody({ h }: { h: ReturnType<typeof useMannequin> }) {
  const g = bodyGeometry();
  const { refs: r, mats: m, ghost } = h;
  const order = ghost ? GHOST_ORDER : 0;
  const cast = !ghost;
  const joint = (ref: React.RefObject<THREE.Mesh | null>, mat: THREE.Material, s: number) => (
    <mesh ref={ref} geometry={g.joint} material={mat} scale={s} castShadow={cast} renderOrder={order} />
  );
  const bone = (ref: React.RefObject<THREE.Mesh | null>, geo: THREE.BufferGeometry, mat: THREE.Material) => (
    <mesh ref={ref} geometry={geo} material={mat} castShadow={cast} renderOrder={order} />
  );
  return (
    <group>
      <mesh ref={r.pelvis} geometry={g.pelvis} material={m.shorts} castShadow={cast} renderOrder={order} />
      {bone(r.thighL, g.thigh, m.legs.L)}
      {bone(r.thighR, g.thigh, m.legs.R)}
      {bone(r.shinL, g.shin, m.legs.L)}
      {bone(r.shinR, g.shin, m.legs.R)}
      {/* 미리 보기 마네킹은 하체(골반 · 다리 · 신발)만 그린다 — 겹쳐도 어지럽지 않게 */}
      {!ghost ? (
        <group>
        <mesh ref={r.torso} geometry={g.torso} material={m.torso} castShadow={cast} renderOrder={order} />
        {bone(r.neck, g.neck, m.skin)}
        <group ref={r.head}>
          <mesh geometry={g.head} material={m.skin} castShadow={cast} renderOrder={order} />
          <mesh geometry={g.hairBack} material={m.hair} renderOrder={order} />
          <mesh geometry={g.hairTop} material={m.hair} renderOrder={order} />
          <mesh geometry={g.nose} material={m.skin} position={[0, -0.012, -0.1]} scale={[0.85, 1, 1.35]} renderOrder={order} />
        </group>
        {joint(r.shoulderL, m.shirt, 0.052)}
        {joint(r.shoulderR, m.shirt, 0.052)}
        {bone(r.upperL, g.upperArm, m.shirt)}
        {bone(r.upperR, g.upperArm, m.shirt)}
        {bone(r.foreL, g.forearm, m.skin)}
        {bone(r.foreR, g.forearm, m.skin)}
        {joint(r.handL, m.skin, 0.04)}
        {joint(r.handR, m.skin, 0.04)}
        </group>
      ) : null}
    </group>
  );
}

export function Dancer({ mirror, avatar, arms }: { mirror: boolean; avatar: Avatar; arms: Arms }) {
  const shoes = useShoes(mirror);
  const body = useMannequin(mirror, false, avatar);
  const filt = useRef<{ h: number; key: string } | null>(null);
  const showBody = avatar !== 'shoes';

  useFrame((_, dt) => {
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !pose) return;
    // 골반 높이 저역 필터 (급한 꺼짐 방지). 트랙이 바뀌면 바로 맞춘다
    const target = pose.pelvis.height;
    const key = `${track.steps.length}:${track.unitLength}:${mirror}`;
    if (!filt.current || filt.current.key !== key) filt.current = { h: target, key };
    const a = 1 - Math.exp(-Math.min(dt, 0.1) / 0.06);
    filt.current.h += (target - filt.current.h) * a;
    const j = avatarJoints(track, pose, { arms, pelvisHeight: Math.min(filt.current.h, pose.pelvis.height + 0.01) });
    shoes.update(j, pose.weightR);
    if (showBody) body.update(j, pose.weightR);
  });

  return (
    <group>
      <Shoes swap={mirror} handle={shoes} />
      {showBody ? <MannequinBody h={body} /> : null}
    </group>
  );
}

/** 다음 자세 미리 보기: 멈춰 있을 때(또는 항상) 다음 착지 자세의 하체를 반투명으로 */
export function GhostDancer({ mirror, avatar, arms, mode }: { mirror: boolean; avatar: Avatar; arms: Arms; mode: Settings['ghost'] }) {
  const root = useRef<THREE.Group>(null);
  const shoes = useShoes(mirror, true);
  const body = useMannequin(mirror, true, avatar);
  const cache = useRef<{ track: Track; beat: number; arms: Arms; j: AvatarJoints; w: number } | null>(null);
  const showBody = avatar !== 'shoes';

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const f = computeFrame();
    const base = player.track;
    const track = mirror ? player.mirrorTrack : base;
    const gb = base && track ? ghostBeat(base, f.beat, f.status, mode) : null;
    if (gb === null || !track) {
      g.visible = false;
      return;
    }
    let c = cache.current;
    if (!c || c.track !== track || c.beat !== gb || c.arms !== arms) {
      const pose = poseAt(track, gb); // 거울 트랙도 걸음 시각이 같으므로 같은 박을 쓴다
      c = { track, beat: gb, arms, j: avatarJoints(track, pose, { arms }), w: pose.weightR };
      cache.current = c;
    }
    g.visible = true;
    shoes.update(c.j, c.w);
    if (showBody) body.update(c.j, c.w);
  });

  return (
    <group ref={root} visible={false}>
      <Shoes swap={mirror} handle={shoes} />
      {showBody ? <MannequinBody h={body} /> : null}
    </group>
  );
}
