'use client';
// 아바타 발밑의 큰 화살표 — 몸 방향 (6.6)
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS } from './textures';
import { DEG } from './coords';

export function FacingArrow({ mirror, emphasize }: { mirror: boolean; emphasize?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    // 위(+y)가 앞. 길이 0.62 m
    s.moveTo(0, 0.62);
    s.lineTo(0.13, 0.4);
    s.lineTo(0.05, 0.4);
    s.lineTo(0.05, 0.22);
    s.lineTo(-0.05, 0.22);
    s.lineTo(-0.05, 0.4);
    s.lineTo(-0.13, 0.4);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  useFrame(() => {
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !pose || !ref.current) return;
    const U = track.params.unitM;
    ref.current.position.set(pose.pelvis.pos[0] * U, 0.0025, -pose.pelvis.pos[1] * U);
    ref.current.rotation.set(0, -pose.heading * DEG, 0);
  });
  return (
    <group ref={ref}>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={COLORS.ink} transparent opacity={emphasize ? 0.75 : 0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}
