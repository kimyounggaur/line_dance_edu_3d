'use client';
// 골반을 바닥에 내린 점 + 최근 2박의 궤적선 (6.6)
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { poseAt } from '@/engine/pose';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS } from './textures';

const N = 21;

export function PelvisTrail({ mirror, trail = true }: { mirror: boolean; trail?: boolean }) {
  const dot = useRef<THREE.Mesh>(null);
  const line = useRef<THREE.Line>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  useFrame(() => {
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !pose) return;
    const U = track.params.unitM;
    if (dot.current) dot.current.position.set(pose.pelvis.pos[0] * U, 0.004, -pose.pelvis.pos[1] * U);
    if (!trail || !line.current) return;
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const b = Math.max(-1, f.beat - 2 + (2 * i) / (N - 1));
      const p = i === N - 1 ? pose : poseAt(track, b);
      arr[i * 3] = p.pelvis.pos[0] * U;
      arr[i * 3 + 1] = 0.003;
      arr[i * 3 + 2] = -p.pelvis.pos[1] * U;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
  });
  return (
    <group>
      <mesh ref={dot} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.03, 24]} />
        <meshBasicMaterial color={COLORS.pelvis} />
      </mesh>
      {trail ? (
        // @ts-expect-error — R3F의 <line>은 SVG line과 이름이 겹친다
        <line ref={line} geometry={geo}>
          <lineBasicMaterial color={COLORS.pelvis} transparent opacity={0.8} />
        </line>
      ) : null}
    </group>
  );
}
