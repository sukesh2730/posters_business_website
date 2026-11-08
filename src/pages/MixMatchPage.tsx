import React, { useMemo, useState } from 'react';
import { ShoppingBag, Shuffle, X, AlertCircle } from 'lucide-react';
import { DesignPicker } from '../components/DesignPicker';
import { PosterArt } from '../components/PosterArt';
import { StepHeading, PriceLine, rupees } from '../components/BuilderBits';
import { useCart } from '../services/cartContext';
import { builderToCartItem } from '../services/builderCart';
import { MIX_TIERS, getMixTier, mixTierPricing, shuffled, tryPriceBuilder } from '../shared/printPricing';
import { POSTER_DESIGNS, POSTER_THEMES, PosterThemeId, designsByTheme, getDesign } from '../shared/posterDesigns';

interface MixMatchPageProps {
  initialTheme?: string;
  initialTier?: string;
  onOpenCart: () => void;
}

export const MixMatchPage: React.FC<MixMatchPageProps> = ({ initialTheme, initialTier, onOpenCart }) => {
  const { addItem } = useCart();
  const [tierId, setTierId] = useState<string>(getMixTier(initialTier || '')?.id || 's10');
  const tier = getMixTier(tierId)!;
  const { count, price, mrp } = mixTierPricing(tier);

  const startTheme = POSTER_THEMES.find((t) => t.id === initialTheme)?.id ?? 'all';
  const [theme, setTheme] = useState<PosterThemeId | 'all'>(startTheme);
  const [ids, setIds] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  // Switching to a smaller pack trims the extras instead of losing the whole selection.
  const picked = ids.slice(0, count);
  const remaining = count - picked.length;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    picked.forEach((id) => (c[id] = (c[id] || 0) + 1));
    return c;
  }, [picked]);

  const add = (id: string) => {
    if (remaining === 0) {
      setNote('Your pack is full. Remove a poster to swap it.');
      return;
    }
    setNote(null);
    setIds([...picked, id]);
  };

  const autoFill = () => {
    const pool = shuffled(designsByTheme(theme).length >= 4 ? designsByTheme(theme) : POSTER_DESIGNS);
    const extra: string[] = [];
    for (let i = 0; i < remaining; i++) extra.push(pool[i % pool.length].id);
    setNote(null);
    setIds([...picked, ...extra]);
  };

  const handleAdd = () => {
    const config = { kind: 'mix' as const, tierId, designIds: picked };
    if (remaining > 0 || !tryPriceBuilder(config)) {
      setNote(`Pick ${remaining} more ${remaining === 1 ? 'poster' : 'posters'}, or auto-fill the rest.`);
      return;
    }
    addItem(builderToCartItem(config));
    onOpenCart();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl font-semibold text-slate-900">Mix and match posters</h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Pick a pack size, then choose any A4 posters. The more you take, the less each one costs.
        </p>
      </header>

      <section className="space-y-3" aria-label="Pack size">
        <StepHeading title="Choose a pack" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup">
          {MIX_TIERS.map((t) => {
            const p = mixTierPricing(t);
            const active = t.id === tierId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTierId(t.id)}
                className={`text-left rounded-2xl bg-white border p-4 space-y-1.5 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                  active ? 'border-rose-500 ring-1 ring-rose-500 shadow-md' : 'border-stone-200 hover:shadow-sm'
                }`}
              >
                <span className="block h-4 text-[11px] font-semibold text-rose-600">{t.badge ?? ''}</span>
                <p className="font-['Playfair_Display',serif] text-2xl font-semibold text-slate-900">{p.count} posters</p>
                <p className="text-xs text-slate-600">Buy {t.buy}, get {t.free} free</p>
                <p className="text-sm">
                  <span className="font-bold text-slate-900">{rupees(p.price)}</span>{' '}
                  <span className="text-xs text-slate-400 line-through">{rupees(p.mrp)}</span>
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold">{rupees(p.perPoster)} per poster</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-4 shadow-sm" aria-label="Pick posters">
          <StepHeading title="Pick your posters" hint="Tap a poster to add it. Repeats are fine." />
          <DesignPicker theme={theme} onThemeChange={setTheme} onPick={(d) => add(d.id)} counts={counts} columns="grid-cols-3 sm:grid-cols-4 lg:grid-cols-5" />
        </section>

        <section className="lg:col-span-5 lg:sticky lg:top-24 space-y-4" aria-label="Your pack">
          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">
                {picked.length} of {count} chosen
              </p>
              <button type="button" onClick={autoFill} disabled={remaining === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-stone-300 bg-white hover:border-rose-400 disabled:opacity-40">
                <Shuffle className="w-3.5 h-3.5" /> Auto-fill the rest
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
              {picked.map((id, i) => {
                const d = getDesign(id)!;
                return (
                  <div key={`${id}-${i}`} className="relative rounded-md overflow-hidden shadow-sm border border-stone-200" style={{ aspectRatio: '300 / 424' }}>
                    <PosterArt design={d} showTitle={false} className="w-full h-full block" />
                    <button type="button" onClick={() => setIds(picked.filter((_, k) => k !== i))}
                      aria-label={`Remove ${d.title}`}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-rose-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {Array.from({ length: Math.min(remaining, 60) }).map((_, i) => (
                <div key={`e${i}`} className="rounded-md border border-dashed border-stone-300 bg-stone-50" style={{ aspectRatio: '300 / 424' }} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PriceLine price={price} mrp={mrp} />
              <button type="button" onClick={handleAdd}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors">
                <ShoppingBag className="w-4 h-4" /> Add pack to cart
              </button>
            </div>
            {note && (
              <p role="alert" className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {note}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
