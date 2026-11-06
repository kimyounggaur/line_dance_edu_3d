// 숫자 표기 (React 없이 테스트할 수 있게 따로 둔다)
/** 소수 둘째 자리. 부동소수 잡음을 지우고, 이진수로 정확히 반인 값(1/8의 배수)만 짝수 쪽으로 — 설계문서 표(파이썬 형식)와 같은 규칙 */
export function round2(v: number): string {
  const d = Number(v.toFixed(9));
  const scaled = d * 100;
  const fl = Math.floor(scaled);
  if (Math.abs(scaled - fl - 0.5) < 1e-9 && Number.isInteger(d * 8)) return ((fl % 2 === 0 ? fl : fl + 1) / 100).toFixed(2);
  return d.toFixed(2);
}

/** +0.80 / −0.14 형식 (0은 +0.00) */
export function signed2(v: number): string {
  const r = round2(v);
  const neg = r.startsWith('-') && Number(r) !== 0;
  return `${neg ? '−' : '+'}${r.replace('-', '')}`;
}
