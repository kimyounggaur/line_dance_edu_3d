'use client';
// 신발 두 짝: 왼쪽 파랑 L · 오른쪽 주황 R. 체중이 실린 신발은 진하게 (8.6). 거울 모드는 색 · 글자를 서로 바꾼다 (8.10)
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Foot } from '@/engine/types';
import { BODY } from '@/engine/constants';
import type { AvatarJoints } from '@/engine/ik';
import { COLORS, textTexture } from './textures';
import { DEG, m3 } from './coords';

const TINT = { L: new THREE.Color('#9DB8F5'), R: new THREE.Color('#F6B48E') };
const FULL = { L: new THREE.Color(COLORS.L), R: new THREE.Color(COLORS.R) };

export interface ShoesHandle {
  update(j: AvatarJoints, weightR: number): void;
}

export function useShoes(swap: boolean) {
  const groups = { L: useRef<THREE.Group>(null), R: useRef<THREE.Group>(null) };
  const mats = { L: useRef<THREE.MeshStandardMaterial>(null), R: useRef<THREE.MeshStandardMaterial>(null) };
  const update = (j: AvatarJoints, weightR: number) => {
    for (const foot of ['L', 'R'] as const) {
      const g = groups[foot].current;
      if (!g) continue;
      const s = j.shoes[foot];
      g.position.set(...m3(s.center));
      g.rotation.set(-s.pitch, -s.yaw * DEG, 0, 'YXZ');
      const shown: Foot = swap ? (foot === 'L' ? 'R' : 'L') : foot;
      const share = foot === 'R' ? weightR : 1 - weightR;
      const m = mats[foot].current;
      if (m) m.color.copy(TINT[shown]).lerp(FULL[shown], 0.25 + 0.75 * share);
    }
  };
  return { groups, mats, update };
}

export function Shoes({ swap, handle }: { swap: boolean; handle: ReturnType<typeof useShoes> }) {
  const letters = useMemo(
    () => ({
      L: textTexture('L', { color: '#ffffff', size: 120, weight: 800, padX: 20, padY: 6 }),
      R: textTexture('R', { color: '#ffffff', size: 120, weight: 800, padX: 20, padY: 6 }),
    }),
    [],
  );
  return (
    <>
      {(['L', 'R'] as const).map((foot) => {
        const shown: Foot = swap ? (foot === 'L' ? 'R' : 'L') : foot;
        const lt = letters[shown];
        return (
          <group key={foot} ref={handle.groups[foot]}>
            <mesh castShadow>
              <boxGeometry args={[BODY.footWid, BODY.footH, BODY.footLen]} />
              <meshStandardMaterial ref={handle.mats[foot]} color={COLORS[shown]} roughness={0.55} />
            </mesh>
            <mesh position={[0, BODY.footH / 2 + 0.0015, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.07 * lt.aspect * 0.8, 0.09]} />
              <meshBasicMaterial map={lt.tex} transparent depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** 신발만 쓰는 곳에서 매 프레임 갱신 */
export function useShoeFrame(handle: ReturnType<typeof useShoes>, get: () => { j: AvatarJoints; w: number } | null) {
  useFrame(() => {
    const d = get();
    if (d) handle.update(d.j, d.w);
  });
}
