// The wall studio (WallLayoutManager) and the server (shared/printPricing) each list the wall layouts.
// If they disagree a customer can build a wall the server then rejects at checkout. This keeps them identical.
import assert from 'node:assert/strict';
import { getWallLayouts } from '../src/utils/WallLayoutManager';
import { WALL_LAYOUTS, computeWallGeometry, priceBuilder } from '../src/shared/printPricing';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
console.log('Wall studio vs server layouts');

const studio = getWallLayouts() as any[];

test('the studio and the server offer exactly the same layout ids', () => {
  assert.deepEqual(studio.map((l) => l.id).sort(), WALL_LAYOUTS.map((l) => l.id).sort());
});
test('price, list price and poster count agree for every layout', () => {
  for (const l of studio) {
    const m = WALL_LAYOUTS.find((x) => x.id === l.id)!;
    assert.deepEqual([l.price, l.mrp, l.slots.length], [m.price, m.mrp, m.posterCount], l.id);
  }
});
test('slot sizes and order agree (so print files match what the customer saw)', () => {
  for (const l of studio) {
    const m = WALL_LAYOUTS.find((x) => x.id === l.id)!;
    assert.deepEqual(l.slots.map((s: any) => s.code ?? s.slotCode ?? s.size), computeWallGeometry(m).slots.map((s) => s.code), l.id);
  }
});
test('a fully filled wall of every studio layout is accepted by the server', () => {
  for (const l of studio) {
    const cfg = { kind: 'wall' as const, layoutId: l.id, slots: l.slots.map(() => ({ type: 'design' as const, designId: 'cars-1' })) };
    assert.equal(priceBuilder(cfg).unitPrice, l.price, l.id);
  }
});
console.log(`\n${passed} passed`);
