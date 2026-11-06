// npm run check:content — 콘텐츠 전체를 8.2 검증기로 돌려 표로 보여 준다. 하나라도 실패하면 종료 코드 1.
// 결과는 설계문서 8.2 표의 "초기값의 결과" 열 · 부록 A.4 표와 같아야 한다.
import { BLOCKS, FIGURES, ROUTINES } from '../src/content';
import { validateContent } from '../src/engine/validate';
import { DEFAULT_PARAMS } from '../src/engine/constants';

const unitM = Number(process.argv[2] ?? DEFAULT_PARAMS.unitM);
const rep = validateContent({ figures: FIGURES, blocks: BLOCKS, routines: ROUTINES }, { params: { ...DEFAULT_PARAMS, unitM }, pairs: true });
let failed = 0;
const pad = (s: string | number, n: number) => String(s).padEnd(n);

console.log(`보폭 단위 ${unitM} m\n`);
console.log('동작');
for (const [id, r] of Object.entries(rep.figures)) {
  if (!r.ok) failed++;
  console.log(`  ${pad(id, 18)} ${r.ok ? '통과' : '실패'}  끝 체중 ${r.metrics.endWeight}  이동 (${r.metrics.shift.map((v) => v.toFixed(2)).join(', ')})  방향 ${r.metrics.turn}°`);
  for (const i of r.issues) console.log(`      ${i.code} ${i.message}`);
}
console.log('\n블록');
console.log(`  ${pad('id', 16)} 결과  걸음 끝체중 이동(u)          방향  반복같음 최대간격 골반한계(최소)  경로 휨`);
for (const [id, r] of Object.entries(rep.blocks)) {
  if (!r.ok) failed++;
  const m = r.metrics;
  console.log(
    `  ${pad(id, 16)} ${r.ok ? '통과' : '실패'}  ${pad(m.steps, 4)} ${pad(m.endWeight, 6)} (${m.shift.map((v) => v.toFixed(2)).join(', ')})`.padEnd(54) +
      `${pad(((m.turn % 360) + 360) % 360 + '°', 5)} ${pad(m.repeatSame ? '예' : '아니오', 7)} ${pad(m.maxStance.toFixed(2) + 'u', 8)} ${pad(m.minPelvisLimit.toFixed(3) + ' m', 14)} ${m.bendCounts.join(', ') || '없음'}`,
  );
  for (const i of r.issues) console.log(`      ${i.code} ${i.message}`);
}
console.log('\n루틴');
for (const [id, r] of Object.entries(rep.routines)) {
  if (!r.ok) failed++;
  const wallNames = r.metrics.wallHeadings.map((h) => ({ 0: '12시', 90: '3시', 180: '6시', 270: '9시' })[h as 0] ?? `${h}°`).join(' → ');
  console.log(`  ${pad(id, 8)} ${r.ok ? '통과' : '실패'}  벽 ${r.metrics.closeN}  ${wallNames}  한 벽당 이동 (${r.metrics.shift.map((v) => v.toFixed(2)).join(', ')})`);
  for (const i of r.issues) console.log(`      ${i.code} ${i.message}`);
}
console.log(`\n블록 순서쌍 64가지: ${rep.pairFailures.length ? `${rep.pairFailures.length}쌍 실패` : '모두 통과'}`);
for (const p of rep.pairFailures) console.log(`  ${p.a} → ${p.b}: ${p.issues.map((i) => i.code).join(', ')}`);
failed += rep.pairFailures.length;
const minAll = Math.min(...Object.values(rep.blocks).map((b) => b.metrics.minPelvisLimit));
const maxMove = Math.max(...Object.values(rep.blocks).map((b) => b.metrics.maxMove));
console.log(`V5 최솟값 ${minAll.toFixed(3)} m, V6 최대 이동 ${maxMove.toFixed(2)}u`);
if (failed) {
  console.error(`\n실패 ${failed}건`);
  process.exit(1);
}
console.log('\n전부 통과');
