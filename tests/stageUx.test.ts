// 무대 고도화 (설계문서 6.5 · 6.6 · 8.10) — 표시 묶음 · 다음 자세 미리 보기 · 카메라 구도 · 설정 정리
import { describe, expect, it } from 'vitest';
import { LAYER_PRESETS, matchLayerPreset, presetLayers } from '@/lib/viewPresets';
import { ghostBeat } from '@/lib/ghost';
import { FOV_DEG, presetCamera, topSpan } from '@/render3d/cameraFit';
import { DEFAULT_SETTINGS, sanitize } from '@/store/settings';
import { poseAt } from '@/engine/pose';
import { dist } from '@/engine/geometry';
import { BLOCK_IDS, ROUTINE_IDS, blockTrack, routineTrack } from './helpers';

describe('표시 묶음 (6.5)', () => {
  it('기본 표시 요소는 「처음 배울 때」와 같다', () => {
    expect(matchLayerPreset(DEFAULT_SETTINGS.layers)).toBe('learn');
  });

  it('묶음마다 자기 자신과 맞고, 서로 다르다', () => {
    const keys = new Set<string>();
    for (const p of LAYER_PRESETS) {
      expect(matchLayerPreset(p.layers)).toBe(p.id);
      keys.add(JSON.stringify(p.layers));
    }
    expect(keys.size).toBe(LAYER_PRESETS.length);
  });

  it('하나라도 직접 바꾸면 어느 묶음도 아니다', () => {
    expect(matchLayerPreset({ ...DEFAULT_SETTINGS.layers, grid: false })).toBeNull();
    expect(matchLayerPreset({ ...presetLayers('clean'), footprints: 'next2' })).toBeNull();
  });

  it('presetLayers는 고쳐도 원본이 바뀌지 않는 사본을 준다', () => {
    const l = presetLayers('practice');
    l.grid = !l.grid;
    expect(matchLayerPreset(presetLayers('practice'))).toBe('practice');
  });

  it('어느 묶음이든 벽 라벨은 남긴다 (방향의 기준, 6.6)', () => {
    for (const p of LAYER_PRESETS) expect(p.layers.walls).toBe(true);
  });
});

describe('다음 자세 미리 보기 (6.6)', () => {
  const track = blockTrack(BLOCK_IDS[1], false);
  const rest = track.timing.rest;

  it('정지(준비 자세)에서는 첫 걸음의 착지 자세를 보여 준다', () => {
    expect(ghostBeat(track, -1, 'stopped', 'paused')).toBeCloseTo(rest[0], 9);
  });

  it('착지 자세에 멈추면 다음 걸음의 착지 자세 = ▷를 눌렀을 때 가는 곳', () => {
    for (let i = 0; i < track.steps.length - 1; i++) {
      const gb = ghostBeat(track, rest[i], 'paused', 'paused');
      expect(gb).toBeCloseTo(rest[i + 1], 9);
      const s = track.steps[i + 1];
      const p = poseAt(track, gb!);
      expect(dist(p.feet[s.foot].pos, s.to)).toBeLessThan(1e-6);
      expect(p.feet[s.foot].height).toBeLessThan(1e-6);
    }
  });

  it('걸음 사이(한 카운트씩 이동 중)에서도 가는 곳을 보여 준다', () => {
    const mid = (rest[2] + rest[3]) / 2;
    expect(ghostBeat(track, mid, 'stepping', 'paused')).toBeCloseTo(rest[3], 9);
  });

  it('「멈췄을 때」는 재생 중에 숨고, 「항상」은 재생 중에도, 「끔」은 언제나 숨는다', () => {
    expect(ghostBeat(track, rest[1], 'playing', 'paused')).toBeNull();
    expect(ghostBeat(track, rest[1], 'playing', 'always')).toBeCloseTo(rest[2], 9);
    expect(ghostBeat(track, rest[1], 'paused', 'off')).toBeNull();
    expect(ghostBeat(track, -1, 'stopped', 'off')).toBeNull();
  });

  it('마지막 걸음 뒤와 재생이 끝난 뒤에는 보여 주지 않는다', () => {
    expect(ghostBeat(track, rest[rest.length - 1], 'paused', 'always')).toBeNull();
    expect(ghostBeat(track, track.totalBeats, 'ended', 'always')).toBeNull();
  });

  it('루프 · 4벽 루틴에서도 지금 박보다 뒤의 착지 자세를 계속 찾는다', () => {
    const loops = [blockTrack(BLOCK_IDS[1], true), ...ROUTINE_IDS.map((id) => routineTrack(id, true))];
    for (const t of loops) {
      for (const b of [0.2, t.loopBeats * 1.5 + 0.3, t.loopBeats * 2.7]) {
        const gb = ghostBeat(t, b, 'paused', 'paused');
        expect(gb).not.toBeNull();
        expect(gb!).toBeGreaterThan(b);
        expect(gb! - b).toBeLessThanOrEqual(2 + 1e-9); // 다음 착지는 2박 안에 있다
      }
    }
  });
});

describe('카메라 구도 (8.10)', () => {
  const tan = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);

  it('큰 무대는 설계값 그대로: 뒤에서 · 거울 4.2 m, 높이 1.7 m, 바라보는 높이 0.8 m / 옆에서 높이 1.2 m', () => {
    for (const v of ['behind', 'mirror'] as const) expect(presetCamera(v, false, 720, 540)).toEqual({ dist: 4.2, height: 1.7, lookH: 0.8 });
    expect(presetCamera('side', false, 720, 540)).toEqual({ dist: 4.2, height: 1.2, lookH: 0.8 });
  });

  it('작은 무대(폰)는 3.4 m까지 당기고, 무대가 작을수록 가까워지기만 한다', () => {
    expect(presetCamera('behind', false, 360, 270).dist).toBeCloseTo(3.4, 9);
    let prev = 0;
    for (let h = 200; h <= 800; h += 20) {
      const d = presetCamera('behind', false, (h * 4) / 3, h).dist;
      expect(d).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(d).toBeGreaterThanOrEqual(3.4 - 1e-12);
      expect(d).toBeLessThanOrEqual(4.2 + 1e-12);
      prev = d;
    }
  });

  it('세로로 긴 무대는 발자국 폭 2.2 m가 가로로 다 들어오게 물러난다', () => {
    const w = 300;
    const h = 533;
    const c = presetCamera('behind', false, w, h);
    expect(2 * c.dist * tan * (w / h)).toBeGreaterThanOrEqual(2.2 - 1e-9);
  });

  it('발 확대는 더 가깝고 낮게, 발목 높이를 본다 / 위에서는 더 좁게 본다', () => {
    for (const v of ['behind', 'mirror', 'side'] as const) {
      const far = presetCamera(v, false, 720, 540);
      const near = presetCamera(v, true, 720, 540);
      expect(near.dist).toBeLessThan(far.dist * 0.6);
      expect(near.height).toBeLessThan(1);
      expect(near.lookH).toBeLessThan(0.3);
      expect(2 * near.dist * tan * (720 / 540)).toBeGreaterThanOrEqual(1.5 - 1e-9); // 발 둘레 1.5 m는 보인다
    }
    expect(topSpan(true)).toBeLessThan(topSpan(false));
  });
});

describe('설정 정리', () => {
  it('새 항목이 없는 예전 저장값은 기본값(발 확대 끔 · 멈췄을 때 미리 보기)으로 채운다', () => {
    const s = sanitize({ view: 'mirror' });
    expect(s.view).toBe('mirror');
    expect(s.closeUp).toBe(false);
    expect(s.ghost).toBe('paused');
  });

  it('잘못 저장된 값은 기본값으로 되돌린다', () => {
    const s = sanitize({ ghost: 'sometimes' as never, closeUp: 'yes' as never });
    expect(s.ghost).toBe('paused');
    expect(s.closeUp).toBe(false);
    expect(sanitize({ ghost: 'always', closeUp: true })).toMatchObject({ ghost: 'always', closeUp: true });
  });
});
