// 설계문서 8.3의 검증 6항
import { describe, expect, it } from 'vitest';
import { beatAt, closeCount, countAt, leadBeats, retimeT0, secPerBeat, timeAt, wallAt, resumeT0 } from '@/engine/timeline';
import { poseAt } from '@/engine/pose';
import { routineTrack } from './helpers';

describe('타임라인 — 박과 시간 (8.3)', () => {
  it('1. BPM 120이면 한 박 0.5초, 8카운트 블록 = 4.0초', () => {
    expect(secPerBeat(120)).toBe(0.5);
    expect(8 * secPerBeat(120)).toBe(4);
  });

  it('2. BPM 80 · 카운트인 4박이면 첫 착지(beat 0)는 시작 3.0초 뒤', () => {
    const t0 = 10;
    expect(timeAt(0, t0, 80, leadBeats(4)) - t0).toBeCloseTo(3.0, 12);
  });

  it('3. 재생 중 BPM을 80 → 100으로 바꾼 직전 · 직후의 박 차이 < 1e-6', () => {
    const t0 = 2;
    const lead = leadBeats(4);
    const now = 17.3;
    const before = beatAt(now, t0, 80, lead);
    const t0b = retimeT0(now, before, 100, lead);
    const after = beatAt(now, t0b, 100, lead);
    expect(Math.abs(after - before)).toBeLessThan(1e-6);
  });

  it("4. 박 0.5 → '1&', 4.5 → '5&', 7 → '8', 8 → '1'", () => {
    expect(countAt(0.5).label).toBe('1&');
    expect(countAt(4.5).label).toBe('5&');
    expect(countAt(7).label).toBe('8');
    expect(countAt(8).label).toBe('1');
    expect(countAt(-4).label).toBe('5'); // 카운트인 '5 · 6 · 7 · 8'
    expect(countAt(-1).label).toBe('8');
  });

  it('5. R-D32에서 박 0~31은 벽 1, 32~63은 벽 2, 96~127은 벽 4, 128은 다시 벽 1', () => {
    expect(wallAt(0, 32, 4)).toBe(1);
    expect(wallAt(31.9, 32, 4)).toBe(1);
    expect(wallAt(32, 32, 4)).toBe(2);
    expect(wallAt(63.9, 32, 4)).toBe(2);
    expect(wallAt(96, 32, 4)).toBe(4);
    expect(wallAt(127.9, 32, 4)).toBe(4);
    expect(wallAt(128, 32, 4)).toBe(1);
    const t = routineTrack('R-D32', true);
    expect(poseAt(t, 10).wall).toBe(1);
    expect(poseAt(t, 40).wall).toBe(2);
    expect(poseAt(t, 100).wall).toBe(4);
    expect(poseAt(t, 130).wall).toBe(1);
  });

  it("6. 카운트인 '없음' · BPM 80이면 첫 착지는 시작 0.75초 뒤 (준비 1박)", () => {
    expect(timeAt(0, 0, 80, leadBeats(0))).toBeCloseTo(0.75, 12);
  });

  it('닫히는 재생 횟수 closeN: 0° → 1, ±90° → 4, 180° → 2', () => {
    expect(closeCount(0)).toBe(1);
    expect(closeCount(90)).toBe(4);
    expect(closeCount(-90)).toBe(4);
    expect(closeCount(270)).toBe(4);
    expect(closeCount(180)).toBe(2);
    expect(closeCount(360)).toBe(1);
  });

  it('일시정지 → 재개는 같은 박에서 이어 간다', () => {
    const lead = 4;
    const paused = 13.25;
    const now = 100;
    const t0 = resumeT0(now, paused, 96, lead, 0.1);
    expect(beatAt(now + 0.1, t0, 96, lead)).toBeCloseTo(paused, 12);
  });
});
