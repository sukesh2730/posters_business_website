import assert from 'node:assert/strict';
import {
  WALL_LAYOUTS,
  MIX_TIERS,
  computeWallGeometry,
  mixTierPricing,
  priceBuilder,
  sanitizeBuilder,
  splitPrice,
  SPLIT_TEMPLATES,
  SPLIT_PIECES,
  BuilderConfig,
} from '../src/shared/printPricing';
import { POSTER_DESIGNS, POSTER_THEMES } from '../src/shared/posterDesigns';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e: any) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
};
const design = POSTER_DESIGNS[0].id;

console.log('Print builders');

test('every wall layout has exactly posterCount slots', () => {
  for (const l of WALL_LAYOUTS) assert.equal(computeWallGeometry(l).slots.length, l.posterCount, l.id);
});

test('wall slots stay inside the wall and never overlap', () => {
  for (const l of WALL_LAYOUTS) {
    const g = computeWallGeometry(l);
    for (const a of g.slots) {
      assert.ok(a.x >= -0.01 && a.y >= -0.01 && a.x + a.w <= g.width + 0.01 && a.y + a.h <= g.height + 0.01, `${l.id} #${a.index} outside`);
      for (const b of g.slots) {
        if (a.index >= b.index) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `${l.id}: ${a.index} overlaps ${b.index}`);
      }
    }
  }
});

test('mix tiers: buy N get M free pricing', () => {
  const expected: Record<string, [number, number, number]> = { s7: [476, 833, 7], s10: [595, 1190, 10], s18: [714, 2142, 18], s36: [1190, 4284, 36] };
  for (const t of MIX_TIERS) {
    const p = mixTierPricing(t);
    assert.deepEqual([p.price, p.mrp, p.count], expected[t.id]);
  }
});

test('split templates tile the artwork exactly', () => {
  for (const n of SPLIT_PIECES) {
    const t = SPLIT_TEMPLATES[n];
    assert.equal(t.panels.length, n);
    const area = t.panels.reduce((a, p) => a + p.w * p.h, 0);
    assert.ok(Math.abs(area - 1) < 1e-9, `${n}-piece area ${area}`);
  }
});

test('wall price comes from the layout, not the client', () => {
  const l = WALL_LAYOUTS[0];
  const cfg: any = { kind: 'wall', layoutId: l.id, slots: Array(l.posterCount).fill({ type: 'design', designId: design }), price: 1, unitPrice: 1 };
  assert.equal(priceBuilder(cfg).unitPrice, l.price);
});

test('wall rejects wrong slot count, empty slots, unknown designs', () => {
  const l = WALL_LAYOUTS[0];
  const full = Array(l.posterCount).fill({ type: 'design', designId: design });
  assert.throws(() => priceBuilder({ kind: 'wall', layoutId: l.id, slots: full.slice(1) }));
  assert.throws(() => priceBuilder({ kind: 'wall', layoutId: l.id, slots: [null, ...full.slice(1)] }));
  assert.throws(() => priceBuilder({ kind: 'wall', layoutId: l.id, slots: [{ type: 'design', designId: 'nope' }, ...full.slice(1)] }));
  assert.throws(() => priceBuilder({ kind: 'wall', layoutId: 'nope', slots: full }));
});

test('photo URLs: blob, data, javascript and protocol-relative are rejected', () => {
  const l = WALL_LAYOUTS[0];
  const base = Array(l.posterCount).fill({ type: 'design', designId: design });
  for (const url of ['blob:http://x/1', 'data:image/png;base64,AAAA', 'javascript:alert(1)', '//evil.com/a.png', 'http://insecure.com/a.png']) {
    assert.throws(() => priceBuilder({ kind: 'wall', layoutId: l.id, slots: [{ type: 'photo', url }, ...base.slice(1)] }), url);
  }
  assert.ok(priceBuilder({ kind: 'wall', layoutId: l.id, slots: [{ type: 'photo', url: '/api/images/abc?token=1' }, ...base.slice(1)] }).photoUrls.length === 1);
});

test('split price: own photo costs more, larger panels cost more', () => {
  assert.ok(splitPrice(4, 'A4', true).price > splitPrice(4, 'A4', false).price);
  assert.ok(splitPrice(4, 'A3', false).price > splitPrice(4, 'A4', false).price);
  assert.equal(splitPrice(4, 'A4', true).price, 449);
  assert.equal(splitPrice(8, 'A4', true).price, 529);
  assert.equal(splitPrice(3, 'A4', false).price, 349);
});

test('split rejects bad piece counts, sizes and sources', () => {
  assert.throws(() => priceBuilder({ kind: 'split', pieces: 6 as any, size: 'A4', source: { type: 'design', designId: design } }));
  assert.throws(() => priceBuilder({ kind: 'split', pieces: 4, size: 'A0' as any, source: { type: 'design', designId: design } }));
  assert.throws(() => priceBuilder({ kind: 'split', pieces: 4, size: 'A4', source: { type: 'photo', url: 'blob:x' } }));
});

test('mix needs exactly the pack size of known designs', () => {
  const t = MIX_TIERS[1];
  const n = mixTierPricing(t).count;
  assert.equal(priceBuilder({ kind: 'mix', tierId: t.id, designIds: Array(n).fill(design) }).unitPrice, 595);
  assert.throws(() => priceBuilder({ kind: 'mix', tierId: t.id, designIds: Array(n - 1).fill(design) }));
  assert.throws(() => priceBuilder({ kind: 'mix', tierId: t.id, designIds: Array(n).fill('nope') }));
});

test('sanitizeBuilder drops fields the client added', () => {
  const t = MIX_TIERS[0];
  const dirty: any = { kind: 'mix', tierId: t.id, designIds: Array(7).fill(design), isAdmin: true, price: 1 };
  const clean: any = sanitizeBuilder(dirty as BuilderConfig);
  assert.deepEqual(Object.keys(clean).sort(), ['designIds', 'kind', 'tierId']);
});

test('catalog covers all nine themes with 8 designs each', () => {
  assert.equal(POSTER_THEMES.length, 9);
  for (const t of POSTER_THEMES) assert.equal(POSTER_DESIGNS.filter((d) => d.theme === t.id).length, 8, t.id);
  assert.equal(new Set(POSTER_DESIGNS.map((d) => d.id)).size, POSTER_DESIGNS.length);
});

console.log(`\n${passed} passed`);
