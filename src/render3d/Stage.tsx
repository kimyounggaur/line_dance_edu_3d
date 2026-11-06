'use client';
// 3D 무대 (설계문서 8.10): <Floor/> <WallLabels/> <Footprints/> <PathArrow/> <WeightDiscs/> <PelvisTrail/> <FacingArrow/> <TurnArc/> <Dancer/> <CameraRig/>
// 매 프레임 pose(beat)를 계산해 물체의 위치 · 회전만 직접 바꾼다 (React 상태는 바꾸지 않는다).
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { setMirrorWanted } from '@/lib/frameBus';
import { cn } from '@/lib/cn';
import type { StageProps } from './types';
import { COLORS, textTexture } from './textures';
import { Footprints } from './Footprints';
import { PathArrow } from './PathArrow';
import { WeightDiscs } from './WeightDiscs';
import { PelvisTrail } from './PelvisTrail';
import { FacingArrow } from './FacingArrow';
import { TurnArc } from './TurnArc';
import { Dancer } from './Dancer';
import { CameraRig } from './CameraRig';

const HALF = 4; // 바닥 8 m × 8 m
const GRID = 0.36; // 격자 간격 1u (기본 보폭 단위)

function Floor({ grid, unitM }: { grid: boolean; unitM: number }) {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const step = unitM || GRID;
    const n = Math.floor(HALF / step);
    for (let i = -n; i <= n; i++) {
      const v = i * step;
      pts.push(-HALF, 0.0005, v, HALF, 0.0005, v, v, 0.0005, -HALF, v, 0.0005, HALF);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [unitM]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.95} />
      </mesh>
      {grid ? (
        <lineSegments geometry={lines}>
          <lineBasicMaterial color={COLORS.grid} transparent opacity={0.9} />
        </lineSegments>
      ) : null}
    </group>
  );
}

function WallLabels({ mirror }: { mirror: boolean }) {
  const labels = useMemo(() => {
    const mk = (t: string) => textTexture(t, { color: '#ffffff', bg: COLORS.ink, size: 64, weight: 700 });
    return [
      { t: mk('12시 · 앞'), p: [0, 0.32, -HALF - 0.1] as const },
      { t: mk(mirror ? '9시' : '3시'), p: [HALF + 0.1, 0.32, 0] as const },
      { t: mk('6시 · 뒤'), p: [0, 0.32, HALF + 0.1] as const },
      { t: mk(mirror ? '3시' : '9시'), p: [-HALF - 0.1, 0.32, 0] as const },
    ];
  }, [mirror]);
  return (
    <group>
      {labels.map((l, i) => (
        <sprite key={i} position={l.p as unknown as [number, number, number]} scale={[0.34 * l.t.aspect, 0.34, 1]}>
          <spriteMaterial map={l.t.tex} transparent />
        </sprite>
      ))}
    </group>
  );
}

function PerfMonitor({ onDegrade }: { onDegrade: () => void }) {
  const acc = useRef({ t: 0, frames: 0, low: 0, done: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done || dt > 0.5) return; // 탭을 비웠다 돌아온 프레임은 세지 않는다
    a.t += dt;
    a.frames++;
    if (a.t >= 0.5) {
      const fps = a.frames / a.t;
      a.low = fps < 30 ? a.low + a.t : 0;
      a.t = 0;
      a.frames = 0;
      if (a.low >= 3) {
        a.done = true;
        onDegrade();
      }
    }
  });
  return null;
}

export default function Stage({ settings, mask, highlight, className, onDegrade }: StageProps) {
  const mirror = settings.view === 'mirror';
  const [degraded, setDegraded] = useState(false);
  useEffect(() => {
    setMirrorWanted(mirror);
    return () => setMirrorWanted(false);
  }, [mirror]);
  const hl = (h: string) => highlight?.includes(h as never) ?? false;
  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-[#eef0f3]', className)}>
      <Canvas shadows="percentage" dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }} role="img" aria-label="3D 무대: 아바타와 바닥 발자국">
        {settings.view === 'top' ? (
          <OrthographicCamera makeDefault position={[0, 6, 0]} near={0.1} far={40} />
        ) : (
          <PerspectiveCamera makeDefault fov={40} position={[0, 1.7, 4.2]} near={0.05} far={60} />
        )}
        <color attach="background" args={['#eef0f3']} />
        <hemisphereLight args={['#ffffff', '#b9bfca', 1.15]} />
        <directionalLight
          position={[2.5, 6, 3.5]}
          intensity={1.5}
          castShadow={!degraded}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
          shadow-camera-near={0.5}
          shadow-camera-far={15}
        />
        <Floor grid={settings.layers.grid} unitM={settings.unitM} />
        {settings.layers.walls ? <WallLabels mirror={mirror} /> : null}
        <Footprints mirror={mirror} mode={settings.layers.footprints} mask={mask} />
        {settings.layers.arrows && !mask ? <PathArrow mirror={mirror} emphasize={hl('path')} /> : null}
        {settings.layers.weight ? <WeightDiscs mirror={mirror} emphasize={hl('weight')} /> : null}
        {settings.layers.pelvis ? <PelvisTrail mirror={mirror} trail={!degraded} /> : null}
        {settings.layers.facing ? <FacingArrow mirror={mirror} emphasize={hl('facing')} /> : null}
        <TurnArc mirror={mirror} />
        <Dancer mirror={mirror} avatar={settings.avatar} arms={settings.arms} />
        <CameraRig view={settings.view} followPos={settings.followPos} followFacing={settings.followFacing} mirror={mirror} />
        {settings.view === 'free' ? <OrbitControls makeDefault target={[0, 0.8, 0]} enableDamping maxPolarAngle={Math.PI / 2.05} /> : null}
        <PerfMonitor
          onDegrade={() => {
            setDegraded(true);
            onDegrade?.();
          }}
        />
      </Canvas>
    </div>
  );
}
