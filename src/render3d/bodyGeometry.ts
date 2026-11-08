'use client';
// 마네킹 모양 (설계문서 8.6): 팔다리는 끝이 가늘어지는 캡슐, 몸통 · 골반은 모서리가 둥근 상자.
// 길이는 IK가 지키는 뼈 길이(BODY)와 같아서 매 프레임 위치 · 방향만 바꾼다(늘이지 않는다).
// 모양은 한 번만 만들어 본 마네킹과 다음 자세 마네킹이 함께 쓴다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BODY } from '@/engine/constants';
import { BODY_COLORS } from './textures';

/** 양 끝 반지름이 다른 캡슐. 길이 축 = +y. 뿌리(rA)가 −len/2, 끝(rB)이 +len/2 */
export function taperedCapsule(rA: number, rB: number, len: number, radial = 16, cap = 6): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= cap; i++) {
    const t = -Math.PI / 2 + (Math.PI / 2) * (i / cap);
    pts.push(new THREE.Vector2(Math.max(0, rA * Math.cos(t)), -len / 2 + rA * Math.sin(t)));
  }
  for (let i = 0; i <= cap; i++) {
    const t = (Math.PI / 2) * (i / cap);
    pts.push(new THREE.Vector2(Math.max(0, rB * Math.cos(t)), len / 2 + rB * Math.sin(t)));
  }
  return new THREE.LatheGeometry(pts, radial);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 몸통: 어깨가 넓고 허리가 좁다. 앞(−z)은 밝은 색, 뒤(+z)는 어두운 색 (꼭짓점 색) */
function torsoGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 3, 0.06);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const front = new THREE.Color(BODY_COLORS.shirtFront);
  const back = new THREE.Color(BODY_COLORS.shirtBack);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + h / 2) / h; // 0 = 허리, 1 = 어깨
    pos.setX(i, pos.getX(i) * (0.8 + 0.2 * t));
    pos.setZ(i, z * (0.9 + 0.1 * t));
    c.copy(front).lerp(back, smooth(-0.015, 0.03, z));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export const SEG = {
  thigh: BODY.thigh,
  shin: BODY.shin,
  upperArm: BODY.upperArm,
  forearm: BODY.forearm,
  neck: BODY.shoulderToHead - 0.08,
};

export const TORSO = { w: 0.36, h: 0.44, d: 0.2, lift: 0.06 };

export interface BodyGeometry {
  thigh: THREE.BufferGeometry;
  shin: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  forearm: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  pelvis: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  hairBack: THREE.BufferGeometry;
  hairTop: THREE.BufferGeometry;
  nose: THREE.BufferGeometry;
  joint: THREE.BufferGeometry;
  shoe: THREE.BufferGeometry;
}

let shared: BodyGeometry | null = null;

export function bodyGeometry(): BodyGeometry {
  if (shared) return shared;
  const R = BODY.headR;
  shared = {
    thigh: taperedCapsule(0.068, 0.05, SEG.thigh),
    shin: taperedCapsule(0.05, 0.034, SEG.shin),
    upperArm: taperedCapsule(0.045, 0.036, SEG.upperArm),
    forearm: taperedCapsule(0.035, 0.029, SEG.forearm),
    neck: taperedCapsule(0.043, 0.04, SEG.neck, 12, 3),
    torso: torsoGeometry(TORSO.w, TORSO.h, TORSO.d),
    pelvis: new RoundedBoxGeometry(0.31, 0.18, 0.2, 3, 0.05),
    head: new THREE.SphereGeometry(R, 28, 20),
    // 머리카락: 정수리 전체 + 뒤쪽(+z) 반구를 귀 아래까지 → 뒤에서 보면 어둡고, 앞에서 보면 얼굴이 보인다
    hairBack: new THREE.SphereGeometry(R * 1.05, 28, 14, 0, Math.PI, 0, Math.PI * 0.62),
    hairTop: new THREE.SphereGeometry(R * 1.05, 28, 6, 0, Math.PI * 2, 0, Math.PI * 0.3),
    nose: new THREE.SphereGeometry(0.022, 12, 8),
    joint: new THREE.SphereGeometry(1, 18, 12),
    shoe: new RoundedBoxGeometry(BODY.footWid, BODY.footH, BODY.footLen, 2, 0.022),
  };
  return shared;
}
