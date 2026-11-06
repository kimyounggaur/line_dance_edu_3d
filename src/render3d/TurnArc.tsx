'use client';
// 회전 예고: 회전하는 걸음 1박 전부터 보라색 호 ↻ + "1/4 오른쪽" (6.6, 8.7)
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS, textTexture } from './textures';
import { DEG } from './coords';

export function TurnArc({ mirror }: { mirror: boolean }) {
  const group = useRef<THREE.Group>(null);
  const arcRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Sprite>(null);
  const labels = useMemo(
    () => ({
      R: textTexture('↻ 1/4 오른쪽', { color: '#ffffff', bg: COLORS.turn, size: 56, weight: 700 }),
      L: textTexture('↺ 1/4 왼쪽', { color: '#ffffff', bg: COLORS.turn, size: 56, weight: 700 }),
    }),
    [],
  );
  const arcGeo = useMemo(() => new THREE.RingGeometry(0.5, 0.56, 48, 1, 0, Math.PI / 2), []);
  const lastKey = useRef('');
  useFrame(() => {
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const canon = player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !canon || !pose || !group.current) return;
    const m = pose.currentIndex;
    let k = -1;
    for (let i = Math.max(0, m); i <= Math.min(track.steps.length - 1, m + 3); i++) {
      if (track.steps[i].turn === 0) continue;
      if (f.local >= track.timing.lift[i] - 1 && f.local <= track.timing.T[i]) {
        k = i;
        break;
      }
    }
    group.current.visible = k >= 0;
    if (k < 0) return;
    const s = track.steps[k];
    const U = track.params.unitM;
    group.current.position.set(pose.pelvis.pos[0] * U, 0.005, -pose.pelvis.pos[1] * U);
    // 호: 회전 전 방향에서 회전 후 방향까지 (three의 각은 반시계가 +)
    const start = Math.PI / 2 - s.headingBefore * DEG;
    const sweep = -s.turn * DEG;
    const key = `${k}:${s.headingBefore}:${s.turn}`;
    if (arcRef.current && key !== lastKey.current) {
      lastKey.current = key;
      arcRef.current.geometry.dispose();
      arcRef.current.geometry = new THREE.RingGeometry(0.5, 0.56, 48, 1, Math.min(start, start + sweep), Math.abs(sweep));
    }
    if (labelRef.current) {
      const right = canon.steps[k] ? canon.steps[k].turn > 0 : s.turn > 0;
      const tex = right ? labels.R : labels.L;
      const mat = labelRef.current.material as THREE.SpriteMaterial;
      if (mat.map !== tex.tex) {
        mat.map = tex.tex;
        mat.needsUpdate = true;
      }
      labelRef.current.scale.set(0.22 * tex.aspect, 0.22, 1);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={arcRef} geometry={arcGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={COLORS.turn} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <sprite ref={labelRef} position={[0, 1.95, 0]}>
        <spriteMaterial map={labels.R.tex} depthTest={false} transparent />
      </sprite>
    </group>
  );
}
