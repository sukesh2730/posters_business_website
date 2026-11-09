// Turns a wall / split poster / mix pack from an order into print-ready image files and a packing
// sheet, entirely in the admin's browser (nothing is uploaded). Output is JPEG at up to 300 dpi.

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { PosterArt } from '../components/PosterArt';
import { PosterDesign, getDesign } from '../shared/posterDesigns';
import {
  BuilderConfig,
  SPLIT_SIZE_LABEL,
  SPLIT_TEMPLATES,
  SlotCode,
  SplitSize,
  computeWallGeometry,
  getMixTier,
  getWallLayout,
  mixTierPricing,
} from '../shared/printPricing';

// Pixels at 300 dpi.
const PX: Record<string, [number, number]> = {
  A5: [1748, 2480],
  A4: [2480, 3508],
  A3: [3508, 4961],
  '13x19': [3900, 5700],
};
const SLOT_PX: Record<SlotCode, [number, number]> = {
  A5: PX.A5,
  A4: PX.A4,
  A3: PX.A3,
  A4L: [PX.A4[1], PX.A4[0]],
  A3L: [PX.A3[1], PX.A3[0]],
};
const JPEG_QUALITY = 0.92;

export interface PrintFile {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}
export type ImageFetcher = (url: string) => Promise<Blob>;
export type Progress = (done: number, total: number) => void;

const defaultFetcher: ImageFetcher = async (url) => {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`Could not download the customer's photo (${r.status}).`);
  return r.blob();
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('This browser could not create a drawing surface for the print files.');
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}
const toJpeg = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode an image.'))), 'image/jpeg', JPEG_QUALITY));

async function loadBitmapFromBlob(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  return createImageBitmap(blob);
}

const ART_W = 300; // PosterArt's own coordinate system
const ART_H = 424;

/**
 * Vector artwork rendered at exactly w x h pixels (so it stays sharp at 300 dpi), optionally showing only
 * a region of the art. Web fonts do not load inside an SVG image, so titles use a system font.
 */
async function renderDesignSvg(design: PosterDesign, w: number, h: number, view?: { x: number; y: number; w: number; h: number }) {
  const markup = renderToStaticMarkup(React.createElement(PosterArt, { design, showTitle: true }));
  let svg = markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}"`);
  if (view) {
    svg = svg
      .replace('viewBox="0 0 300 424"', `viewBox="${view.x} ${view.y} ${view.w} ${view.h}"`)
      .replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="none"');
  }
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error(`Could not draw design "${design.title}".`));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  return img;
}

/** Draw `img` so it covers the w x h area, shifted by focus (0..100), at offset (dx, dy) inside it. */
function drawCover(ctx: CanvasRenderingContext2D, img: { width: number; height: number } & CanvasImageSource, areaW: number, areaH: number, focusX = 50, focusY = 50, originX = 0, originY = 0) {
  const scale = Math.max(areaW / img.width, areaH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const ox = (areaW - dw) * (focusX / 100);
  const oy = (areaH - dh) * (focusY / 100);
  ctx.drawImage(img, ox - originX, oy - originY, dw, dh);
}

async function posterJpeg(design: PosterDesign, w: number, h: number, fetcher: ImageFetcher) {
  const { c, ctx } = makeCanvas(w, h);
  if (design.imageUrl) {
    drawCover(ctx, await loadBitmapFromBlob(await fetcher(design.imageUrl)), w, h);
  } else {
    ctx.drawImage(await renderDesignSvg(design, w, h), 0, 0, w, h);
  }
  return toJpeg(c);
}
async function photoJpeg(photoUrl: string, w: number, h: number, fetcher: ImageFetcher) {
  const { c, ctx } = makeCanvas(w, h);
  drawCover(ctx, await loadBitmapFromBlob(await fetcher(photoUrl)), w, h);
  return toJpeg(c);
}

/**
 * Pixel sizes for a split poster. The largest panel gets the full paper size at 300 dpi and the other panels
 * follow from the template. Panels are rendered one at a time, so no huge combined image is ever needed.
 */
export function computeSplitPixels(pieces: 3 | 4 | 5 | 8, size: SplitSize) {
  const tpl = SPLIT_TEMPLATES[pieces];
  const [baseW, baseH] = PX[size];
  const overallW = baseW / Math.max(...tpl.panels.map((p) => p.w));
  const overallH = baseH / Math.max(...tpl.panels.map((p) => p.h));
  return {
    overallW,
    overallH,
    dpi: 300,
    panels: tpl.panels.map((p) => ({ w: Math.round(p.w * overallW), h: Math.round(p.h * overallH) })),
  };
}

export interface PrintJob {
  folder: string;
  files: PrintFile[];
  sheet: string;
}

export async function buildPrintJob(config: BuilderConfig, orderNumber: string, fetcher: ImageFetcher = defaultFetcher, onProgress?: Progress): Promise<PrintJob> {
  const files: PrintFile[] = [];
  const lines: string[] = [`Order ${orderNumber}`];

  if (config.kind === 'wall') {
    const layout = getWallLayout(config.layoutId);
    if (!layout) throw new Error('This order refers to a wall layout that no longer exists.');
    const geo = computeWallGeometry(layout);
    lines.push(`Build your wall: ${layout.name} (${layout.posterCount} posters, ${layout.wallSize})`, '', 'Rows, top to bottom (slot numbers are left to right):');
    let n = 0;
    layout.rows.forEach((row, ri) => {
      lines.push(`  Row ${ri + 1}: ` + row.map((code) => `#${pad(++n)} ${code}`).join('  '));
    });
    lines.push('', 'Files:');
    for (const s of geo.slots) {
      const fill = config.slots[s.index];
      if (!fill) throw new Error(`Poster ${s.index + 1} is empty in this order.`);
      const [w, h] = SLOT_PX[s.code];
      let blob: Blob;
      let label: string;
      if (fill.type === 'design') {
        const d = getDesign(fill.designId);
        if (!d) throw new Error(`Poster ${s.index + 1} uses a design that no longer exists (${fill.designId}).`);
        blob = await posterJpeg(d, w, h, fetcher);
        label = `design: ${d.title} [${d.id}]`;
      } else {
        blob = await photoJpeg(fill.url, w, h, fetcher);
        label = 'customer photo (centre-cropped to fit)';
      }
      const name = `slot-${pad(s.index + 1)}_${s.code}${fill.type === 'design' ? '_' + slug(label.split(':')[1].split('[')[0]) : '_customer-photo'}.jpg`;
      files.push({ name, blob, width: w, height: h });
      lines.push(`  ${name}  ${w}x${h}px  ${label}`);
      onProgress?.(files.length, geo.slots.length);
    }
    return { folder: `${orderNumber}_wall-${layout.id}`, files, sheet: lines.join('\n') + '\n' };
  }

  if (config.kind === 'mix') {
    const tier = getMixTier(config.tierId);
    if (!tier) throw new Error('This order refers to a poster pack that no longer exists.');
    const { count } = mixTierPricing(tier);
    lines.push(`Mix and match: buy ${tier.buy}, get ${tier.free} free (${count} x A4 posters)`, '', 'Files:');
    const [w, h] = PX.A4;
    for (let i = 0; i < config.designIds.length; i++) {
      const d = getDesign(config.designIds[i]);
      if (!d) throw new Error(`Poster ${i + 1} uses a design that no longer exists (${config.designIds[i]}).`);
      const name = `poster-${pad(i + 1)}_A4_${slug(d.title)}.jpg`;
      files.push({ name, blob: await posterJpeg(d, w, h, fetcher), width: w, height: h });
      lines.push(`  ${name}  ${w}x${h}px  ${d.title} [${d.id}]`);
      onProgress?.(files.length, config.designIds.length);
    }
    return { folder: `${orderNumber}_mix-${tier.id}`, files, sheet: lines.join('\n') + '\n' };
  }

  // split poster
  const tpl = SPLIT_TEMPLATES[config.pieces];
  const geo = computeSplitPixels(config.pieces, config.size);
  const { overallW, overallH } = geo;

  let photo: ({ width: number; height: number } & CanvasImageSource) | null = null;
  let design: PosterDesign | undefined;
  let rasterDesign: ({ width: number; height: number } & CanvasImageSource) | null = null;
  let fx = 50;
  let fy = 50;
  let sourceLabel: string;
  if (config.source.type === 'photo') {
    photo = await loadBitmapFromBlob(await fetcher(config.source.url));
    fx = config.source.focusX ?? 50;
    fy = config.source.focusY ?? 50;
    sourceLabel = `customer photo ${photo.width}x${photo.height}px`;
  } else {
    design = getDesign(config.source.designId);
    if (!design) throw new Error('This order uses a design that no longer exists.');
    if (design.imageUrl) rasterDesign = await loadBitmapFromBlob(await fetcher(design.imageUrl));
    sourceLabel = `design: ${design.title} [${design.id}]`;
  }
  lines.push(
    `Split poster: ${config.pieces} panels, ${SPLIT_SIZE_LABEL[config.size]}`,
    `Source: ${sourceLabel}`,
    `Each panel is ${geo.dpi} dpi at its printed size. Print every panel at its own size and hang them in the layout order below.`,
    '',
    'Layout (x,y = position of the panel on the wall, as a fraction of the whole piece):',
    '',
    'Files:'
  );
  if (photo) {
    // Pixels the photo can actually provide per printed inch across the whole piece.
    const cover = Math.max(overallW / photo.width, overallH / photo.height);
    const effective = Math.round(300 / cover);
    if (effective < 150) lines.splice(3, 0, `WARNING: the customer's photo is low resolution for this size (about ${effective} dpi). Prints may look soft.`);
  }
  // Region of the vector art that is visible once it is stretched to cover the whole piece.
  const artScale = Math.max(overallW / ART_W, overallH / ART_H);
  const visW = overallW / artScale;
  const visH = overallH / artScale;
  const visX = (ART_W - visW) / 2;
  const visY = (ART_H - visH) / 2;
  for (let i = 0; i < tpl.panels.length; i++) {
    const p = tpl.panels[i];
    const { w, h } = geo.panels[i];
    const { c, ctx } = makeCanvas(w, h);
    if (photo) {
      drawCover(ctx, photo, overallW, overallH, fx, fy, p.x * overallW, p.y * overallH);
    } else if (rasterDesign) {
      drawCover(ctx, rasterDesign, overallW, overallH, 50, 50, p.x * overallW, p.y * overallH);
    } else {
      const view = { x: visX + p.x * visW, y: visY + p.y * visH, w: p.w * visW, h: p.h * visH };
      ctx.drawImage(await renderDesignSvg(design!, w, h, view), 0, 0, w, h);
    }
    const name = `panel-${pad(i + 1)}_of_${config.pieces}.jpg`;
    files.push({ name, blob: await toJpeg(c), width: w, height: h });
    lines.push(`  ${name}  ${w}x${h}px  position x=${p.x.toFixed(2)} y=${p.y.toFixed(2)}`);
    onProgress?.(files.length, tpl.panels.length);
  }
  return { folder: `${orderNumber}_split-${config.pieces}`, files, sheet: lines.join('\n') + '\n' };
}

export async function buildPrintZip(config: BuilderConfig, orderNumber: string, fetcher?: ImageFetcher, onProgress?: Progress): Promise<{ blob: Blob; fileName: string; fileCount: number }> {
  const job = await buildPrintJob(config, orderNumber, fetcher, onProgress);
  const zip = new JSZip();
  const dir = zip.folder(job.folder)!;
  dir.file('packing-sheet.txt', job.sheet);
  for (const f of job.files) dir.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); // JPEGs are already compressed
  return { blob, fileName: `${job.folder}.zip`, fileCount: job.files.length };
}
