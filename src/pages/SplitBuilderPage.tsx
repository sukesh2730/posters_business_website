import React, { useState } from 'react';
import { ShoppingBag, AlertCircle } from 'lucide-react';
import { SplitPreview } from '../components/SplitPreview';
import { DesignPicker } from '../components/DesignPicker';
import { PhotoUploader } from '../components/PhotoUploader';
import { PriceLine, StepHeading } from '../components/BuilderBits';
import { useCart } from '../services/cartContext';
import { builderToCartItem } from '../services/builderCart';
import {
  SPLIT_PIECES,
  SPLIT_SIZES,
  SPLIT_SIZE_LABEL,
  SPLIT_TEMPLATES,
  SplitPieces,
  SplitSize,
  splitPrice,
  tryPriceBuilder,
} from '../shared/printPricing';
import { PosterThemeId, getDesign } from '../shared/posterDesigns';

interface SplitBuilderPageProps {
  initialPieces?: string;
  onOpenCart: () => void;
}

/** Tiny line drawing of how a set is cut, used on the piece-count buttons. */
const PieceGlyph: React.FC<{ pieces: SplitPieces }> = ({ pieces }) => {
  const tpl = SPLIT_TEMPLATES[pieces];
  return (
    <div className="relative mx-auto" style={{ width: 44, aspectRatio: `${tpl.aspect} / 1` }} aria-hidden>
      {tpl.panels.map((p, i) => (
        <div
          key={i}
          className="absolute bg-current opacity-70 rounded-[1px]"
          style={{ left: `${p.x * 100 + 2}%`, top: `${p.y * 100 + 3}%`, width: `${p.w * 100 - 4}%`, height: `${p.h * 100 - 6}%` }}
        />
      ))}
    </div>
  );
};

export const SplitBuilderPage: React.FC<SplitBuilderPageProps> = ({ initialPieces, onOpenCart }) => {
  const { addItem } = useCart();
  const start = Number(initialPieces);
  const [pieces, setPieces] = useState<SplitPieces>(SPLIT_PIECES.includes(start as SplitPieces) ? (start as SplitPieces) : 4);
  const [size, setSize] = useState<SplitSize>('A4');
  const [mode, setMode] = useState<'design' | 'photo'>('design');
  const [theme, setTheme] = useState<PosterThemeId | 'all'>('all');
  const [designId, setDesignId] = useState<string>('cars-1');
  const [photos, setPhotos] = useState<string[]>([]);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [error, setError] = useState<string | null>(null);

  const photoUrl = photos[0];
  const uploading = !!photoUrl && photoUrl.startsWith('blob:');
  const { price, mrp } = splitPrice(pieces, size, mode === 'photo');
  const tpl = SPLIT_TEMPLATES[pieces];

  const handleAdd = () => {
    setError(null);
    if (mode === 'photo' && !photoUrl) {
      setError('Upload a photo first, or switch to a ready-made design.');
      return;
    }
    const config = {
      kind: 'split' as const,
      pieces,
      size,
      source:
        mode === 'photo'
          ? { type: 'photo' as const, url: photoUrl!, focusX: focus.x, focusY: focus.y }
          : { type: 'design' as const, designId },
    };
    if (!tryPriceBuilder(config)) {
      setError('Your photo has not finished uploading. Wait for it to complete, then try again.');
      return;
    }
    addItem(builderToCartItem(config));
    onOpenCart();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl font-semibold text-slate-900">Split posters</h1>
        <p className="text-sm text-slate-600 max-w-xl">
          One image, printed as {SPLIT_PIECES.join(', ')} panels that hang together as a single piece of art.
        </p>
      </header>

      <section className="space-y-3">
        <StepHeading title="How many panels?" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl" role="radiogroup" aria-label="Number of panels">
          {SPLIT_PIECES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === pieces}
              onClick={() => setPieces(n)}
              className={`rounded-2xl bg-white border p-3 text-center space-y-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                n === pieces ? 'border-rose-500 ring-1 ring-rose-500 text-rose-600 shadow-md' : 'border-stone-200 text-slate-400 hover:shadow-sm'
              }`}
            >
              <PieceGlyph pieces={n} />
              <p className="text-sm font-semibold text-slate-900">{n} piece</p>
              <p className="text-[11px] text-slate-500">{SPLIT_TEMPLATES[n].label}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 lg:sticky lg:top-24 space-y-4" aria-label="Preview">
          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-3 shadow-sm">
            <SplitPreview
              pieces={pieces}
              design={mode === 'design' ? getDesign(designId) : undefined}
              photoUrl={mode === 'photo' ? photoUrl : undefined}
              focusX={focus.x}
              focusY={focus.y}
            />
            <p className="text-xs text-slate-500">
              {tpl.panels.length} panels, {SPLIT_SIZE_LABEL[size]}
              {pieces === 5 ? ' (the centre panel is the chosen size; side panels are one size smaller)' : ''}.
              The gaps shown are how they look when hung with a small space between.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PriceLine price={price} mrp={mrp} />
              <button
                type="button"
                onClick={handleAdd}
                disabled={uploading}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
              >
                <ShoppingBag className="w-4 h-4" /> {uploading ? 'Uploading photo…' : 'Add to cart'}
              </button>
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> {error}
              </p>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 space-y-5 shadow-sm">
          <div className="space-y-2">
            <StepHeading title="Panel size" />
            <div className="flex gap-2 flex-wrap">
              {SPLIT_SIZES.map((s) => (
                <button key={s} type="button" aria-pressed={s === size} onClick={() => setSize(s)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${s === size ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-stone-200 hover:border-slate-400'}`}>
                  {SPLIT_SIZE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <StepHeading title="Artwork" />
            <div className="inline-flex rounded-full bg-stone-100 p-1 text-xs font-semibold" role="tablist">
              {(['design', 'photo'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-full ${mode === m ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                  {m === 'design' ? 'Ready-made designs' : 'Your photo'}
                </button>
              ))}
            </div>

            {mode === 'design' ? (
              <DesignPicker theme={theme} onThemeChange={setTheme} onPick={(d) => setDesignId(d.id)} counts={{ [designId]: 1 }} />
            ) : (
              <div className="space-y-4">
                <PhotoUploader photos={photos} onChange={(p) => setPhotos(p.slice(-1))} minPhotos={1} maxPhotos={1} />
                {photoUrl && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Move the picture behind the panels until the important part is where you want it.</p>
                    {(['x', 'y'] as const).map((axis) => (
                      <label key={axis} className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="w-20">{axis === 'x' ? 'Left to right' : 'Top to bottom'}</span>
                        <input type="range" min={0} max={100} value={focus[axis]}
                          onChange={(e) => setFocus((f) => ({ ...f, [axis]: Number(e.target.value) }))}
                          className="flex-1 accent-rose-600" />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
