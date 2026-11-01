import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  X, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Filter, 
  RotateCcw,
  Check,
  Camera,
  Image as ImageIcon,
  Flame,
  PackageCheck,
  Award,
  Layers
} from 'lucide-react';
import { Product, CollectionInfo } from '../types';
import { COLLECTIONS, STYLES_LIST, OCCASIONS_LIST } from '../data/defaultProducts';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/ProductCardSkeleton';

export const SECTION_METADATA: Record<string, { title: string; subtitle: string; badge: string; icon: string }> = {
  'polaroids': {
    title: 'Polaroid Prints',
    subtitle: 'All your available Polaroid designs with authentic retro white borders, mini magnets, and custom captions.',
    badge: 'Classic Keepsakes',
    icon: 'camera'
  },
  'polaroid-prints': {
    title: 'Polaroid Prints',
    subtitle: 'All your available Polaroid designs with authentic retro white borders, mini magnets, and custom captions.',
    badge: 'Classic Keepsakes',
    icon: 'camera'
  },
  'posters': {
    title: 'Posters',
    subtitle: 'All your available poster designs. Museum-grade matte wall prints, scannable song art, and photo collages.',
    badge: 'Large Format Prints',
    icon: 'image'
  },
  'best-sellers': {
    title: 'Best Sellers',
    subtitle: 'Your most popular products. Loved by thousands of customers with 4.8+ star ratings and premium unboxings.',
    badge: 'Community Favorites',
    icon: 'award'
  },
  'new-arrivals': {
    title: 'New Arrivals',
    subtitle: 'Recently added designs. Fresh aesthetic styles, holographic overlays, and trending photo keepsakes.',
    badge: 'Fresh & Trending',
    icon: 'flame'
  },
  'bundles': {
    title: 'Bundles & Sets',
    subtitle: 'Product combinations you offer. Complete room aesthetic kits, album bundles, and matching gift sets.',
    badge: 'Value Combinations',
    icon: 'package'
  },
  'bundles-sets': {
    title: 'Bundles & Sets',
    subtitle: 'Product combinations you offer. Complete room aesthetic kits, album bundles, and matching gift sets.',
    badge: 'Value Combinations',
    icon: 'package'
  },
};

interface CatalogPageProps {
  products: Product[];
  collections?: CollectionInfo[];
  initialCategory?: string;
  initialSearch?: string;
  isLoading?: boolean;
  onSelectProduct: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  products,
  collections,
  initialCategory = 'all',
  initialSearch = '',
  isLoading = false,
  onSelectProduct,
  onQuickView,
}) => {
  const activeCollections = collections && collections.length > 0 ? collections : COLLECTIONS;
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedCollection, setSelectedCollection] = useState<string>(initialCategory);
  const [selectedStyle, setSelectedStyle] = useState<string>('All Styles');
  const [selectedOccasion, setSelectedOccasion] = useState<string>('All Occasions');
  const [priceRange, setPriceRange] = useState<string>('all'); // 'all', 'under-300', '300-500', '500-800', 'above-800'
  const [onlyFeatured, setOnlyFeatured] = useState<boolean>(false);
  const [onlyNew, setOnlyNew] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(12);

  // Sync initialCategory
  React.useEffect(() => {
    if (initialCategory) {
      setSelectedCollection(initialCategory);
      setVisibleCount(12);
    }
  }, [initialCategory]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.isActive !== false);

    // Search Query (names, collections, tags, descriptions)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.collectionId && p.collectionId.toLowerCase().includes(q)) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)) ||
          p.style?.toLowerCase().includes(q) ||
          p.occasion?.toLowerCase().includes(q)
      );
    }

    // Section / Collection filter
    if (selectedCollection !== 'all') {
      if (selectedCollection === 'polaroids' || selectedCollection === 'polaroid-prints') {
        result = result.filter(
          (p) =>
            p.category === 'polaroids' ||
            p.collectionId === 'polaroids' ||
            p.tags?.some((t) => t.toLowerCase().includes('polaroid')) ||
            p.name.toLowerCase().includes('polaroid')
        );
      } else if (selectedCollection === 'posters') {
        result = result.filter(
          (p) =>
            p.category === 'posters' ||
            p.collectionId === 'posters' ||
            p.tags?.some((t) => t.toLowerCase().includes('poster')) ||
            p.name.toLowerCase().includes('poster')
        );
      } else if (selectedCollection === 'best-sellers') {
        result = result.filter(
          (p) =>
            p.isFeatured ||
            p.badge?.toLowerCase().includes('bestseller') ||
            p.badge?.toLowerCase().includes('popular') ||
            p.badge?.toLowerCase().includes('top gift') ||
            (p.rating >= 4.8 && p.reviewCount >= 180)
        );
      } else if (selectedCollection === 'new-arrivals') {
        result = result.filter(
          (p) =>
            p.badge?.toLowerCase().includes('new') ||
            p.badge?.toLowerCase().includes('trending') ||
            p.badge?.toLowerCase().includes('viral') ||
            p.tags?.some((t) => t.toLowerCase().includes('new') || t.toLowerCase().includes('viral'))
        );
      } else if (selectedCollection === 'bundles' || selectedCollection === 'bundles-sets') {
        result = result.filter(
          (p) =>
            p.category === 'bundles' ||
            p.collectionId === 'bundles' ||
            p.tags?.some((t) => t.toLowerCase().includes('bundle') || t.toLowerCase().includes('set') || t.toLowerCase().includes('kit')) ||
            p.name.toLowerCase().includes('bundle') ||
            p.name.toLowerCase().includes('kit') ||
            p.name.toLowerCase().includes('pack') ||
            p.name.toLowerCase().includes('set')
        );
      } else {
        result = result.filter(
          (p) => p.collectionId === selectedCollection || p.category === selectedCollection
        );
      }
    }

    // Style filter
    if (selectedStyle !== 'All Styles') {
      result = result.filter(
        (p) => p.style?.toLowerCase() === selectedStyle.toLowerCase()
      );
    }

    // Occasion filter
    if (selectedOccasion !== 'All Occasions') {
      result = result.filter(
        (p) => p.occasion?.toLowerCase() === selectedOccasion.toLowerCase()
      );
    }

    // Price range
    if (priceRange === 'under-300') {
      result = result.filter((p) => p.price < 300);
    } else if (priceRange === '300-500') {
      result = result.filter((p) => p.price >= 300 && p.price <= 500);
    } else if (priceRange === '500-800') {
      result = result.filter((p) => p.price > 500 && p.price <= 800);
    } else if (priceRange === 'above-800') {
      result = result.filter((p) => p.price > 800);
    }

    // New / Popular fast toggles
    if (onlyFeatured) {
      result = result.filter(
        (p) => p.isFeatured || p.badge?.toLowerCase().includes('bestseller') || p.badge?.toLowerCase().includes('popular')
      );
    }

    if (onlyNew) {
      result = result.filter(
        (p) => p.badge?.toLowerCase().includes('new') || p.badge?.toLowerCase().includes('trending')
      );
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      default:
        // Featured
        break;
    }

    return result;
  }, [
    products,
    searchQuery,
    selectedCollection,
    selectedStyle,
    selectedOccasion,
    priceRange,
    onlyFeatured,
    onlyNew,
    sortBy,
  ]);

  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedCollection('all');
    setSelectedStyle('All Styles');
    setSelectedOccasion('All Occasions');
    setPriceRange('all');
    setOnlyFeatured(false);
    setOnlyNew(false);
    setSortBy('featured');
    setVisibleCount(12);
  };

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedCollection !== 'all' ||
    selectedStyle !== 'All Styles' ||
    selectedOccasion !== 'All Occasions' ||
    priceRange !== 'all' ||
    onlyFeatured ||
    onlyNew;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="font-['Playfair_Display',serif] text-2xl sm:text-3xl font-black text-slate-900">
            Search & Discovery Gallery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse through our full visual library of photo prints, custom frames, and keepsake gifts.
          </p>
        </div>

        {/* Global Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search keywords, tags, titles..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(12);
            }}
            className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setVisibleCount(12);
              }}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Featured Section Highlight Banner */}
      {SECTION_METADATA[selectedCollection] && (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-7 rounded-3xl shadow-sm border border-rose-900/30 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-semibold backdrop-blur-xs">
                {SECTION_METADATA[selectedCollection].icon === 'camera' && <Camera className="w-3.5 h-3.5 text-rose-300" />}
                {SECTION_METADATA[selectedCollection].icon === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-300" />}
                {SECTION_METADATA[selectedCollection].icon === 'award' && <Award className="w-3.5 h-3.5 text-amber-300" />}
                {SECTION_METADATA[selectedCollection].icon === 'flame' && <Flame className="w-3.5 h-3.5 text-rose-400" />}
                {SECTION_METADATA[selectedCollection].icon === 'package' && <PackageCheck className="w-3.5 h-3.5 text-purple-300" />}
                <span>{SECTION_METADATA[selectedCollection].badge}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Playfair_Display',serif] tracking-tight">
                {SECTION_METADATA[selectedCollection].title}
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {SECTION_METADATA[selectedCollection].subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-white/10 text-white font-bold text-xs border border-white/10">
                {filteredProducts.length} Designs Available
              </span>
              <button
                onClick={() => {
                  setSelectedCollection('all');
                  setVisibleCount(12);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>View All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200/90 shadow-xs space-y-4">
        {/* Top row: Section & Collection Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('all');
              setVisibleCount(12);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
              selectedCollection === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            All Designs
          </button>

          {/* Primary Featured Sections from prompt */}
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('polaroids');
              setVisibleCount(12);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'polaroids' || selectedCollection === 'polaroid-prints'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>Polaroid Prints</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCollection('posters');
              setVisibleCount(12);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'posters'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-blue-500" />
            <span>Posters</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCollection('best-sellers');
              setVisibleCount(12);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'best-sellers'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <Award className="w-3 h-3 text-amber-500" />
            <span>Best Sellers</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCollection('new-arrivals');
              setVisibleCount(12);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'new-arrivals'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-500" />
            <span>New Arrivals</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCollection('bundles');
              setVisibleCount(12);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'bundles' || selectedCollection === 'bundles-sets'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <PackageCheck className="w-3 h-3 text-purple-500" />
            <span>Bundles & Sets</span>
          </button>

          {/* Other Collections */}
          {activeCollections
            .filter((c) => !['polaroids', 'posters', 'bundles'].includes(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCollection(c.id);
                  setVisibleCount(12);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                  selectedCollection === c.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-slate-700 border border-stone-200'
                }`}
              >
                {c.name}
              </button>
            ))}
        </div>

        {/* Dropdowns Row: Style, Occasion, Price, Badges, Sort */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
          {/* Style */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Style
            </label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400"
            >
              {STYLES_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Occasion */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Occasion
            </label>
            <select
              value={selectedOccasion}
              onChange={(e) => setSelectedOccasion(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400"
            >
              {OCCASIONS_LIST.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Price Range
            </label>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400"
            >
              <option value="all">All Prices</option>
              <option value="under-300">Under ₹300</option>
              <option value="300-500">₹300 - ₹500</option>
              <option value="500-800">₹500 - ₹800</option>
              <option value="above-800">Above ₹800</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          {/* Fast Toggle Filters */}
          <div className="col-span-2 sm:col-span-1 md:col-span-2 flex items-end gap-2 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => setOnlyFeatured(!onlyFeatured)}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                onlyFeatured
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-stone-50 text-slate-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <span>Popular</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyNew(!onlyNew)}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                onlyNew
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-stone-50 text-slate-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <span>New</span>
            </button>

            {isFiltered && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-xs flex items-center gap-1 shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Found <strong>{filteredProducts.length}</strong> photo products</span>
        {isFiltered && (
          <span className="text-[11px] text-rose-600 font-semibold">
            Filtered view
          </span>
        )}
      </div>

      {/* Masonry Grid with Pagination */}
      {isLoading ? (
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-stone-200 space-y-4 max-w-md mx-auto">
          <p className="text-sm font-bold text-slate-800">No matching photo designs found</p>
          <p className="text-xs text-slate-500">Try broadening your search or resetting active filters.</p>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4">
            {filteredProducts.slice(0, visibleCount).map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onSelect={onSelectProduct}
                onQuickView={onQuickView}
              />
            ))}
          </div>

          {/* Pagination / Load More Controls */}
          {visibleCount < filteredProducts.length && (
            <div className="pt-8 pb-4 text-center space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                Showing <strong>{Math.min(visibleCount, filteredProducts.length)}</strong> of <strong>{filteredProducts.length}</strong> photo designs
              </p>
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 12)}
                className="px-8 py-3 bg-white hover:bg-rose-50 border-2 border-stone-200 hover:border-rose-400 text-slate-800 hover:text-rose-600 rounded-full font-bold text-xs shadow-xs transition-all hover:scale-105 active:scale-95"
              >
                Load More Designs ({filteredProducts.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
