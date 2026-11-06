// npm run demo:footmap — 블록 8종의 발 위치도를 SVG로 저장한다 (설계문서 10장 Phase 1).
// 확인할 것: ① 그레이프바인의 2번 발이 뒤쪽 줄 ② V스텝이 V자 ③ 재즈박스가 작은 상자 ④ 코스터에 '1&'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCK_LIST, FIGURES } from '../src/content';
import { compose, readyState } from '../src/engine/compose';
import { DEFAULT_PARAMS } from '../src/engine/constants';
import { blockSvg } from '../src/render2d/mapGeometry';

const out = join(process.cwd(), 'docs', 'footmaps');
mkdirSync(out, { recursive: true });

for (const b of BLOCK_LIST) {
  const res = compose(
    b.figures.map((figureId) => ({ figureId, blockIndex: 0, blockId: b.id, unitIndex: 0, wall: 1 })),
    readyState('R'),
    { figures: FIGURES },
  );
  const svg = blockSvg(res.steps, res.blocks[0], DEFAULT_PARAMS.unitM, `${b.id} ${b.nameKo}`);
  const file = join(out, `${b.id}.svg`);
  writeFileSync(file, svg, 'utf8');
  console.log(`${b.id.padEnd(16)} ${res.steps.length}걸음 → ${file}`);
}
