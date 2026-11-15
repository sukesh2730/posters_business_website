import assert from 'node:assert/strict';
import { POSTER_DESIGNS, POSTER_THEMES, getDesign, designsByTheme } from '../src/shared/posterDesigns';
import { MIX_TIERS, mixTierPricing, priceBuilder, WALL_LAYOUTS } from '../src/shared/printPricing';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
console.log('Tamil & Malayalam slang theme');

const slang = designsByTheme('slang');

test('the theme exists with 16 designs: 9 Tamil and 7 Malayalam', () => {
  assert.ok(POSTER_THEMES.some((t) => t.id === 'slang' && /Tamil/.test(t.label)));
  assert.equal(slang.length, 16);
  assert.equal(slang.filter((d) => d.lang === 'ta').length, 9);
  assert.equal(slang.filter((d) => d.lang === 'ml').length, 7);
});

test('every design has a word, an English meaning, a language, a look and a readable colour pair', () => {
  const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const problems: string[] = [];
  for (const d of slang) {
    if (!(d.title.trim() && d.subtitle?.trim() && (d.lang === 'ta' || d.lang === 'ml') && d.look)) problems.push(`${d.id}: missing fields`);
    if (!/^[A-Za-z ]+$/.test(d.title)) problems.push(`${d.id}: must use plain English letters`);
    // text colour against the colour behind the text: stripes put the word on a band of the accent colour
    const behind = d.look === 'stripes' ? d.palette[2] : d.palette[0];
    const [hi, lo] = [lum(behind), lum(d.palette[3])].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio < 3.5) problems.push(`${d.id} "${d.title}": contrast ${ratio.toFixed(1)} (needs 3.5)`);
  }
  assert.deepEqual(problems, []);
});

test('no design uses a film title, famous catchphrase or a person\'s name', () => {
  const banned = /whistle|thalapathi|vijay|thala\b|rajini|master|leo\b|jailer|vikram|kgf|baahubali|mersal|bigil|fahadh|mammootty|mohanlal/i;
  for (const d of slang) assert.ok(!banned.test(`${d.title} ${d.subtitle}`), `${d.id}: ${d.title}`);
});

test('words are short enough to fit a poster in capitals', () => {
  for (const d of slang) for (const line of d.title.split(' ')) assert.ok(line.length <= 8, `${d.id} line "${line}" is too long`);
});

test('the server accepts slang designs in a mix pack and in a wall, at the normal prices', () => {
  const tier = MIX_TIERS[1];
  const n = mixTierPricing(tier).count;
  const ids = Array.from({ length: n }, (_, i) => slang[i % slang.length].id);
  assert.equal(priceBuilder({ kind: 'mix', tierId: tier.id, designIds: ids }).unitPrice, 595);
  const layout = WALL_LAYOUTS[0];
  const slots = Array.from({ length: layout.posterCount }, (_, i) => ({ type: 'design' as const, designId: slang[i % slang.length].id }));
  assert.equal(priceBuilder({ kind: 'wall', layoutId: layout.id, slots }).unitPrice, layout.price);
  assert.ok(getDesign('slang-1') && getDesign('slang-16') && !getDesign('slang-17'));
});

test('classic themes are unchanged (ids stay stable so old orders still print)', () => {
  for (const id of ['cars-1', 'heroes-8', 'divine-2', 'kollywood-8']) assert.ok(getDesign(id), id);
  assert.equal(POSTER_DESIGNS.length, 72 + 16);
});

console.log(`\n${passed} passed`);
