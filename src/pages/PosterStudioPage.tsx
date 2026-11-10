import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  ShoppingBag, 
  Shuffle, 
  Eraser, 
  AlertCircle, 
  Palette, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  Grid, 
  Layers, 
  Maximize2,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  WallLayoutManager, 
  WallLayoutConfig, 
  WallSlot, 
  CalculatedSlotBounds,
  DEFAULT_WALL_PADDING_CM 
} from '../utils/WallLayoutManager';
import { SlotFill } from '../shared/printPricing';
import { POSTER_DESIGNS, PosterDesign, PosterThemeId, POSTER_THEMES, designsByTheme, getDesign } from '../shared/posterDesigns';
import { PosterArt } from '../components/PosterArt';
import { PhotoUploader } from '../components/PhotoUploader';
import { PriceLine, StepHeading, rupees } from '../components/BuilderBits';
import { useCart } from '../services/cartContext';
import { builderToCartItem } from '../services/builderCart';

interface PosterStudioPageProps {
  initialLayoutId?: string;
  onOpenCart: () => void;
  onNavigateCatalog?: () => void;
}

const WALL_THEMES = [
  { id: 'cream', name: 'Warm Cream', bg: 'linear-gradient(180deg, #f7f3ec 0%, #ece5d8 100%)', textDark: true },
  { id: 'studio', name: 'Studio White', bg: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)', textDark: true },
  { id: 'charcoal', name: 'Deep Charcoal', bg: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', textDark: false },
  { id: 'sage', name: 'Sage Linen', bg: 'linear-gradient(180deg, #e7edea 0%, #d5e0dc 100%)', textDark: true },
  { id: 'terracotta', name: 'Terracotta', bg: 'linear-gradient(180deg, #fceee9 0%, #f3dbd3 100%)', textDark: true },
];

export const PosterStudioPage: React.FC<PosterStudioPageProps> = ({
  initialLayoutId,
  onOpenCart,
}) => {
  const { addItem } = useCart();
  const availableLayouts = useMemo(() => WallLayoutManager.getAllLayouts(), []);
  
  // Selected layout state
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>(() => {
    const found = availableLayouts.find((l) => l.id === initialLayoutId);
    return found ? found.id : availableLayouts[0].id;
  });

  const activeLayout: WallLayoutConfig = useMemo(
    () => WallLayoutManager.getLayout(selectedLayoutId),
    [selectedLayoutId]
  );

  // Slots state
  const [fills, setFills] = useState<Record<number, SlotFill | null>>({});
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [wallTheme, setWallTheme] = useState(WALL_THEMES[0]);
  const [showFrames, setShowFrames] = useState(true);
  const [activeTab, setActiveTab] = useState<'curated' | 'upload'>('curated');
  const [selectedPosterTheme, setSelectedPosterTheme] = useState<PosterThemeId | 'all'>('all');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Dynamic container sizing via ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute dynamic slot positions using WallLayoutManager
  const dynamicMetrics = useMemo(() => {
    return WallLayoutManager.calculateDynamicDimensions(activeLayout, containerWidth);
  }, [activeLayout, containerWidth]);

  // Derived counts
  const filledCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < activeLayout.posterCount; i++) {
      if (fills[i]) count++;
    }
    return count;
  }, [fills, activeLayout.posterCount]);

  const remainingCount = activeLayout.posterCount - filledCount;

  // Filtered poster catalog
  const filteredPosters = useMemo(() => {
    let pool = selectedPosterTheme === 'all' 
      ? POSTER_DESIGNS 
      : designsByTheme(selectedPosterTheme);
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      pool = pool.filter((p) => p.title.toLowerCase().includes(q) || p.theme.toLowerCase().includes(q));
    }
    return pool;
  }, [selectedPosterTheme, searchFilter]);

  // Handle switching layouts: preserve matching slot fills
  const handleSelectLayout = (layoutId: string) => {
    setSelectedLayoutId(layoutId);
    setSelectedSlotIndex(0);
    setError(null);
  };

  // Assign poster or photo to currently active slot
  const assignSlotFill = (fill: SlotFill) => {
    setError(null);
    setFills((prev) => ({
      ...prev,
      [selectedSlotIndex]: fill,
    }));

    // Auto-advance to next empty slot
    let nextIdx = (selectedSlotIndex + 1) % activeLayout.posterCount;
    for (let i = 0; i < activeLayout.posterCount; i++) {
      const checkIdx = (selectedSlotIndex + 1 + i) % activeLayout.posterCount;
      if (!fills[checkIdx]) {
        nextIdx = checkIdx;
        break;
      }
    }
    setSelectedSlotIndex(nextIdx);
  };

  // Auto-fill all empty slots with smart curated posters
  const handleAutoFill = () => {
    setError(null);
    const pool = selectedPosterTheme === 'all' 
      ? POSTER_DESIGNS 
      : designsByTheme(selectedPosterTheme);
    
    // Shuffle pool
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const updated = { ...fills };
    let poolIndex = 0;

    for (let i = 0; i < activeLayout.posterCount; i++) {
      if (!updated[i]) {
        const item = shuffledPool[poolIndex % shuffledPool.length];
        updated[i] = { type: 'design', designId: item.id };
        poolIndex++;
      }
    }
    setFills(updated);
  };

  // Clear all filled slots
  const handleClearAll = () => {
    setFills({});
    setSelectedSlotIndex(0);
    setError(null);
  };

  // Add customized wall collage to cart
  const handleAddToCart = () => {
    if (remainingCount > 0) {
      setError(`Please fill all ${activeLayout.posterCount} posters before adding to cart (${remainingCount} remaining). Or tap "Auto-Curate Wall" to complete instantly!`);
      return;
    }

    const slotFillsArray: Array<SlotFill | null> = [];
    for (let i = 0; i < activeLayout.posterCount; i++) {
      slotFillsArray.push(fills[i] ?? null);
    }

    const item = builderToCartItem({
      kind: 'wall',
      layoutId: activeLayout.id,
      slots: slotFillsArray,
    });

    addItem(item);
    onOpenCart();
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {/* Studio Banner */}
      <div className="bg-stone-900 text-stone-100 border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold tracking-wider uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Custom Poster Studio</span>
              </div>
              <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                Build Your Own Wall Collage
              </h1>
              <p className="mt-2 text-stone-300 text-sm sm:text-base max-w-2xl">
                Choose a gallery template, personalize each slot with curated aesthetic posters or your own photos, and preview real-world dimensions to scale.
              </p>
            </div>

            {/* Layout Quick Stats */}
            <div className="bg-stone-800/80 backdrop-blur-xs border border-stone-700/80 rounded-2xl p-4 sm:p-5 flex items-center gap-6 shrink-0">
              <div>
                <p className="text-xs uppercase tracking-wider text-stone-400 font-medium">Selected Layout</p>
                <p className="text-lg font-bold text-white mt-0.5">{activeLayout.name}</p>
                <p className="text-xs text-rose-400 font-semibold">{activeLayout.wallSizeDisplay} wall</p>
              </div>
              <div className="h-10 w-px bg-stone-700" />
              <div>
                <p className="text-xs uppercase tracking-wider text-stone-400 font-medium">Price</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-rose-400 font-['Playfair_Display',serif]">
                    {rupees(activeLayout.price)}
                  </span>
                  <span className="text-xs text-stone-400 line-through">
                    {rupees(activeLayout.mrp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step 1: Layout Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Grid className="w-5 h-5 text-rose-600" />
              <span>1. Choose Gallery Layout Configuration</span>
            </h2>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Powered by WallLayoutManager
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {availableLayouts.map((l) => {
              const isSelected = l.id === activeLayout.id;
              return (
                <button
                  key={l.id}
                  onClick={() => handleSelectLayout(l.id)}
                  type="button"
                  className={`relative p-3.5 rounded-2xl text-left transition-all border ${
                    isSelected
                      ? 'border-rose-600 bg-white ring-2 ring-rose-500 shadow-md'
                      : 'border-stone-200 bg-white/70 hover:bg-white hover:border-stone-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-rose-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  <p className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{l.name}</p>
                  <p className="text-[11px] text-rose-600 font-semibold mt-0.5">{l.posterCount} Posters</p>
                  <p className="text-[10px] text-slate-500 mt-1">{l.wallSizeDisplay}</p>
                  <p className="text-xs font-bold text-slate-900 mt-2">{rupees(l.price)}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Wall Preview & Slot Customizer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Wall Canvas (Left 7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StepHeading title="2. Live Wall Canvas & Interactive Slots" />
              </div>

              {/* Wall Controls */}
              <div className="flex items-center gap-3">
                {/* Theme Selector */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
                  {WALL_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setWallTheme(theme)}
                      type="button"
                      title={theme.name}
                      className={`w-5 h-5 rounded-lg border transition-transform ${
                        wallTheme.id === theme.id ? 'scale-110 ring-2 ring-rose-500' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ background: theme.bg }}
                    />
                  ))}
                </div>

                {/* Frames Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFrames(!showFrames)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                    showFrames 
                      ? 'bg-rose-50 border-rose-200 text-rose-700' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {showFrames ? 'Frames ON' : 'Flush Edge'}
                </button>
              </div>
            </div>

            {/* Scaled Wall Container */}
            <div 
              ref={containerRef}
              className="relative w-full rounded-3xl overflow-hidden shadow-lg border border-stone-300/80 transition-all"
              style={{
                aspectRatio: `${dynamicMetrics.totalWidthCm} / ${dynamicMetrics.totalHeightCm}`,
                background: wallTheme.bg,
              }}
            >
              {/* Dynamic Slots Rendered from WallLayoutManager */}
              {dynamicMetrics.slots.map((bound: CalculatedSlotBounds) => {
                const s = bound.slot;
                const fill = fills[s.index];
                const isSelected = selectedSlotIndex === s.index;
                const design = fill?.type === 'design' ? getDesign(fill.designId) : undefined;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSlotIndex(s.index)}
                    aria-label={`Slot ${s.index + 1}: ${s.size} ${s.orientation}`}
                    style={WallLayoutManager.getSlotCss(bound)}
                    className={`group absolute transition-all duration-200 focus:outline-hidden ${
                      showFrames 
                        ? 'p-[2px] sm:p-1 bg-white shadow-md rounded-xs sm:rounded-sm' 
                        : 'shadow-sm'
                    } ${
                      isSelected 
                        ? 'ring-3 ring-rose-500 z-20 scale-[1.04]' 
                        : 'hover:scale-[1.02] hover:z-10'
                    }`}
                  >
                    <div className="relative w-full h-full overflow-hidden bg-stone-100 flex items-center justify-center">
                      {fill ? (
                        fill.type === 'photo' ? (
                          <img 
                            src={fill.url} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            draggable={false} 
                          />
                        ) : design ? (
                          <PosterArt design={design} showTitle={false} className="w-full h-full block" />
                        ) : null
                      ) : (
                        <div className="w-full h-full border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-1 text-center bg-white/60">
                          <span className="text-[10px] sm:text-xs font-bold text-stone-500">
                            #{s.index + 1}
                          </span>
                          <span className="text-[8px] sm:text-[10px] font-medium text-stone-400">
                            {s.size}
                          </span>
                        </div>
                      )}

                      {/* Hover Slot Badge */}
                      <div className={`absolute inset-0 bg-rose-600/20 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isSelected ? 'opacity-100 ring-2 ring-rose-500' : ''}`}>
                        <span className="text-[9px] sm:text-xs font-extrabold text-white bg-slate-900/80 px-1.5 py-0.5 rounded-md">
                          Slot #{s.index + 1}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Slot Information Bar */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center text-sm">
                  #{selectedSlotIndex + 1}
                </div>
                <div>
                  <p className="text-xs text-stone-500 font-medium">Currently Editing</p>
                  <p className="text-sm font-bold text-slate-900">
                    Slot {selectedSlotIndex + 1} • {activeLayout.slots[selectedSlotIndex]?.size} ({activeLayout.slots[selectedSlotIndex]?.widthCm} × {activeLayout.slots[selectedSlotIndex]?.heightCm} cm)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {fills[selectedSlotIndex] && (
                  <button
                    type="button"
                    onClick={() => {
                      setFills((prev) => {
                        const copy = { ...prev };
                        delete copy[selectedSlotIndex];
                        return copy;
                      });
                    }}
                    className="text-xs text-stone-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-rose-300 font-medium transition-colors"
                  >
                    Clear Slot
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Auto-Curate All</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Poster & Photo Selection Panel (Right 5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs">
              {/* Tab Selector */}
              <div className="flex border-b border-stone-200 mb-5">
                <button
                  type="button"
                  onClick={() => setActiveTab('curated')}
                  className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'curated'
                      ? 'border-rose-600 text-rose-600'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Aesthetic Posters</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'upload'
                      ? 'border-rose-600 text-rose-600'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Your Photos</span>
                </button>
              </div>

              {/* Curated Aesthetic Posters Tab */}
              {activeTab === 'curated' && (
                <div className="space-y-4">
                  {/* Theme Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPosterTheme('all')}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        selectedPosterTheme === 'all'
                          ? 'bg-rose-600 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      All Themes
                    </button>
                    {POSTER_THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedPosterTheme(t.id)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                          selectedPosterTheme === t.id
                            ? 'bg-rose-600 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Filter */}
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search artwork (e.g. Porsche, Anime, Retro)..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />

                  {/* Poster Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {filteredPosters.map((poster) => (
                      <button
                        key={poster.id}
                        type="button"
                        onClick={() => assignSlotFill({ type: 'design', designId: poster.id })}
                        className="group relative rounded-xl overflow-hidden aspect-[1/1.4] bg-stone-100 border border-stone-200 hover:border-rose-400 hover:shadow-md transition-all text-left focus:outline-hidden"
                      >
                        <PosterArt design={poster} showTitle={false} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                          <p className="text-[10px] font-bold text-white line-clamp-1">{poster.title}</p>
                          <span className="text-[9px] text-rose-300 font-semibold mt-0.5">Click to place</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal Photo Upload Tab */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <p className="text-xs text-stone-600">
                    Upload your own camera memories, travel photos, or custom art. Uploaded images are automatically preserved for high-res printing.
                  </p>
                  <PhotoUploader
                    photos={uploadedPhotos}
                    onChange={(newUrls: string[]) => {
                      setUploadedPhotos(newUrls);
                      if (newUrls.length > 0) {
                        const latest = newUrls[newUrls.length - 1];
                        if (latest && !latest.startsWith('blob:')) {
                          assignSlotFill({ type: 'photo', url: latest });
                        }
                      }
                    }}
                    minPhotos={0}
                    maxPhotos={activeLayout.posterCount}
                  />

                  {uploadedPhotos.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-stone-100">
                      <p className="text-xs font-semibold text-stone-700">Tap to place in Slot #{selectedSlotIndex + 1}:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {uploadedPhotos.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => assignSlotFill({ type: 'photo', url })}
                            className="relative aspect-[3/4] rounded-lg overflow-hidden border border-stone-200 hover:ring-2 hover:ring-rose-500 focus:outline-hidden"
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Order Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] py-3 sm:py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <p className="text-xs text-stone-500 font-medium">
                {activeLayout.name} • {activeLayout.posterCount} Posters
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-rose-600 font-['Playfair_Display',serif]">
                  {rupees(activeLayout.price)}
                </span>
                <span className="text-xs text-stone-400 line-through">
                  {rupees(activeLayout.mrp)}
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Free Delivery
                </span>
              </div>
            </div>

            <div className="text-right sm:text-left">
              <p className="text-xs font-bold text-slate-800">
                {filledCount} of {activeLayout.posterCount} slots filled
              </p>
              <div className="w-28 sm:w-36 h-2 bg-stone-200 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className="h-full bg-rose-600 transition-all duration-300" 
                  style={{ width: `${(filledCount / activeLayout.posterCount) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAutoFill}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Shuffle className="w-4 h-4 text-rose-600" />
              <span>Auto-Fill</span>
            </button>

            <button
              type="button"
              onClick={handleAddToCart}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add Wall to Cart • {rupees(activeLayout.price)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
