'use client';
// 카메라 프리셋 (설계문서 8.10 표): target = 골반 자리(위치 따라가기) 또는 블록 시작 자리, h = 몸 방향(방향 따라가기) 또는 0.
// 거리 · 높이는 무대 크기에 맞춘다(cameraFit.ts). 발 확대는 낮은 자리에서 두 발의 가운데 · 발목 높이를 본다.
// 자유 시점은 OrbitControls의 중심이 target을 따라가서 아바타가 화면 밖으로 나가지 않는다(돌린 각도 · 거리는 그대로).
// 시정수 0.25초로 부드럽게 따라간다. 동작 줄이기 설정이면 바로 맞춘다.
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ViewMode } from '@/engine/types';
import { computeFrame } from '@/lib/frameBus';
import { player } from '@/lib/player';
import { fwd3, right3 } from './coords';
import { presetCamera, topSpan } from './cameraFit';

interface OrbitLike {
  target: THREE.Vector3;
}

export interface CameraRigProps {
  view: ViewMode;
  followPos: boolean;
  followFacing: boolean;
  mirror: boolean;
  closeUp: boolean;
}

export function CameraRig({ view, followPos, followFacing, mirror, closeUp }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const st = useRef({
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    wantPos: new THREE.Vector3(),
    wantLook: new THREE.Vector3(),
    wantUp: new THREE.Vector3(),
    cam: null as THREE.Camera | null,
    view: '' as string,
    ctl: null as OrbitLike | null,
  });
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useFrame((_, dt) => {
    const f = computeFrame();
    const track = mirror ? player.mirrorTrack : player.track;
    const pose = mirror ? f.mirrorPose : f.pose;
    if (!track || !pose) return;
    const U = track.params.unitM;
    const block = track.blocks[Math.min(f.block?.seq ?? 0, track.blocks.length - 1)];
    // 발 확대는 두 발의 가운데를 따라간다(발이 화면 밖으로 나가지 않게). 그 밖에는 8.10 표대로
    const feetMid = [(pose.feet.L.pos[0] + pose.feet.R.pos[0]) / 2, (pose.feet.L.pos[1] + pose.feet.R.pos[1]) / 2];
    const zoomFeet = closeUp && view !== 'free';
    const [cx, cy] = zoomFeet ? feetMid : followPos ? pose.pelvis.pos : [block.origin[0] + f.shift[0], block.origin[1] + f.shift[1]];
    const tx = cx * U;
    const tz = -cy * U;
    const s = st.current;
    const a = reduce ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) / 0.25);

    if (view === 'free') {
      if (!controls) return;
      if (s.ctl !== controls) {
        controls.target.copy(s.view ? s.look : s.wantLook.set(tx, 0.8, tz)); // 자유 시점에 들어온 순간: 보던 곳에서 시작
        s.ctl = controls;
      }
      // 중심이 움직인 만큼 카메라도 같이 옮긴다 → 사용자가 돌려 놓은 각도와 거리는 그대로
      const d = s.wantLook.set(tx, 0.8, tz).sub(controls.target).multiplyScalar(a);
      controls.target.add(d);
      camera.position.add(d);
      s.look.copy(controls.target);
      s.pos.copy(camera.position);
      s.cam = camera;
      s.view = view;
      return;
    }
    s.ctl = null;

    const h = followFacing ? pose.heading : 0;
    const [fx, fz] = fwd3(h);
    const [rx, rz] = right3(h);
    const pos = s.wantPos;
    const look = s.wantLook;
    const up = s.wantUp.set(0, 1, 0);
    if (view === 'top') {
      pos.set(tx, 6, tz);
      look.set(tx, 0, tz);
      up.set(fx, 0, fz);
    } else {
      const c = presetCamera(view, closeUp, size.width, size.height);
      if (view === 'mirror') pos.set(tx + c.dist * fx, c.height, tz + c.dist * fz);
      else if (view === 'side') pos.set(tx + c.dist * rx, c.height, tz + c.dist * rz);
      else pos.set(tx - c.dist * fx, c.height, tz - c.dist * fz);
      look.set(tx, c.lookH, tz);
    }
    // 시점을 바꾸면 바로 옮기고, 발 확대 · 따라가기는 부드럽게 옮긴다
    const snap = s.cam !== camera || s.view !== view || reduce;
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
      const zoom = Math.min(size.width, size.height) / topSpan(closeUp);
      if (Math.abs(oc.zoom - zoom) > 0.01) {
        oc.zoom = snap ? zoom : oc.zoom + (zoom - oc.zoom) * a;
        oc.updateProjectionMatrix();
      }
    }
  });
  return null;
}
