'use client';
// 다음 걸음의 발 경로를 따라 휜 화살표 (6.6, 8.4의 베지어)
import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { mapBeat, type Track } from '@/engine/track';
import { computeFrame, useFrameInfo } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS } from './textures';

export function PathArrow({ mirror, emphasize }: { mirror: boolean; emphasize?: boolean }) {
  const info = useFrameInfo(useShallow((s) => ({ stepIndex: s.stepIndex, rep: s.rep, trackKey: s.trackKey })));
  const track: Track | null = mirror ? player.mirrorTrack : player.track;
  const geo = useMemo(() => {
    if (!track) return null;
    const next = track.steps[info.stepIndex + 1];
    if (!next || next.distance < 0.05) return null;
    const U = track.params.unitM;
    const shift = mapBeat(track, Math.max(0, computeFrame().beat)).shift;
    const v = (p: [number, number], h: number) => new THREE.Vector3((p[0] + shift[0]) * U, h, -(p[1] + shift[1]) * U);
    const curve = new THREE.QuadraticBezierCurve3(v(next.from, 0.012), v(next.ctrl, 0.012), v(next.to, 0.012));
    const tube = new THREE.TubeGeometry(curve, 32, emphasize ? 0.016 : 0.011, 6, false);
    const end = curve.getPoint(1);
    const tan = curve.getTangent(0.98).normalize();
    const foot = mirror ? (next.foot === 'L' ? 'R' : 'L') : next.foot;
    return { tube, end, tan, color: COLORS[foot] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, info.stepIndex, info.rep, info.trackKey, emphasize]);
  if (!geo) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), geo.tan);
  const head = geo.end.clone().addScaledVector(geo.tan, -0.03);
  return (
    <group>
      <mesh geometry={geo.tube}>
        <meshBasicMaterial color={geo.color} transparent opacity={0.9} />
      </mesh>
      <mesh position={head} quaternion={q}>
        <coneGeometry args={[emphasize ? 0.045 : 0.035, 0.09, 12]} />
        <meshBasicMaterial color={geo.color} />
      </mesh>
    </group>
  );
}
