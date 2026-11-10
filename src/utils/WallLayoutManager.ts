/**
 * WallLayoutManager.ts
 * 
 * Configurable wall layouts and dynamic slot dimension calculation engine
 * for MemoPrint's Custom Poster Wall Collage / Poster Studio.
 */

export type PosterSize = 'A5' | 'A4' | 'A3';
export type SlotCode = 'A5' | 'A4' | 'A3' | 'A4L' | 'A3L';
export type SlotOrientation = 'portrait' | 'landscape';

export interface WallSlot {
  id: string;
  index: number;
  code: SlotCode;
  size: PosterSize;
  orientation: SlotOrientation;
  row: number;
  col: number;
  /** Width in centimeters in real-world scale */
  widthCm: number;
  /** Height in centimeters in real-world scale */
  heightCm: number;
  /** Relative x position in cm from left wall margin */
  xCm: number;
  /** Relative y position in cm from top wall margin */
  yCm: number;
  /** Optional label e.g., 'Hero Center', 'Flank A4', 'Accent A5' */
  label?: string;
}

export interface WallLayoutConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  posterCount: number;
  wallSizeDisplay: string;
  price: number;
  mrp: number;
  recommendedGapCm: number;
  wallPaddingCm: number;
  totalWidthCm: number;
  totalHeightCm: number;
  aspectRatio: number;
  rows: SlotCode[][];
  slots: WallSlot[];
}

export interface CalculatedSlotBounds {
  slot: WallSlot;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
}

export interface DynamicWallMetrics {
  layoutId: string;
  containerWidth: number;
  containerHeight: number;
  totalWidthCm: number;
  totalHeightCm: number;
  aspectRatio: number;
  scaleFactor: number; // pixels per cm
  paddingPx: number;
  slots: CalculatedSlotBounds[];
}

/** Standard ISO poster physical dimensions in centimeters */
export const POSTER_DIMENSIONS_CM: Record<SlotCode, { width: number; height: number; size: PosterSize; orientation: SlotOrientation }> = {
  A5: { width: 14.8, height: 21.0, size: 'A5', orientation: 'portrait' },
  A4: { width: 21.0, height: 29.7, size: 'A4', orientation: 'portrait' },
  A3: { width: 29.7, height: 42.0, size: 'A3', orientation: 'portrait' },
  A4L: { width: 29.7, height: 21.0, size: 'A4', orientation: 'landscape' },
  A3L: { width: 42.0, height: 29.7, size: 'A3', orientation: 'landscape' },
};

/** Default gap between posters in centimeters */
export const DEFAULT_WALL_GAP_CM = 3.0;
export const DEFAULT_WALL_PADDING_CM = 6.0;

/** Raw definition rows for standard configurations */
interface RawLayoutDefinition {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  wallSizeDisplay: string;
  price: number;
  mrp: number;
  gapCm?: number;
  paddingCm?: number;
  rows: SlotCode[][];
}

const RAW_STANDARD_CONFIGURATIONS: RawLayoutDefinition[] = [
  {
    id: 'large',
    name: 'Large Gallery Wall',
    subtitle: '17 Posters • Best-selling balanced collage',
    description: 'A wide, harmoniously staggered spread with central hero posters flanked by A4 and A5 accents.',
    wallSizeDisplay: '4.5 × 2.9 ft',
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
    name: 'Duo Staggered Wall',
    subtitle: '18 Posters • Dual focal centerpiece',
    description: 'Two hero clusters stacked vertically, creating a tall, dynamic, and balanced gallery experience.',
    wallSizeDisplay: '4.3 × 4.0 ft',
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
    name: 'Mosaic Panoramic Wall',
    subtitle: '19 Posters • Long accent for headboards & desks',
    description: 'Wide, rhythmic mosaic designed specifically for long horizontal wall space above beds, sofas, or desk setups.',
    wallSizeDisplay: '6.1 × 4.3 ft',
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
    name: 'Hero Centerpiece Wall',
    subtitle: '20 Posters • Landscape centerpiece',
    description: 'Features a dramatic A3 landscape artwork centered on the wall surrounded by a curated salon of portrait prints.',
    wallSizeDisplay: '4.5 × 4.8 ft',
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
    name: 'Showcase Studio Wall',
    subtitle: '20 Posters • Modern double salon tier',
    description: 'Two clean horizontal salon tiers reminiscent of high-end art gallery exhibitions.',
    wallSizeDisplay: '5.5 × 3.0 ft',
    price: 899,
    mrp: 1599,
    rows: [
      ['A4', 'A5', 'A4', 'A3', 'A4', 'A5', 'A4', 'A3', 'A4', 'A5'],
      ['A5', 'A4', 'A5', 'A4', 'A3', 'A4', 'A5', 'A4', 'A5', 'A3'],
    ],
  },
  {
    id: 'grid-compact',
    name: 'Compact 3×3 Grid',
    subtitle: '9 Posters • Symmetrical square collage',
    description: 'Clean, modern 3x3 uniform gallery grid for focused aesthetic themes and minimalist spaces.',
    wallSizeDisplay: '3.2 × 3.2 ft',
    price: 499,
    mrp: 899,
    rows: [
      ['A4', 'A4', 'A4'],
      ['A4', 'A4', 'A4'],
      ['A4', 'A4', 'A4'],
    ],
  },
  {
    id: 'trio',
    name: 'Trio XL Master Wall',
    subtitle: '40 Posters • Room-defining statement collage',
    description: 'Forty premium prints that cover an entire statement wall with maximum visual impact and best value.',
    wallSizeDisplay: '7.6 × 4.8 ft',
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

/**
 * Builds a compiled WallLayoutConfig with computed slots and dimensions
 */
function compileLayout(def: RawLayoutDefinition): WallLayoutConfig {
  const gapCm = def.gapCm ?? DEFAULT_WALL_GAP_CM;
  const paddingCm = def.paddingCm ?? DEFAULT_WALL_PADDING_CM;

  // Calculate row metrics
  const rowMetrics = def.rows.map((row) => {
    let rowWidth = 0;
    let rowHeight = 0;
    row.forEach((code, i) => {
      const dim = POSTER_DIMENSIONS_CM[code];
      rowWidth += dim.width + (i > 0 ? gapCm : 0);
      rowHeight = Math.max(rowHeight, dim.height);
    });
    return { width: rowWidth, height: rowHeight };
  });

  const maxRowWidth = Math.max(...rowMetrics.map((r) => r.width));
  const totalSlotsHeight =
    rowMetrics.reduce((sum, r) => sum + r.height, 0) + (rowMetrics.length - 1) * gapCm;

  const slots: WallSlot[] = [];
  let currentY = 0;
  let slotIdx = 0;

  def.rows.forEach((row, rowIdx) => {
    const rowMetric = rowMetrics[rowIdx];
    // Center shorter rows horizontally
    let currentX = (maxRowWidth - rowMetric.width) / 2;

    row.forEach((code, colIdx) => {
      const dim = POSTER_DIMENSIONS_CM[code];
      // Vertically center different poster heights within the row
      const yOffset = (rowMetric.height - dim.height) / 2;

      slots.push({
        id: `slot_${def.id}_${slotIdx}`,
        index: slotIdx,
        code,
        size: dim.size,
        orientation: dim.orientation,
        row: rowIdx,
        col: colIdx,
        widthCm: dim.width,
        heightCm: dim.height,
        xCm: currentX,
        yCm: currentY + yOffset,
        label: `${dim.size} ${dim.orientation}`,
      });

      currentX += dim.width + gapCm;
      slotIdx++;
    });

    currentY += rowMetric.height + gapCm;
  });

  const totalWidthCm = maxRowWidth;
  const totalHeightCm = totalSlotsHeight;

  return {
    id: def.id,
    name: def.name,
    subtitle: def.subtitle,
    description: def.description,
    posterCount: slots.length,
    wallSizeDisplay: def.wallSizeDisplay,
    price: def.price,
    mrp: def.mrp,
    recommendedGapCm: gapCm,
    wallPaddingCm: paddingCm,
    totalWidthCm,
    totalHeightCm,
    aspectRatio: (totalWidthCm + paddingCm * 2) / (totalHeightCm + paddingCm * 2),
    rows: def.rows,
    slots,
  };
}

/** Pre-compiled list of standard configurations */
export const STANDARD_WALL_LAYOUTS: WallLayoutConfig[] = RAW_STANDARD_CONFIGURATIONS.map(compileLayout);

/**
 * WallLayoutManager Utility Class
 */
export class WallLayoutManager {
  private static layouts: Map<string, WallLayoutConfig> = new Map(
    STANDARD_WALL_LAYOUTS.map((l) => [l.id, l])
  );

  /**
   * Returns all available wall layout configurations
   */
  public static getAllLayouts(): WallLayoutConfig[] {
    return Array.from(this.layouts.values());
  }

  /**
   * Retrieves a specific layout by ID (defaults to 'large' if not found)
   */
  public static getLayout(id: string): WallLayoutConfig {
    return this.layouts.get(id) || this.layouts.get('large') || STANDARD_WALL_LAYOUTS[0];
  }

  /**
   * Registers a custom layout configuration dynamically
   */
  public static registerCustomLayout(def: RawLayoutDefinition): WallLayoutConfig {
    const compiled = compileLayout(def);
    this.layouts.set(compiled.id, compiled);
    return compiled;
  }

  /**
   * Computes dynamic slot coordinates and bounds scaled to fit the provided container size.
   * Can accept either container width (auto-calculates height) or explicit width and height.
   */
  public static calculateDynamicDimensions(
    layout: WallLayoutConfig,
    containerWidthPx: number,
    containerHeightPx?: number
  ): DynamicWallMetrics {
    const padCm = layout.wallPaddingCm;
    const fullWidthCm = layout.totalWidthCm + padCm * 2;
    const fullHeightCm = layout.totalHeightCm + padCm * 2;
    const wallAspectRatio = fullWidthCm / fullHeightCm;

    let targetWidthPx = Math.max(containerWidthPx, 100);
    let targetHeightPx = containerHeightPx || targetWidthPx / wallAspectRatio;

    // Maintain aspect ratio if container height was explicitly constrained
    if (containerHeightPx && containerHeightPx > 0) {
      const containerRatio = targetWidthPx / targetHeightPx;
      if (containerRatio > wallAspectRatio) {
        targetWidthPx = targetHeightPx * wallAspectRatio;
      } else {
        targetHeightPx = targetWidthPx / wallAspectRatio;
      }
    }

    const scaleFactor = targetWidthPx / fullWidthCm;
    const paddingPx = padCm * scaleFactor;

    const calculatedSlots: CalculatedSlotBounds[] = layout.slots.map((slot) => {
      const leftPercent = ((slot.xCm + padCm) / fullWidthCm) * 100;
      const topPercent = ((slot.yCm + padCm) / fullHeightCm) * 100;
      const widthPercent = (slot.widthCm / fullWidthCm) * 100;
      const heightPercent = (slot.heightCm / fullHeightCm) * 100;

      const leftPx = (slot.xCm + padCm) * scaleFactor;
      const topPx = (slot.yCm + padCm) * scaleFactor;
      const widthPx = slot.widthCm * scaleFactor;
      const heightPx = slot.heightCm * scaleFactor;

      return {
        slot,
        leftPercent,
        topPercent,
        widthPercent,
        heightPercent,
        leftPx,
        topPx,
        widthPx,
        heightPx,
        aspectRatio: slot.widthCm / slot.heightCm,
      };
    });

    return {
      layoutId: layout.id,
      containerWidth: targetWidthPx,
      containerHeight: targetHeightPx,
      totalWidthCm: fullWidthCm,
      totalHeightCm: fullHeightCm,
      aspectRatio: wallAspectRatio,
      scaleFactor,
      paddingPx,
      slots: calculatedSlots,
    };
  }

  /**
   * Helper to generate CSS positioning style for a calculated slot
   */
  public static getSlotCss(bounds: CalculatedSlotBounds, usePixels = false): React.CSSProperties {
    if (usePixels) {
      return {
        position: 'absolute',
        left: `${bounds.leftPx}px`,
        top: `${bounds.topPx}px`,
        width: `${bounds.widthPx}px`,
        height: `${bounds.heightPx}px`,
      };
    }
    return {
      position: 'absolute',
      left: `${bounds.leftPercent}%`,
      top: `${bounds.topPercent}%`,
      width: `${bounds.widthPercent}%`,
      height: `${bounds.heightPercent}%`,
    };
  }
}

/** Standalone convenience helper functions */
export const getWallLayouts = (): WallLayoutConfig[] => WallLayoutManager.getAllLayouts();
export const getWallLayoutById = (id: string): WallLayoutConfig => WallLayoutManager.getLayout(id);
export const calculateDynamicWallDimensions = (
  layout: WallLayoutConfig,
  containerWidthPx: number,
  containerHeightPx?: number
): DynamicWallMetrics => WallLayoutManager.calculateDynamicDimensions(layout, containerWidthPx, containerHeightPx);
