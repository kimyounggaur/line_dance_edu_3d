'use client';
// 3D 무대 (설계문서 8.10): <Floor/> <WallLabels/> <Footprints/> <PathArrow/> <WeightDiscs/> <PelvisTrail/> <FacingArrow/> <TurnArc/>
// <GroundShadows/> <Dancer/> <GhostDancer/> <CameraRig/>
// 매 프레임 pose(beat)를 계산해 물체의 위치 · 회전만 직접 바꾼다 (React 상태는 바꾸지 않는다).
// 바닥은 넓게 깔고 안개로 먼 곳을 배경색에 녹인다. 격자는 가장자리로 갈수록 옅어진다(위에서 보기는 안개 없음).
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
import { Dancer, GhostDancer } from './Dancer';
import { GroundShadows } from './GroundShadows';
import { CameraRig } from './CameraRig';
import { FOV_DEG } from './cameraFit';

const HALF = 4; // 격자 8 m × 8 m (6.6)
const GROUND = 40; // 바닥 판은 넓게 — 끝이 안개 속으로 사라진다
const GRID = 0.36; // 격자 간격 1u (기본 보폭 단위)
const BG = '#eef0f3';
const FADE: [number, number] = [2.4, HALF]; // 이 반지름(m) 사이에서 격자가 사라진다

function Floor({ grid, unitM }: { grid: boolean; unitM: number }) {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(COLORS.grid);
    const step = unitM || GRID;
    const n = Math.floor(HALF / step);
    const SEGS = 32; // 선마다 잘게 나눠 끝으로 갈수록 투명하게
    const alpha = (x: number, z: number) => {
      const t = Math.min(1, Math.max(0, (Math.hypot(x, z) - FADE[0]) / (FADE[1] - FADE[0])));
      return 1 - t * t * (3 - 2 * t);
    };
    const push = (x: number, z: number) => {
      pts.push(x, 0.0005, z);
      col.push(c.r, c.g, c.b, alpha(x, z));
    };
    for (let i = -n; i <= n; i++) {
      const v = i * step;
      for (let k = 0; k < SEGS; k++) {
        const u0 = -HALF + (2 * HALF * k) / SEGS;
        const u1 = -HALF + (2 * HALF * (k + 1)) / SEGS;
        push(u0, v);
        push(u1, v);
        push(v, u0);
        push(v, u1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    return g;
  }, [unitM]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND, GROUND]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.95} />
      </mesh>
      {grid ? (
        <lineSegments geometry={lines}>
          <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
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
          <spriteMaterial map={l.t.tex} transparent fog={false} />
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
          <PerspectiveCamera makeDefault fov={FOV_DEG} position={[0, 1.7, 4.2]} near={0.05} far={60} />
        )}
        <color attach="background" args={[BG]} />
        {settings.view !== 'top' ? <fog attach="fog" args={[BG, 7, 17]} /> : null}
        <hemisphereLight args={['#ffffff', '#b9bfca', 1.15]} />
        {/* 해를 높이 두어 그림자를 짧게(몸 아래에 모이게), 그림자 농도는 절반 남짓 — 위에서 보기에서 그림자가 두 번째 사람처럼 보이지 않게 */}
        <directionalLight
          position={[1.5, 8, 2.5]}
          intensity={1.5}
          castShadow={!degraded}
          shadow-intensity={0.55}
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
        <GroundShadows mirror={mirror} body={settings.avatar !== 'shoes'} />
        <Dancer mirror={mirror} avatar={settings.avatar} arms={settings.arms} />
        {settings.ghost !== 'off' && !mask ? <GhostDancer mirror={mirror} avatar={settings.avatar} arms={settings.arms} mode={settings.ghost} /> : null}
        <CameraRig view={settings.view} followPos={settings.followPos} followFacing={settings.followFacing} mirror={mirror} closeUp={settings.closeUp} />
        {settings.view === 'free' ? <OrbitControls makeDefault enableDamping minDistance={1.2} maxDistance={12} maxPolarAngle={Math.PI / 2.05} /> : null}
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
