import assert from 'node:assert/strict';
import { computeSplitPixels } from '../src/utils/printExport';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
console.log('Print export sizing');

test('A4 grids: every panel is exactly A4 at 300 dpi (2480 x 3508)', () => {
  for (const n of [3, 4, 8] as const) {
    const g = computeSplitPixels(n, 'A4');
    g.panels.forEach((p) => assert.deepEqual([p.w, p.h], [2480, 3508]));
  }
});
test('5-piece: tall centre is full size, the four sides are one size smaller', () => {
  const g = computeSplitPixels(5, 'A4');
  assert.deepEqual(g.panels.map((p) => [p.w, p.h]), [[1240, 1754], [1240, 1754], [2480, 3508], [1240, 1754], [1240, 1754]]);
});
test('every panel of every set is true 300 dpi and small enough for one canvas', () => {
  for (const n of [3, 4, 5, 8] as const) for (const size of ['A4', 'A3', '13x19'] as const) {
    const g = computeSplitPixels(n, size);
    assert.equal(g.dpi, 300);
    g.panels.forEach((p) => assert.ok(p.w * p.h <= 25e6, `${n}/${size} panel ${p.w}x${p.h} is too large`));
  }
});
test('13 x 19 in panels are 3900 x 5700 px', () => {
  assert.deepEqual([computeSplitPixels(4, '13x19').panels[0].w, computeSplitPixels(4, '13x19').panels[0].h], [3900, 5700]);
});
test('panels tile the whole artwork (areas add up to the whole)', () => {
  for (const n of [3, 4, 5, 8] as const) {
    const g = computeSplitPixels(n, 'A3');
    const area = g.panels.reduce((a, p) => a + p.w * p.h, 0);
    assert.ok(Math.abs(area / (g.overallW * g.overallH) - 1) < 0.002, String(n));
  }
});
console.log(`\n${passed} passed`);
