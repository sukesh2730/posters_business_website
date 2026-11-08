import React from 'react';
import { WallPreview } from './WallPreview';
import { SplitPreview } from './SplitPreview';
import { PosterArt } from './PosterArt';
import { rupees } from './BuilderBits';
import { WALL_LAYOUTS, MIX_TIERS, mixTierPricing, SPLIT_PIECES, SPLIT_TEMPLATES, splitPrice } from '../shared/printPricing';
import { POSTER_THEMES, POSTER_DESIGNS, getDesign } from '../shared/posterDesigns';
import { Product } from '../types';

interface PosterShowcaseProps {
  products: Product[];
  onNavigate: (route: string) => void;
  onSelectProduct: (product: Product) => void;
}

const PACK_IDS = [
  { id: 'prod-custom-retro-prints', label: 'Retro prints', note: '10 photos' },
  { id: 'prod-custom-pocket-prints', label: 'Mini pocket photos', note: '5 photos' },
  { id: 'prod-custom-photobooth-strip', label: 'Photobooth strips', note: '3 strips' },
];

const Heading: React.FC<{ title: string; sub: string; cta?: { label: string; onClick: () => void } }> = ({ title, sub, cta }) => (
  <div className="flex items-end justify-between gap-4 flex-wrap">
    <div>
      <h2 className="font-['Playfair_Display',serif] text-2xl sm:text-3xl font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600 mt-1">{sub}</p>
    </div>
    {cta && (
      <button type="button" onClick={cta.onClick} className="text-sm font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-4">
        {cta.label}
      </button>
    )}
  </div>
);

export const PosterShowcase: React.FC<PosterShowcaseProps> = ({ products, onNavigate, onSelectProduct }) => {
  return (
    <div className="space-y-14 py-2">
      <section className="space-y-5" aria-label="Build your wall">
        <Heading
          title="Build your wall"
          sub="Pick a layout and fill it with designs or your own photos."
          cta={{ label: 'Open the builder', onClick: () => onNavigate('wall-builder') }}
        />
        <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
          {WALL_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onNavigate(`wall-builder?section=${l.id}`)}
              className="shrink-0 w-56 sm:w-64 flex flex-col justify-start text-left bg-white rounded-2xl border border-stone-200 p-3 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-shadow"
            >
              <WallPreview
                layout={l}
                mini
                slots={Array.from({ length: l.posterCount }, (_, i) => ({
                  type: 'design' as const,
                  designId: POSTER_DESIGNS[(i * 5) % POSTER_DESIGNS.length].id,
                }))}
              />
              <div className="pt-3">
                <p className="font-semibold text-slate-900">{l.name}</p>
                <p className="text-xs text-slate-500">{l.posterCount} posters · {l.wallSize}</p>
                <p className="text-sm mt-1">
                  <span className="font-bold">{rupees(l.price)}</span>{' '}
                  <span className="text-xs text-slate-400 line-through">{rupees(l.mrp)}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-label="Mix and match">
        <Heading title="Buy more, pay less per poster" sub="Any A4 posters, mixed however you like." cta={{ label: 'Pick posters', onClick: () => onNavigate('mix-match') }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MIX_TIERS.map((t) => {
            const p = mixTierPricing(t);
            return (
              <button key={t.id} type="button" onClick={() => onNavigate(`mix-match?section=${t.id}`)}
                className="text-left bg-white rounded-2xl border border-stone-200 p-4 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-shadow">
                <p className="font-['Playfair_Display',serif] text-2xl font-semibold">{p.count} posters</p>
                <p className="text-xs text-slate-600">Buy {t.buy}, get {t.free} free</p>
                <p className="text-sm mt-2"><span className="font-bold">{rupees(p.price)}</span> <span className="text-xs text-slate-400 line-through">{rupees(p.mrp)}</span></p>
                <p className="text-[11px] text-emerald-700 font-semibold">{rupees(p.perPoster)} each</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-5" aria-label="Split posters">
        <Heading title="Split posters" sub="One image across several panels." cta={{ label: 'Make a split poster', onClick: () => onNavigate('split-builder') }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SPLIT_PIECES.map((n, i) => (
            <button key={n} type="button" onClick={() => onNavigate(`split-builder?section=${n}`)}
              className="text-left bg-white rounded-2xl border border-stone-200 p-3 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-shadow">
              <SplitPreview pieces={n} design={getDesign(['cars-1', 'music-1', 'divine-2', 'kollywood-2'][i])} />
              <p className="pt-3 font-semibold text-slate-900">{n} piece set</p>
              <p className="text-xs text-slate-500">{SPLIT_TEMPLATES[n].label} · from {rupees(splitPrice(n, 'A4', false).price)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-label="Shop by theme">
        <Heading title="Shop by theme" sub="Start a pack with the posters you like." />
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {POSTER_THEMES.map((t) => (
            <button key={t.id} type="button" onClick={() => onNavigate(`mix-match?cat=${t.id}`)}
              className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-xl" title={t.tagline}>
              <div className="rounded-xl overflow-hidden shadow-sm border border-stone-200 group-hover:shadow-md transition-shadow" style={{ aspectRatio: '300 / 424' }}>
                <PosterArt design={getDesign(`${t.id}-1`)!} showTitle={false} className="w-full h-full block" />
              </div>
              <p className="pt-2 text-xs font-semibold text-slate-800">{t.label}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-label="Photo prints">
        <Heading title="Turn your photos into prints" sub="Small packs, printed from your own pictures." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PACK_IDS.map((pk) => {
            const product = products.find((p) => p.id === pk.id);
            if (!product) return null;
            return (
              <button key={pk.id} type="button" onClick={() => onSelectProduct(product)}
                className="text-left bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-shadow">
                <img src={product.imageUrl} alt="" loading="lazy" className="w-full h-40 object-cover" />
                <div className="p-4">
                  <p className="font-semibold text-slate-900">{pk.label}</p>
                  <p className="text-sm mt-1">
                    <span className="font-bold">{pk.note} for {rupees(product.price)}</span>{' '}
                    <span className="text-xs text-slate-400 line-through">{rupees(product.originalPrice)}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
