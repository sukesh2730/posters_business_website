// Single source of truth for wall layouts, split-poster templates, mix & match tiers
// and price calculation. Imported by BOTH the React app (cart prices, previews) and
// server.ts (authoritative totals), so a browser can never dictate a builder price.
//
// Prices marked PLACEHOLDER are not taken from any real price list: tune them against
// your own print and shipping costs before launch.

import { getDesign } from './posterDesigns';

// ---------------------------------------------------------------- shared types

export type PosterSize = 'A5' | 'A4' | 'A3';

/** Slot codes: portrait A-series, or a trailing "L" for landscape (e.g. A3L). */
export type SlotCode = 'A5' | 'A4' | 'A3' | 'A4L' | 'A3L';

export type SlotFill =
  | { type: 'design'; designId: string }
  | { type: 'photo'; url: string };

export interface WallConfig {
  kind: 'wall';
  layoutId: string;
  slots: Array<SlotFill | null>;
}

export type SplitSize = 'A4' | 'A3' | '13x19';
export type SplitPieces = 3 | 4 | 5 | 8;

export interface SplitConfig {
  kind: 'split';
  pieces: SplitPieces;
  size: SplitSize;
  source:
    | { type: 'design'; designId: string }
    | { type: 'photo'; url: string; focusX?: number; focusY?: number };
}

export interface MixConfig {
  kind: 'mix';
  tierId: string;
  designIds: string[];
}

export type BuilderConfig = WallConfig | SplitConfig | MixConfig;

export interface BuilderPrice {
  productId: string;
  name: string;
  unitPrice: number;
  mrp: number;
  posterCount: number;
  summary: string;
  photoUrls: string[];
}

// ---------------------------------------------------------------- wall layouts

const GAP_CM = 3;

const SLOT_CM: Record<SlotCode, [number, number]> = {
  A5: [14.8, 21],
  A4: [21, 29.7],
  A3: [29.7, 42],
  A4L: [29.7, 21],
  A3L: [42, 29.7],
};

export interface WallLayout {
  id: string;
  name: string;
  blurb: string;
  posterCount: number;
  wallSize: string; // display only, e.g. "4.5 × 2.9 ft"
  price: number;
  mrp: number;
  rows: SlotCode[][];
}

export const WALL_LAYOUTS: WallLayout[] = [
  {
    id: 'large',
    name: 'Large Wall',
    blurb: 'A wide, even spread. A good first wall.',
    posterCount: 17,
    wallSize: '4.5 × 2.9 ft',
    price: 699,
    mrp: 1199,
    rows: [
      ['A4', 'A4', 'A3', 'A4', 'A4', 'A5'],
      ['A5', 'A4', 'A3', 'A3', 'A4', 'A5'],
      ['A4', 'A5', 'A4', 'A5', 'A4'],
    ],
  },
  {
    id: 'duo',
    name: 'Duo Wall',
    blurb: 'Two clusters stacked, tall and balanced.',
    posterCount: 18,
    wallSize: '4.3 × 4 ft',
    price: 799,
    mrp: 1399,
    rows: [
      ['A3', 'A4', 'A4', 'A3'],
      ['A5', 'A4', 'A5', 'A4', 'A5'],
      ['A4', 'A3', 'A3', 'A4'],
      ['A5', 'A5', 'A4', 'A5', 'A5'],
    ],
  },
  {
    id: 'mosaic',
    name: 'Mosaic Wall',
    blurb: 'Wide and busy, built for a long wall above a bed or desk.',
    posterCount: 19,
    wallSize: '6.1 × 4.3 ft',
    price: 849,
    mrp: 1799,
    rows: [
      ['A5', 'A4', 'A3', 'A4', 'A5', 'A4', 'A3', 'A5'],
      ['A4', 'A3', 'A5', 'A4', 'A5', 'A4', 'A3', 'A4'],
      ['A5', 'A4', 'A5'],
    ],
  },
  {
    id: 'hero',
    name: 'Hero Wall',
    blurb: 'One landscape poster in the middle gets the attention.',
    posterCount: 20,
    wallSize: '4.5 × 4.8 ft',
    price: 849,
    mrp: 1499,
    rows: [
      ['A5', 'A4', 'A5', 'A4', 'A5'],
      ['A4', 'A4', 'A3L', 'A4', 'A4'],
      ['A5', 'A4', 'A5', 'A4', 'A5'],
      ['A5', 'A4', 'A3', 'A4', 'A5'],
    ],
  },
  {
    id: 'showcase',
    name: 'Showcase Wall',
    blurb: 'Two long rows, like a gallery.',
    posterCount: 20,
    wallSize: '5.5 × 3 ft',
    price: 899,
    mrp: 1599,
    rows: [
      ['A4', 'A5', 'A4', 'A3', 'A4', 'A5', 'A4', 'A3', 'A4', 'A5'],
      ['A5', 'A4', 'A5', 'A4', 'A3', 'A4', 'A5', 'A4', 'A5', 'A3'],
    ],
  },
  {
    id: 'trio',
    name: 'Trio XL Wall',
    blurb: 'Forty posters. Fills a whole wall. Best value.',
    posterCount: 40,
    wallSize: '7.6 × 4.8 ft',
    price: 1299,
    mrp: 2299,
    rows: [
      ['A4', 'A5', 'A3', 'A4', 'A5', 'A4', 'A3', 'A5', 'A4', 'A5'],
      ['A5', 'A4', 'A5', 'A3', 'A4', 'A5', 'A4', 'A3', 'A4', 'A5'],
      ['A4', 'A3', 'A5', 'A4', 'A5', 'A3', 'A4', 'A5', 'A4', 'A3'],
      ['A5', 'A4', 'A4', 'A5', 'A3', 'A4', 'A5', 'A4', 'A5', 'A4'],
    ],
  },
];

export function getWallLayout(id: string): WallLayout | undefined {
  return WALL_LAYOUTS.find((l) => l.id === id);
}

export interface WallSlot {
  index: number;
  code: SlotCode;
  size: PosterSize;
  landscape: boolean;
  /** position and size in cm, origin top-left of the whole wall */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WallGeometry {
  slots: WallSlot[];
  width: number;
  height: number;
}

/** Flow each row left to right, centre it, stack rows with a fixed gap. */
export function computeWallGeometry(layout: WallLayout): WallGeometry {
  const rowDims = layout.rows.map((row) => {
    const widths = row.map((c) => SLOT_CM[c][0]);
    const heights = row.map((c) => SLOT_CM[c][1]);
    return {
      width: widths.reduce((a, b) => a + b, 0) + GAP_CM * (row.length - 1),
      height: Math.max(...heights),
    };
  });
  const totalW = Math.max(...rowDims.map((r) => r.width));
  const totalH = rowDims.reduce((a, r) => a + r.height, 0) + GAP_CM * (layout.rows.length - 1);

  const slots: WallSlot[] = [];
  let y = 0;
  let index = 0;
  layout.rows.forEach((row, ri) => {
    let x = (totalW - rowDims[ri].width) / 2;
    row.forEach((code) => {
      const [w, h] = SLOT_CM[code];
      slots.push({
        index: index++,
        code,
        size: code.replace('L', '') as PosterSize,
        landscape: code.endsWith('L'),
        x,
        y: y + (rowDims[ri].height - h) / 2,
        w,
        h,
      });
      x += w + GAP_CM;
    });
    y += rowDims[ri].height + GAP_CM;
  });
  return { slots, width: totalW, height: totalH };
}

// ---------------------------------------------------------------- split posters

export interface SplitTemplate {
  pieces: SplitPieces;
  label: string;
  /** width / height of the whole assembled artwork */
  aspect: number;
  /** panel rectangles as fractions (0..1) of the whole artwork */
  panels: Array<{ x: number; y: number; w: number; h: number }>;
}

const grid = (cols: number, rows: number) => {
  const panels: SplitTemplate['panels'] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      panels.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows });
    }
  }
  return panels;
};

export const SPLIT_TEMPLATES: Record<SplitPieces, SplitTemplate> = {
  3: { pieces: 3, label: '3 in a row', aspect: 3 / Math.SQRT2, panels: grid(3, 1) },
  4: { pieces: 4, label: '2 × 2 grid', aspect: 2 / (2 * Math.SQRT2), panels: grid(2, 2) },
  5: {
    pieces: 5,
    label: 'Tall centre, 4 sides',
    aspect: 2 / Math.SQRT2,
    panels: [
      { x: 0, y: 0, w: 0.25, h: 0.5 },
      { x: 0, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0, w: 0.5, h: 1 },
      { x: 0.75, y: 0, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ],
  },
  8: { pieces: 8, label: '4 × 2 grid', aspect: 4 / (2 * Math.SQRT2), panels: grid(4, 2) },
};

export const SPLIT_PIECES: SplitPieces[] = [3, 4, 5, 8];
export const SPLIT_SIZES: SplitSize[] = ['A4', 'A3', '13x19'];
export const SPLIT_SIZE_LABEL: Record<SplitSize, string> = {
  A4: 'A4 panels',
  A3: 'A3 panels',
  '13x19': '13 × 19 in panels',
};

interface SplitPriceRow {
  price: number; // ready-made set
  mrp: number;
  customPrice: number; // your own photo
}

const SPLIT_PRICES: Record<SplitPieces, SplitPriceRow> = {
  3: { price: 349, mrp: 399, customPrice: 429 /* PLACEHOLDER */ },
  4: { price: 395, mrp: 395, customPrice: 449 },
  5: { price: 399, mrp: 399, customPrice: 479 /* PLACEHOLDER */ },
  8: { price: 499, mrp: 499, customPrice: 529 },
};

/** PLACEHOLDER: extra rupees per set for larger panels. */
const SPLIT_SIZE_UPLIFT: Record<SplitSize, number> = { A4: 0, A3: 150, '13x19': 250 };

// ---------------------------------------------------------------- mix & match

/** A4 list price per poster. Packs charge for `buy` posters and add `free` more. */
export const MIX_UNIT_MRP = 119;

export interface MixTier {
  id: string;
  buy: number;
  free: number;
  badge?: string;
}

export const MIX_TIERS: MixTier[] = [
  { id: 's7', buy: 4, free: 3 },
  { id: 's10', buy: 5, free: 5, badge: 'Most popular' },
  { id: 's18', buy: 6, free: 12 },
  { id: 's36', buy: 10, free: 26, badge: 'Best value' },
];

export function getMixTier(id: string): MixTier | undefined {
  return MIX_TIERS.find((t) => t.id === id);
}

export function mixTierPricing(tier: MixTier) {
  const count = tier.buy + tier.free;
  const price = tier.buy * MIX_UNIT_MRP;
  return { count, price, mrp: count * MIX_UNIT_MRP, perPoster: Math.round(price / count) };
}

// ---------------------------------------------------------------- validation + price

const MAX_PHOTO_URL = 2000;

export function isSafePhotoUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_PHOTO_URL) return false;
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;
  return url.startsWith('/') && !url.startsWith('//') ? true : /^https:\/\//i.test(url);
}

function checkFill(fill: SlotFill | null | undefined, where: string): SlotFill {
  if (!fill) throw new Error(`${where} is empty.`);
  if (fill.type === 'design') {
    if (!getDesign(String(fill.designId))) throw new Error(`${where} uses an unknown design.`);
    return { type: 'design', designId: String(fill.designId) };
  }
  if (fill.type === 'photo') {
    if (!isSafePhotoUrl(fill.url)) throw new Error(`${where} has a photo that has not finished uploading.`);
    return { type: 'photo', url: fill.url };
  }
  throw new Error(`${where} has an invalid fill.`);
}

/**
 * Validates a builder configuration and returns its authoritative price.
 * Throws an Error with a customer-readable message when the config is invalid.
 */
export function priceBuilder(config: BuilderConfig): BuilderPrice {
  if (!config || typeof config !== 'object') throw new Error('Missing builder details.');

  if (config.kind === 'wall') {
    const layout = getWallLayout(String(config.layoutId));
    if (!layout) throw new Error('Unknown wall layout.');
    if (!Array.isArray(config.slots) || config.slots.length !== layout.posterCount) {
      throw new Error(`${layout.name} needs exactly ${layout.posterCount} posters.`);
    }
    const photoUrls: string[] = [];
    config.slots.forEach((s, i) => {
      const fill = checkFill(s, `Poster ${i + 1}`);
      if (fill.type === 'photo') photoUrls.push(fill.url);
    });
    return {
      productId: `build-wall-${layout.id}`,
      name: `Build your wall: ${layout.name}`,
      unitPrice: layout.price,
      mrp: layout.mrp,
      posterCount: layout.posterCount,
      summary: `${layout.posterCount} posters, ${layout.wallSize}`,
      photoUrls,
    };
  }

  if (config.kind === 'split') {
    const row = SPLIT_PRICES[config.pieces as SplitPieces];
    if (!row) throw new Error('Choose 3, 4, 5 or 8 pieces.');
    if (!(config.size in SPLIT_SIZE_UPLIFT)) throw new Error('Unknown split poster size.');
    const photoUrls: string[] = [];
    let base: number;
    if (config.source?.type === 'photo') {
      if (!isSafePhotoUrl(config.source.url)) throw new Error('Your photo has not finished uploading.');
      photoUrls.push(config.source.url);
      base = row.customPrice;
    } else if (config.source?.type === 'design') {
      if (!getDesign(String(config.source.designId))) throw new Error('Unknown design.');
      base = row.price;
    } else {
      throw new Error('Choose a design or upload a photo.');
    }
    const uplift = SPLIT_SIZE_UPLIFT[config.size];
    return {
      productId: `build-split-${config.pieces}`,
      name: `${config.pieces}-piece split poster${config.source.type === 'photo' ? ' (your photo)' : ''}`,
      unitPrice: base + uplift,
      mrp: Math.max(row.mrp, base) + uplift,
      posterCount: config.pieces,
      summary: `${config.pieces} panels, ${SPLIT_SIZE_LABEL[config.size]}`,
      photoUrls,
    };
  }

  if (config.kind === 'mix') {
    const tier = getMixTier(String(config.tierId));
    if (!tier) throw new Error('Unknown poster pack.');
    const { count, price, mrp } = mixTierPricing(tier);
    if (!Array.isArray(config.designIds) || config.designIds.length !== count) {
      throw new Error(`This pack needs exactly ${count} posters.`);
    }
    config.designIds.forEach((id, i) => {
      if (!getDesign(String(id))) throw new Error(`Poster ${i + 1} uses an unknown design.`);
    });
    return {
      productId: `build-mix-${tier.id}`,
      name: `${count} posters: buy ${tier.buy}, get ${tier.free} free`,
      unitPrice: price,
      mrp,
      posterCount: count,
      summary: `${count} A4 posters`,
      photoUrls: [],
    };
  }

  throw new Error('Unknown builder type.');
}

/** Same as priceBuilder but returns null instead of throwing. */
export function tryPriceBuilder(config: BuilderConfig): BuilderPrice | null {
  try {
    return priceBuilder(config);
  } catch {
    return null;
  }
}

/**
 * Rebuilds a validated config from known fields only, so nothing a client adds
 * on top (extra keys, oversized values) is ever stored on an order.
 * Call priceBuilder first; this assumes the config is valid.
 */
export function sanitizeBuilder(config: BuilderConfig): BuilderConfig {
  if (config.kind === 'wall') {
    return {
      kind: 'wall',
      layoutId: String(config.layoutId),
      slots: config.slots.map((s) =>
        s && s.type === 'photo'
          ? { type: 'photo' as const, url: String(s.url) }
          : { type: 'design' as const, designId: String((s as { designId: string }).designId) }
      ),
    };
  }
  if (config.kind === 'split') {
    const clamp = (n: unknown) => Math.min(100, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 50));
    return {
      kind: 'split',
      pieces: config.pieces,
      size: config.size,
      source:
        config.source.type === 'photo'
          ? { type: 'photo', url: String(config.source.url), focusX: clamp(config.source.focusX), focusY: clamp(config.source.focusY) }
          : { type: 'design', designId: String(config.source.designId) },
    };
  }
  return { kind: 'mix', tierId: String(config.tierId), designIds: config.designIds.map(String) };
}

/** Display price for a split set without validating the photo URL (used while uploading). */
export function splitPrice(pieces: SplitPieces, size: SplitSize, ownPhoto: boolean) {
  const row = SPLIT_PRICES[pieces];
  const base = ownPhoto ? row.customPrice : row.price;
  const uplift = SPLIT_SIZE_UPLIFT[size];
  return { price: base + uplift, mrp: Math.max(row.mrp, base) + uplift };
}

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
