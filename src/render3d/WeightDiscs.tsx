'use client';
// 지지발 아래의 체중 원: 체중 비율만큼 크고 진하다 (6.6)
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS } from './textures';
import { floor3 } from './coords';

export function WeightDiscs({ mirror, emphasize }: { mirror: boolean; emphasize?: boolean }) {
  const refs = { L: useRef<THREE.Mesh>(null), R: useRef<THREE.Mesh>(null) };
  useFrame(() => {
    const f = computeFrame();
    const pose = mirror ? f.mirrorPose : f.pose;
    const track = mirror ? player.mirrorTrack : player.track;
    if (!pose || !track) return;
    const U = track.params.unitM;
    for (const foot of ['L', 'R'] as const) {
      const m = refs[foot].current;
      if (!m) continue;
      const share = foot === 'R' ? pose.weightR : 1 - pose.weightR;
      const fp = pose.feet[foot];
      const [x, , z] = floor3(fp.pos, U, 0.001);
      m.position.set(x, 0.0015, z);
      const s = (emphasize ? 0.1 : 0.07) + 0.13 * share;
      m.scale.set(s, s, s);
      (m.material as THREE.MeshBasicMaterial).opacity = (emphasize ? 0.12 : 0.06) + 0.42 * share;
      m.visible = fp.height < 0.02;
    }
  });
  const color = (f: 'L' | 'R') => COLORS[mirror ? (f === 'L' ? 'R' : 'L') : f];
  return (
    <group>
      {(['L', 'R'] as const).map((f) => (
        <mesh key={f} ref={refs[f]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial color={color(f)} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
