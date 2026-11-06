'use client';
// 카메라 프리셋 (설계문서 8.10 표): target = 골반 자리(위치 따라가기) 또는 블록 시작 자리, h = 몸 방향(방향 따라가기) 또는 0.
// 시정수 0.25초로 부드럽게 따라간다. 동작 줄이기 설정이면 바로 맞춘다.
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ViewMode } from '@/engine/types';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { fwd3, right3 } from './coords';

const DIST = 4.2;

export function CameraRig({ view, followPos, followFacing, mirror }: { view: ViewMode; followPos: boolean; followFacing: boolean; mirror: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const st = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), cam: null as THREE.Camera | null, view: '' as string });
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useFrame((_, dt) => {
    if (view === 'free') return;
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !pose) return;
    const U = track.params.unitM;
    const block = track.blocks[Math.min(f.block?.seq ?? 0, track.blocks.length - 1)];
    const tx = followPos ? pose.pelvis.pos[0] * U : (block.origin[0] + f.shift[0]) * U;
    const tz = followPos ? -pose.pelvis.pos[1] * U : -(block.origin[1] + f.shift[1]) * U;
    const h = followFacing ? pose.heading : 0;
    const [fx, fz] = fwd3(h);
    const [rx, rz] = right3(h);
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3(tx, 0.8, tz);
    const up = new THREE.Vector3(0, 1, 0);
    switch (view) {
      case 'mirror':
        pos.set(tx + DIST * fx, 1.7, tz + DIST * fz);
        break;
      case 'side':
        pos.set(tx + DIST * rx, 1.2, tz + DIST * rz);
        break;
      case 'top':
        pos.set(tx, 6, tz);
        look.set(tx, 0, tz);
        up.set(fx, 0, fz);
        break;
      default:
        pos.set(tx - DIST * fx, 1.7, tz - DIST * fz);
    }
    const s = st.current;
    const snap = s.cam !== camera || s.view !== view || reduce;
    const a = snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) / 0.25);
    if (snap) {
      s.pos.copy(pos);
      s.look.copy(look);
      s.up.copy(up);
      s.cam = camera;
      s.view = view;
    } else {
      s.pos.lerp(pos, a);
      s.look.lerp(look, a);
      s.up.lerp(up, a).normalize();
    }
    camera.position.copy(s.pos);
    camera.up.copy(s.up);
    camera.lookAt(s.look);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      const zoom = Math.min(size.width, size.height) / 3.2; // 약 3.2 m가 보인다 (발 위치도와 비슷한 구도)
      if (Math.abs(oc.zoom - zoom) > 0.01) {
        oc.zoom = zoom;
        oc.updateProjectionMatrix();
      }
    }
  });
  return null;
}
