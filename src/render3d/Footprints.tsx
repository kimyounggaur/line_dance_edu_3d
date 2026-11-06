'use client';
// 바닥의 발자국 · 번호 · 다음 발자국(점선 깜빡임) · 홈 표시 · 블록 시작 십자 (설계문서 6.6)
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import type { Foot, ResolvedStep, Vec2 } from '@/engine/types';
import { BODY, HOME } from '@/engine/constants';
import { localToWorld } from '@/engine/geometry';
import { mapBeat, stepsInBlock, type Track } from '@/engine/track';
import { computeFrame, useFrameInfo } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { COLORS, footOutlineShape, footShape, textTexture } from './textures';
import { DEG, floor3 } from './coords';

export interface FootprintsProps {
  mirror: boolean;
  mode: 'block' | 'next2' | 'off';
  mask?: boolean;
}

const LIFT = 0.002;

function displayFoot(f: Foot, mirror: boolean): Foot {
  return mirror ? (f === 'L' ? 'R' : 'L') : f;
}

function FootprintMesh({ step, shift, unitM, mirror, dim }: { step: ResolvedStep; shift: Vec2; unitM: number; mirror: boolean; dim: boolean }) {
  const foot = displayFoot(step.foot, mirror);
  const color = COLORS[foot];
  const geo = useMemo(() => {
    const shape = step.action === 'touch' ? footOutlineShape(BODY.footLen, BODY.footWid, 0.014) : footShape(BODY.footLen, BODY.footWid);
    return new THREE.ShapeGeometry(shape, 12);
  }, [step.action]);
  const p = floor3([step.to[0] + shift[0], step.to[1] + shift[1]], unitM, LIFT);
  const label = useMemo(() => textTexture(`${foot}${step.count}`, { color: step.action === 'touch' ? color : '#ffffff', size: 64, weight: 700 }), [foot, step.count, step.action, color]);
  const lh = 0.075;
  return (
    <group position={p} rotation={[0, -step.yawTo * DEG, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geo} receiveShadow>
        <meshBasicMaterial color={color} transparent opacity={dim ? 0.38 : 0.85} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, mirror ? Math.PI : 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[lh * label.aspect, lh]} />
        <meshBasicMaterial map={label.tex} transparent depthWrite={false} opacity={step.action === 'touch' ? 1 : dim ? 0.7 : 1} />
      </mesh>
    </group>
  );
}

function DashedFoot({ center, yaw, unitM, color, blink }: { center: Vec2; yaw: number; unitM: number; color: string; blink?: boolean }) {
  const ref = useRef<THREE.LineLoop>(null);
  const geo = useMemo(() => {
    const pts = footShape(BODY.footLen + 0.03, BODY.footWid + 0.03).getPoints(40);
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((v) => new THREE.Vector3(v.x, v.y, 0)));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.computeLineDistances();
    const m = ref.current.material as THREE.LineDashedMaterial;
    m.opacity = blink ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 5.5)) : 0.7;
  });
  return (
    <group position={floor3(center, unitM, LIFT * 2)} rotation={[0, -yaw * DEG, 0]}>
      <lineLoop ref={ref} geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <lineDashedMaterial color={color} dashSize={0.025} gapSize={0.018} transparent />
      </lineLoop>
    </group>
  );
}

export function Footprints({ mirror, mode, mask }: FootprintsProps) {
  const info = useFrameInfo(useShallow((s) => ({ blockSeq: s.blockSeq, rep: s.rep, trackKey: s.trackKey, stepIndex: s.stepIndex })));
  const track: Track | null = mirror ? player.mirrorTrack : player.track;
  const data = useMemo(() => {
    if (!track) return null;
    const f = computeFrame();
    const block = track.blocks[Math.min(info.blockSeq, track.blocks.length - 1)];
    const shift = mapBeat(track, Math.max(0, f.beat)).shift;
    const steps = stepsInBlock(track, block);
    const home = (['L', 'R'] as Foot[]).map((foot) => ({ foot, p: localToWorld(block.origin, block.heading, HOME[foot]) }));
    return { block, shift, steps, home };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, info.blockSeq, info.rep, info.trackKey]);
  if (!track || !data) return null;
  const U = track.params.unitM;
  const cur = info.stepIndex;
  const next = track.steps[cur + 1] ?? null;
  const visible = mask || mode === 'off' ? [] : mode === 'next2' ? data.steps.filter((s) => s.index > cur && s.index <= cur + 2) : data.steps;
  const o = floor3([data.block.origin[0] + data.shift[0], data.block.origin[1] + data.shift[1]], U, LIFT);
  return (
    <group>
      {/* 블록 시작 자리의 십자 */}
      <group position={o} rotation={[0, -data.block.heading * DEG, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.36, 0.012]} />
          <meshBasicMaterial color={COLORS.ink} transparent opacity={0.45} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.36, 0.012]} />
          <meshBasicMaterial color={COLORS.ink} transparent opacity={0.45} />
        </mesh>
      </group>
      {/* 홈 (점선) */}
      {data.home.map((h) => (
        <DashedFoot key={h.foot} center={[h.p[0] + data.shift[0], h.p[1] + data.shift[1]]} yaw={data.block.heading} unitM={U} color={COLORS.ink} />
      ))}
      {visible.map((s) => (
        <FootprintMesh key={s.index} step={s} shift={data.shift} unitM={U} mirror={mirror} dim={s.index > cur} />
      ))}
      {!mask && next && mode !== 'off' ? (
        <DashedFoot center={[next.to[0] + data.shift[0], next.to[1] + data.shift[1]]} yaw={next.yawTo} unitM={U} color={COLORS[displayFoot(next.foot, mirror)]} blink />
      ) : null}
    </group>
  );
}
