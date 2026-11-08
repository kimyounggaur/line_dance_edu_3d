'use client';
// 접지 그림자: 발마다 바닥에 붙는 부드러운 그림자 + 몸 아래의 옅은 그림자.
// 발을 들면 그림자가 작아지고 옅어져서 발이 언제 떠 있는지가 보인다. 그림자 맵이 꺼진 저사양 모드에서도 남는다(가볍다).
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BODY } from '@/engine/constants';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { blobTexture } from './textures';
import { DEG, floor3 } from './coords';

const Y = 0.0012; // 체중 원(0.0015) · 발자국(0.002)보다 아래
const SHADOW = '#1E2636';
const LIFT_FULL = 0.08; // 이 높이(m)에서 가장 작고 옅다

export function GroundShadows({ mirror, body }: { mirror: boolean; body: boolean }) {
  const feet = { L: useRef<THREE.Mesh>(null), R: useRef<THREE.Mesh>(null) };
  const torso = useRef<THREE.Mesh>(null);
  const tex = blobTexture();

  useFrame(() => {
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !pose) return;
    const U = track.params.unitM;
    for (const foot of ['L', 'R'] as const) {
      const m = feet[foot].current;
      if (!m) continue;
      const fp = pose.feet[foot];
      const k = Math.min(1, Math.max(0, fp.height / LIFT_FULL));
      const [x, , z] = floor3(fp.pos, U, Y);
      m.position.set(x, Y, z);
      m.rotation.set(-Math.PI / 2, 0, -fp.yaw * DEG);
      const s = 1 - 0.35 * k;
      m.scale.set(BODY.footWid * 2.1 * s, BODY.footLen * 1.45 * s, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - 0.65 * k);
    }
    const t = torso.current;
    if (t) {
      const [x, , z] = floor3(pose.pelvis.pos, U, Y);
      t.position.set(x, Y - 0.0002, z);
      t.rotation.set(-Math.PI / 2, 0, -pose.heading * DEG);
    }
  });

  return (
    <group>
      {(['L', 'R'] as const).map((foot) => (
        <mesh key={foot} ref={feet[foot]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color={SHADOW} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
      {body ? (
        <mesh ref={torso} scale={[0.62, 0.42, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color={SHADOW} transparent opacity={0.13} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
