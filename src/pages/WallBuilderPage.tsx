import React, { useMemo, useState } from 'react';
import { ShoppingBag, Shuffle, Eraser, AlertCircle } from 'lucide-react';
import { WallPreview } from '../components/WallPreview';
import { DesignPicker } from '../components/DesignPicker';
import { PhotoUploader } from '../components/PhotoUploader';
import { PriceLine, StepHeading, rupees } from '../components/BuilderBits';
import { useCart } from '../services/cartContext';
import { builderToCartItem } from '../services/builderCart';
import {
  WALL_LAYOUTS,
  SlotFill,
  computeWallGeometry,
  getWallLayout,
  shuffled,
  tryPriceBuilder,
} from '../shared/printPricing';
import { POSTER_DESIGNS, PosterDesign, PosterThemeId, designsByTheme } from '../shared/posterDesigns';

interface WallBuilderPageProps {
  initialLayoutId?: string;
  onOpenCart: () => void;
}

export const WallBuilderPage: React.FC<WallBuilderPageProps> = ({ initialLayoutId, onOpenCart }) => {
  const { addItem } = useCart();
  const [layoutId, setLayoutId] = useState<string>(getWallLayout(initialLayoutId || '')?.id || 'large');
  const layout = getWallLayout(layoutId)!;

  const [fills, setFills] = useState<Array<SlotFill | null>>([]);
  const slots = useMemo(
    () => Array.from({ length: layout.posterCount }, (_, i) => fills[i] ?? null),
    [fills, layout]
  );
  const [selected, setSelected] = useState<number>(0);
  const [tab, setTab] = useState<'designs' | 'photos'>('designs');
  const [theme, setTheme] = useState<PosterThemeId | 'all'>('all');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const geometry = useMemo(() => computeWallGeometry(layout), [layout]);
  const filled = slots.filter(Boolean).length;
  const remaining = layout.posterCount - filled;
  const sizeMix = useMemo(() => {
    const counts: Record<string, number> = {};
    geometry.slots.forEach((s) => (counts[s.size] = (counts[s.size] || 0) + 1));
    return Object.entries(counts)
      .sort()
      .map(([k, v]) => `${v} × ${k}`)
      .join(', ');
  }, [geometry]);

  const nextEmpty = (arr: Array<SlotFill | null>, from: number) => {
    for (let i = 1; i <= arr.length; i++) {
      const idx = (from + i) % arr.length;
      if (!arr[idx]) return idx;
    }
    return from;
  };

  const place = (fill: SlotFill) => {
    setError(null);
    const next = [...slots];
    next[selected] = fill;
    setFills(next);
    setSelected(nextEmpty(next, selected));
  };

  const autoFill = (t: PosterThemeId | 'all') => {
    setError(null);
    const pool = shuffled(designsByTheme(t).length >= 8 ? designsByTheme(t) : POSTER_DESIGNS);
    let n = 0;
    const next = slots.map((s) => s ?? { type: 'design' as const, designId: pool[n++ % pool.length].id });
    setFills(next);
  };

  const clearAll = () => {
    setFills([]);
    setSelected(0);
    setError(null);
  };

  const changeLayout = (id: string) => {
    setLayoutId(id);
    setSelected(0);
    setError(null);
  };

  const handleAdd = () => {
    const config = { kind: 'wall' as const, layoutId, slots };
    if (remaining > 0) {
      setError(`${remaining} ${remaining === 1 ? 'poster is' : 'posters are'} still empty. Fill them or use auto-fill.`);
      return;
    }
    if (!tryPriceBuilder(config)) {
      setError('One of your photos has not finished uploading. Wait for it to complete, then try again.');
      return;
    }
    addItem(builderToCartItem(config));
    onOpenCart();
  };

  const durablePhotos = photos.filter((u) => !u.startsWith('blob:'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl font-semibold text-slate-900">
          Build your wall
        </h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Pick a layout, then fill every spot with a design or one of your own photos. You see the whole wall before you order.
        </p>
      </header>

      {/* Layout picker */}
      <section className="space-y-3" aria-label="Choose a layout">
        <StepHeading title="Choose a layout" hint="Prices include every poster" />
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
          {WALL_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => changeLayout(l.id)}
              aria-pressed={l.id === layoutId}
              className={`shrink-0 w-44 flex flex-col justify-start text-left rounded-2xl bg-white p-2.5 border transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                l.id === layoutId ? 'border-rose-500 shadow-md ring-1 ring-rose-500' : 'border-stone-200 hover:shadow-sm'
              }`}
            >
              <WallPreview
                layout={l}
                mini
                slots={Array.from({ length: l.posterCount }, (_, i) => ({
                  type: 'design' as const,
                  designId: POSTER_DESIGNS[(i * 5) % POSTER_DESIGNS.length].id,
                }))}
              />
              <div className="pt-2 space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{l.name}</p>
                <p className="text-[11px] text-slate-500">{l.posterCount} posters · {l.wallSize}</p>
                <p className="text-sm">
                  <span className="font-bold text-slate-900">{rupees(l.price)}</span>{' '}
                  <span className="text-xs text-slate-400 line-through">{rupees(l.mrp)}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* The wall */}
        <section className="lg:col-span-7 lg:sticky lg:top-24 space-y-4" aria-label="Your wall">
          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{layout.name}</p>
                <p className="text-xs text-slate-500">{layout.blurb}</p>
              </div>
              <p className="text-xs text-slate-500 text-right shrink-0">
                {sizeMix}
              </p>
            </div>

            <WallPreview layout={layout} slots={slots} selectedIndex={selected} onSelectSlot={setSelected} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-40">
                <div className="h-2 rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={layout.posterCount} aria-valuenow={filled}>
                  <div className="h-full bg-rose-500 transition-all" style={{ width: `${(filled / layout.posterCount) * 100}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {filled} of {layout.posterCount} filled
                  {slots[selected] ? '' : ` · poster ${selected + 1} is selected`}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => autoFill(theme)} disabled={remaining === 0}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-stone-300 bg-white hover:border-rose-400 disabled:opacity-40">
                  <Shuffle className="w-3.5 h-3.5" /> Auto-fill the rest
                </button>
                <button type="button" onClick={clearAll} disabled={filled === 0}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-stone-300 bg-white hover:border-rose-400 disabled:opacity-40">
                  <Eraser className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PriceLine price={layout.price} mrp={layout.mrp} />
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
              >
                <ShoppingBag className="w-4 h-4" /> Add wall to cart
              </button>
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Printed on 300 GSM matte paper, dispatched within 48 hours. Posters are not adhesive; mount with glue dots or double-sided tape.
            </p>
          </div>
        </section>

        {/* Picker */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-4 shadow-sm" aria-label="Fill the selected poster">
          <StepHeading title={`Poster ${selected + 1}`} hint={`${geometry.slots[selected]?.size ?? ''}${geometry.slots[selected]?.landscape ? ' landscape' : ''}`} />
          <div className="inline-flex rounded-full bg-stone-100 p-1 text-xs font-semibold" role="tablist">
            {(['designs', 'photos'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-full transition-colors ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                {t === 'designs' ? 'Designs' : 'My photos'}
              </button>
            ))}
          </div>

          {tab === 'designs' ? (
            <DesignPicker
              theme={theme}
              onThemeChange={setTheme}
              onPick={(d: PosterDesign) => place({ type: 'design', designId: d.id })}
            />
          ) : (
            <div className="space-y-4">
              <PhotoUploader photos={photos} onChange={setPhotos} minPhotos={0} maxPhotos={layout.posterCount} />
              {durablePhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Tap a photo to put it in poster {selected + 1}.</p>
                  <div className="grid grid-cols-4 gap-2">
                    {durablePhotos.map((u) => (
                      <button key={u} type="button" onClick={() => place({ type: 'photo', url: u })}
                        className="aspect-[3/4] rounded-lg overflow-hidden border border-stone-200 hover:border-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                        <img src={u} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
