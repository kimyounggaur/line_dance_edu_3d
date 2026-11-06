'use client';
// 마네킹: 골반 높이 필터(시정수 0.06초, 8.5 ③) → 2관절 IK(8.6) → 캡슐 대신 원기둥 + 관절 구
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Settings, Vec3 } from '@/engine/types';
import { avatarJoints } from '@/engine/ik';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS } from './textures';
import { DEG, m3 } from './coords';
import { Shoes, useShoes } from './Shoes';

const UP = new THREE.Vector3(0, 1, 0);
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const D = new THREE.Vector3();

function setSegment(m: THREE.Object3D | null, a: Vec3, b: Vec3, r: number) {
  if (!m) return;
  A.set(...m3(a));
  B.set(...m3(b));
  D.subVectors(B, A);
  const len = Math.max(1e-4, D.length());
  m.position.addVectors(A, B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, D.multiplyScalar(1 / len));
  m.scale.set(r, len, r);
}

function setPoint(m: THREE.Object3D | null, p: Vec3) {
  if (m) m.position.set(...m3(p));
}

export function Dancer({ mirror, avatar, arms }: { mirror: boolean; avatar: Settings['avatar']; arms: Settings['arms'] }) {
  const shoes = useShoes(mirror);
  const r = {
    pelvis: useRef<THREE.Mesh>(null),
    torso: useRef<THREE.Mesh>(null),
    shoulders: useRef<THREE.Mesh>(null),
    neck: useRef<THREE.Mesh>(null),
    head: useRef<THREE.Mesh>(null),
    thighL: useRef<THREE.Mesh>(null),
    thighR: useRef<THREE.Mesh>(null),
    shinL: useRef<THREE.Mesh>(null),
    shinR: useRef<THREE.Mesh>(null),
    kneeL: useRef<THREE.Mesh>(null),
    kneeR: useRef<THREE.Mesh>(null),
    upperL: useRef<THREE.Mesh>(null),
    upperR: useRef<THREE.Mesh>(null),
    foreL: useRef<THREE.Mesh>(null),
    foreR: useRef<THREE.Mesh>(null),
    handL: useRef<THREE.Mesh>(null),
    handR: useRef<THREE.Mesh>(null),
  };
  const filt = useRef<{ h: number; key: string } | null>(null);
  const geo = useMemo(() => ({ cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 18, 14) }), []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.mannequin, roughness: 0.75 }), []);
  const upperMat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.mannequin, roughness: 0.75 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.mannequinDark, roughness: 0.7 }), []);
  upperMat.transparent = avatar === 'legs';
  upperMat.opacity = avatar === 'legs' ? 0.22 : 1;
  upperMat.depthWrite = avatar !== 'legs';
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
    if (!showBody) return;
    const pel = r.pelvis.current;
    if (pel) {
      pel.position.set(...m3(j.pelvis));
      pel.rotation.set(0, -j.yaw * DEG, j.roll * DEG, 'YXZ');
    }
    const torso = r.torso.current;
    if (torso) {
      const mid: Vec3 = [(j.pelvis[0] + j.chest[0]) / 2, (j.pelvis[1] + j.chest[1]) / 2, (j.pelvis[2] + 0.06 + j.chest[2]) / 2];
      torso.position.set(...m3(mid));
      torso.rotation.set(0, -j.yaw * DEG, 0);
    }
    setSegment(r.shoulders.current, j.shoulders.L, j.shoulders.R, 0.05);
    setSegment(r.neck.current, j.chest, [j.head[0], j.head[1], j.head[2] - 0.08], 0.04);
    setPoint(r.head.current, j.head);
    setSegment(r.thighL.current, j.hips.L, j.knees.L, 0.062);
    setSegment(r.thighR.current, j.hips.R, j.knees.R, 0.062);
    setSegment(r.shinL.current, j.knees.L, j.ankles.L, 0.048);
    setSegment(r.shinR.current, j.knees.R, j.ankles.R, 0.048);
    setPoint(r.kneeL.current, j.knees.L);
    setPoint(r.kneeR.current, j.knees.R);
    setSegment(r.upperL.current, j.shoulders.L, j.elbows.L, 0.042);
    setSegment(r.upperR.current, j.shoulders.R, j.elbows.R, 0.042);
    setSegment(r.foreL.current, j.elbows.L, j.hands.L, 0.036);
    setSegment(r.foreR.current, j.elbows.R, j.hands.R, 0.036);
    setPoint(r.handL.current, j.hands.L);
    setPoint(r.handR.current, j.hands.R);
  });

  return (
    <group>
      <Shoes swap={mirror} handle={shoes} />
      {showBody ? (
        <group>
          <mesh ref={r.pelvis} material={darkMat} castShadow>
            <boxGeometry args={[0.3, 0.14, 0.18]} />
          </mesh>
          <mesh ref={r.torso} material={upperMat} castShadow>
            <boxGeometry args={[0.32, 0.42, 0.17]} />
          </mesh>
          <mesh ref={r.shoulders} geometry={geo.cyl} material={upperMat} castShadow />
          <mesh ref={r.neck} geometry={geo.cyl} material={upperMat} />
          <mesh ref={r.head} geometry={geo.sph} material={upperMat} scale={0.1} castShadow />
          <mesh ref={r.thighL} geometry={geo.cyl} material={bodyMat} castShadow />
          <mesh ref={r.thighR} geometry={geo.cyl} material={bodyMat} castShadow />
          <mesh ref={r.shinL} geometry={geo.cyl} material={bodyMat} castShadow />
          <mesh ref={r.shinR} geometry={geo.cyl} material={bodyMat} castShadow />
          <mesh ref={r.kneeL} geometry={geo.sph} material={bodyMat} scale={0.058} />
          <mesh ref={r.kneeR} geometry={geo.sph} material={bodyMat} scale={0.058} />
          <mesh ref={r.upperL} geometry={geo.cyl} material={upperMat} castShadow />
          <mesh ref={r.upperR} geometry={geo.cyl} material={upperMat} castShadow />
          <mesh ref={r.foreL} geometry={geo.cyl} material={upperMat} />
          <mesh ref={r.foreR} geometry={geo.cyl} material={upperMat} />
          <mesh ref={r.handL} geometry={geo.sph} material={upperMat} scale={0.045} />
          <mesh ref={r.handR} geometry={geo.sph} material={upperMat} scale={0.045} />
        </group>
      ) : null}
    </group>
  );
}
