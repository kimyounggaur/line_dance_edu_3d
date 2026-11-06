// 타임라인 — 박과 시간 (설계문서 8.3). 화면과 소리는 이 식으로만 박을 계산한다.

export function secPerBeat(bpm: number): number {
  return 60 / bpm;
}

/** 카운트인이 '없음'이어도 소리 없는 준비 1박을 둔다 (첫 걸음의 발이 뜰 시간) */
export function leadBeats(countInBeats: number): number {
  return Math.max(countInBeats, 1);
}

/** 오디오 시각 → 박. t0 = 준비 구간이 시작된 시각 */
export function beatAt(time: number, t0: number, bpm: number, lead: number): number {
  return (time - t0) / secPerBeat(bpm) - lead;
}

/** 박 → 오디오 시각 */
export function timeAt(beat: number, t0: number, bpm: number, lead: number): number {
  return t0 + (beat + lead) * secPerBeat(bpm);
}

/** BPM을 바꿔도 지금의 박 위치를 유지하는 새 t0 */
export function retimeT0(now: number, beatNow: number, newBpm: number, lead: number): number {
  return now - (beatNow + lead) * secPerBeat(newBpm);
}

/** 일시정지한 박에서 이어 가는 t0 (delay 초 뒤에 그 박이 된다) */
export function resumeT0(now: number, pausedBeat: number, bpm: number, lead: number, delay = 0.1): number {
  return now + delay - (pausedBeat + lead) * secPerBeat(bpm);
}

/** 처음 상태로 닫히는 데 필요한 재생 횟수: 한 번에 도는 각이 0°면 1, ±90°면 4, 180°면 2 */
export function closeCount(turnPerUnit: number): number {
  const t = ((Math.round(turnPerUnit) % 360) + 360) % 360;
  if (t === 0) return 1;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return Math.min(360 / gcd(t, 360), 360);
}

export interface CountInfo {
  count: number; // 1 ~ 8
  half: boolean; // '&' 자리인가
  label: string;
}

/** 박 → 카운트. 박 0.5 → '1&', 4.5 → '5&', 7 → '8', 8 → '1'. 카운트인(음수 박)도 같은 식 (−4 → 5) */
export function countAt(beat: number): CountInfo {
  const whole = Math.floor(beat + 1e-9);
  const frac = beat - whole;
  const count = (((whole % 8) + 8) % 8) + 1;
  const half = frac >= 0.5 - 1e-9;
  return { count, half, label: half ? `${count}&` : String(count) };
}

/** 벽 번호 (1부터) */
export function wallAt(beat: number, routineLength: number, walls: number): number {
  if (beat < 0 || walls <= 1) return 1;
  return (Math.floor(beat / routineLength) % walls) + 1;
}

/** 정렬된 배열에서 arr[i] > x인 첫 번째 i. 없으면 arr.length */
export function upperBound(arr: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] > x) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
