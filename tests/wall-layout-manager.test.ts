import assert from 'node:assert/strict';
import { 
  WallLayoutManager, 
  STANDARD_WALL_LAYOUTS, 
  calculateDynamicWallDimensions,
  getWallLayoutById
} from '../src/utils/WallLayoutManager';

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

console.log('WallLayoutManager Unit Tests');

test('standard wall layouts are registered and populated', () => {
  const layouts = WallLayoutManager.getAllLayouts();
  assert.ok(layouts.length >= 6, 'Contains standard configurations');
  assert.ok(layouts.some((l) => l.id === 'large'), 'Contains large layout');
  assert.ok(layouts.some((l) => l.id === 'duo'), 'Contains duo layout');
  assert.ok(layouts.some((l) => l.id === 'mosaic'), 'Contains mosaic layout');
  assert.ok(layouts.some((l) => l.id === 'hero'), 'Contains hero layout');
  assert.ok(layouts.some((l) => l.id === 'showcase'), 'Contains showcase layout');
  assert.ok(layouts.some((l) => l.id === 'grid-compact'), 'Contains compact 3x3 layout');
});

test('every layout contains exactly posterCount slots matching rows definition', () => {
  for (const l of STANDARD_WALL_LAYOUTS) {
    assert.equal(l.slots.length, l.posterCount, `Layout ${l.id} slot count matches posterCount`);
    const totalRowCodes = l.rows.reduce((sum, r) => sum + r.length, 0);
    assert.equal(l.slots.length, totalRowCodes, `Layout ${l.id} slots match total row items`);
  }
});

test('calculateDynamicWallDimensions returns accurate bounds within container width', () => {
  const large = getWallLayoutById('large');
  assert.ok(large, 'Found large layout');

  const containerWidth = 1000;
  const metrics = calculateDynamicWallDimensions(large, containerWidth);

  assert.equal(metrics.layoutId, 'large');
  assert.equal(metrics.containerWidth, containerWidth);
  assert.ok(metrics.scaleFactor > 0, 'scaleFactor is positive');
  assert.equal(metrics.slots.length, large.posterCount);

  for (const slotBounds of metrics.slots) {
    assert.ok(slotBounds.leftPercent >= 0 && slotBounds.leftPercent <= 100, `leftPercent inside bounds for ${slotBounds.slot.id}`);
    assert.ok(slotBounds.topPercent >= 0 && slotBounds.topPercent <= 100, `topPercent inside bounds for ${slotBounds.slot.id}`);
    assert.ok(slotBounds.widthPercent > 0 && slotBounds.widthPercent <= 100, `widthPercent valid for ${slotBounds.slot.id}`);
    assert.ok(slotBounds.heightPercent > 0 && slotBounds.heightPercent <= 100, `heightPercent valid for ${slotBounds.slot.id}`);
    assert.ok(slotBounds.leftPx >= 0 && slotBounds.leftPx <= containerWidth, `leftPx valid for ${slotBounds.slot.id}`);
    assert.ok(slotBounds.widthPx > 0, `widthPx positive for ${slotBounds.slot.id}`);
    assert.ok(slotBounds.heightPx > 0, `heightPx positive for ${slotBounds.slot.id}`);
  }
});

test('dynamic CSS positioning styles are valid percentages and pixels', () => {
  const layout = getWallLayoutById('hero');
  const metrics = calculateDynamicWallDimensions(layout, 1200);
  const firstSlot = metrics.slots[0];

  const percentStyle = WallLayoutManager.getSlotCss(firstSlot, false);
  assert.equal(percentStyle.position, 'absolute');
  assert.ok(String(percentStyle.left).endsWith('%'));
  assert.ok(String(percentStyle.top).endsWith('%'));
  assert.ok(String(percentStyle.width).endsWith('%'));
  assert.ok(String(percentStyle.height).endsWith('%'));

  const pixelStyle = WallLayoutManager.getSlotCss(firstSlot, true);
  assert.equal(pixelStyle.position, 'absolute');
  assert.ok(String(pixelStyle.left).endsWith('px'));
  assert.ok(String(pixelStyle.top).endsWith('px'));
});

console.log(`\n${passed} passed`);
