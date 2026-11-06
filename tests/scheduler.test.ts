// 설계문서 8.8 · 11.1 — 가짜 오디오 시계로 5분
import { describe, expect, it } from 'vitest';
import { createScheduler, makeClickPlan, type ClickKind } from '@/engine/scheduler';
import { beatAt, leadBeats, retimeT0 } from '@/engine/timeline';
import { blockTrack } from './helpers';

function fake() {
  let t = 0;
  const played: { time: number; kind: ClickKind }[] = [];
  return {
    clock: { now: () => t },
    sink: {
      play: (time: number, kind: ClickKind) => played.push({ time, kind }),
      cancelAfter: (time: number) => {
        for (let i = played.length - 1; i >= 0; i--) if (played[i].time > time) played.splice(i, 1);
      },
    },
    advance: (dt: number) => {
      t += dt;
    },
    played,
  };
}

describe('오디오 스케줄러 (8.8)', () => {
  it('5분 재생: 클릭 누락 · 중복 0, 1 · 5카운트는 강하게, & 는 코스터 자리에만', () => {
    const f = fake();
    const track = blockTrack('B5-coaster', true);
    const bpm = 120;
    const lead = leadBeats(4);
    const sch = createScheduler(f.clock, f.sink);
    const t0 = 0.1;
    sch.start(t0, bpm, lead, makeClickPlan(track, { countInBeats: 4, clickMode: 'on' }), -lead);
    for (let i = 0; i < (5 * 60) / 0.025; i++) {
      f.advance(0.025 + (i % 7 === 0 ? 0.013 : 0)); // 타이머가 조금씩 늦게 와도
      sch.tick();
    }
    const now = f.clock.now();
    const beats = f.played.map((p) => Math.round(beatAt(p.time, t0, bpm, lead) * 2) / 2);
    // 중복 없음
    expect(new Set(beats).size).toBe(beats.length);
    // 정수 박은 −4(카운트인 5)부터 지금까지 빠짐없이
    const lastBeat = Math.floor(beatAt(now, t0, bpm, lead));
    const whole = beats.filter((b) => Number.isInteger(b));
    expect(whole[0]).toBe(-4);
    for (let b = -4; b <= lastBeat - 1; b++) expect(whole).toContain(b);
    // & 는 코스터의 '&'(블록 안 0.5, 4.5박)에만
    const halves = beats.filter((b) => !Number.isInteger(b));
    expect(halves.length).toBeGreaterThan(0);
    for (const h of halves) expect([0.5, 4.5]).toContain(((h % 8) + 8) % 8);
    // 강 클릭은 1 · 5카운트
    f.played.forEach((p, i) => {
      if (p.kind !== 'strong') return;
      const c = ((beats[i] % 8) + 8) % 8;
      expect([0, 4]).toContain(c);
    });
  });

  it('BPM을 바꿔도 박 위치가 유지되고 클릭이 빠지거나 겹치지 않는다', () => {
    const f = fake();
    const track = blockTrack('B1-stepTouch', true);
    const lead = leadBeats(4);
    const sch = createScheduler(f.clock, f.sink);
    const t0a = 0.1;
    sch.start(t0a, 80, lead, makeClickPlan(track, { countInBeats: 4, clickMode: 'on' }), -lead);
    for (let i = 0; i < 400; i++) {
      f.advance(0.025);
      sch.tick();
    }
    const now = f.clock.now();
    const before = beatAt(now, t0a, 80, lead);
    const t0b = retimeT0(now, before, 100, lead);
    expect(Math.abs(beatAt(now, t0b, 100, lead) - before)).toBeLessThan(1e-6);
    sch.retime(t0b, 100);
    for (let i = 0; i < 2000; i++) {
      f.advance(0.025);
      sch.tick();
    }
    // 바꾸기 전에 들린 소리는 옛 템포로, 뒤는 새 템포로 박을 센다
    const beats = f.played.map((p) => Math.round((p.time <= now ? beatAt(p.time, t0a, 80, lead) : beatAt(p.time, t0b, 100, lead)) * 2) / 2);
    expect(new Set(beats).size).toBe(beats.length);
    const last = Math.floor(beatAt(f.clock.now(), t0b, 100, lead)) - 1;
    for (let b = -4; b <= last; b++) expect(beats, `beat ${b}`).toContain(b);
    // 박 간격: 바꾼 뒤에는 0.6초
    const afterTimes = f.played.filter((p) => p.time > now + 1).map((p) => p.time);
    for (let i = 1; i < afterTimes.length; i++) expect(afterTimes[i] - afterTimes[i - 1]).toBeCloseTo(0.6, 9);
  });

  it("클릭 '&만 끔'이면 반 박 클릭이 없다", () => {
    const track = blockTrack('B5-coaster', true);
    const plan = makeClickPlan(track, { countInBeats: 4, clickMode: 'noAnd' });
    expect(plan.clickAt(1)).toBeNull();
    expect(plan.clickAt(0)).toBe('strong');
    expect(plan.clickAt(2)).toBe('weak');
    const on = makeClickPlan(track, { countInBeats: 4, clickMode: 'on' });
    expect(on.clickAt(1)).toBe('and');
    expect(on.clickAt(3)).toBeNull();
    // 카운트인 '없음'의 소리 없는 준비 1박
    const silent = makeClickPlan(track, { countInBeats: 0, clickMode: 'on' });
    expect(silent.clickAt(-2)).toBeNull();
  });
});
