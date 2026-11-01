import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  X, 
  SlidersHorizontal, 
  Camera, 
  Film, 
  Heart, 
  Gift, 
  ArrowRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  Award,
  Flame,
  PackageCheck,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Star,
  Check,
  Eye
} from 'lucide-react';
import { Product, CollectionInfo } from '../types';
import { COLLECTIONS, STYLES_LIST } from '../data/defaultProducts';
import { ProductCard } from '../components/ProductCard';
import { useAuth } from '../services/authContext';
import { useCart } from '../services/cartContext';
import { resolveProductImageUrl, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

interface HomePageProps {
  products: Product[];
  collections?: CollectionInfo[];
  onNavigate: (route: string) => void;
  onSelectProduct: (product: Product) => void;
  onQuickView: (product: Product) => void;
  onSelectCollection: (colId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  products,
  collections,
  onNavigate,
  onSelectProduct,
  onQuickView,
  onSelectCollection,
}) => {
  const { isAdmin } = useAuth();
  const { addItem } = useCart();
  const activeCollections = collections && collections.length > 0 ? collections : COLLECTIONS;
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('All Styles');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [showcaseCategory, setShowcaseCategory] = useState<'all' | 'polaroids' | 'posters' | 'bundles'>('all');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  // Filter products based on search, collection, and style
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.isActive !== false);

    // Filter by Collection or Core Section
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

    // Filter by Style
    if (selectedStyle !== 'All Styles') {
      result = result.filter(
        (p) => p.style?.toLowerCase() === selectedStyle.toLowerCase()
      );
    }

    // Filter by Search Query
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

    return result;
  }, [products, selectedCollection, selectedStyle, searchQuery]);

  // Curated showcase products below section directory
  const showcaseProducts = useMemo(() => {
    let pool = products.filter((p) => p.isActive !== false);

    if (showcaseCategory === 'polaroids') {
      pool = pool.filter(
        (p) =>
          p.category === 'polaroids' ||
          p.collectionId === 'polaroids' ||
          p.tags?.some((t) => t.toLowerCase().includes('polaroid')) ||
          p.name.toLowerCase().includes('polaroid')
      );
    } else if (showcaseCategory === 'posters') {
      pool = pool.filter(
        (p) =>
          p.category === 'posters' ||
          p.collectionId === 'posters' ||
          p.tags?.some((t) => t.toLowerCase().includes('poster')) ||
          p.name.toLowerCase().includes('poster')
      );
    } else if (showcaseCategory === 'bundles') {
      pool = pool.filter(
        (p) =>
          p.category === 'bundles' ||
          p.collectionId === 'bundles' ||
          p.tags?.some((t) => t.toLowerCase().includes('bundle') || t.toLowerCase().includes('set')) ||
          p.name.toLowerCase().includes('bundle') ||
          p.name.toLowerCase().includes('set')
      );
    } else {
      // Default: top picks & newest uploaded photo designs
      const customUploads = pool.filter(
        (p) =>
          p.badge?.toLowerCase().includes('new') ||
          p.id.startsWith('prod_17') ||
          (p.id.startsWith('prod_') && !p.id.startsWith('prod-'))
      );
      const featured = pool.filter(
        (p) =>
          p.isFeatured ||
          p.badge?.toLowerCase().includes('bestseller') ||
          p.badge?.toLowerCase().includes('popular') ||
          p.rating >= 4.8
      );
      pool = Array.from(new Set([...customUploads, ...featured, ...pool]));
    }

    return pool.slice(0, 8);
  }, [products, showcaseCategory]);

  const handleInstantAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const imgSrc = resolveProductImageUrl(product);
    addItem({
      productId: product.id,
      product,
      size: product.sizes[0] || 'Standard',
      finish: product.paperFinishes[0] || 'Glossy',
      quantity: 1,
      unitPrice: product.price,
      photos: [imgSrc],
      previewThumbnail: imgSrc,
    });
    setAddedProductId(product.id);
    setTimeout(() => {
      setAddedProductId((curr) => (curr === product.id ? null : curr));
    }, 2000);
  };

  const displayedProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const handleClearFilters = () => {
    setSelectedCollection('all');
    setSelectedStyle('All Styles');
    setSearchQuery('');
    setVisibleCount(10);
  };

  const hasActiveFilters = selectedCollection !== 'all' || selectedStyle !== 'All Styles' || searchQuery.trim() !== '';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-7">
      {/* Search & Discovery Bar (Pinterest Style) */}
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search custom Polaroids, retro photostrips, vintage frames, cute pastel gifts..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(10);
            }}
            className="w-full pl-11 pr-10 py-3 bg-stone-100 hover:bg-stone-200/70 focus:bg-white border border-stone-200 rounded-full text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Section & Collection Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none justify-start sm:justify-center">
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('all');
              setVisibleCount(10);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all ${
              selectedCollection === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            All Ideas
          </button>

          {/* 1. Polaroid Prints */}
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('polaroids');
              setVisibleCount(10);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'polaroids' || selectedCollection === 'polaroid-prints'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Polaroid Prints</span>
          </button>

          {/* 2. Posters */}
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('posters');
              setVisibleCount(10);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'posters'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Posters</span>
          </button>

          {/* 3. Best Sellers */}
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('best-sellers');
              setVisibleCount(10);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'best-sellers'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Best Sellers</span>
          </button>

          {/* 4. New Arrivals */}
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('new-arrivals');
              setVisibleCount(10);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'new-arrivals'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>New Arrivals</span>
          </button>

          {/* 5. Bundles & Sets */}
          <button
            type="button"
            onClick={() => {
              setSelectedCollection('bundles');
              setVisibleCount(10);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              selectedCollection === 'bundles' || selectedCollection === 'bundles-sets'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>Bundles & Sets</span>
          </button>

          {/* Other Collections */}
          {activeCollections
            .filter((c) => !['polaroids', 'posters', 'bundles'].includes(c.id))
            .map((col) => {
              const isSelected = selectedCollection === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    setSelectedCollection(col.id);
                    setVisibleCount(10);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                      : 'bg-white hover:bg-stone-100 text-slate-700 border border-stone-200'
                  }`}
                >
                  {col.name}
                </button>
              );
            })}
        </div>

        {/* Style Chips & Clear Button */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <span className="text-slate-400 font-semibold uppercase tracking-wider pl-1 shrink-0">Style:</span>
            {STYLES_LIST.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setSelectedStyle(st);
                  setVisibleCount(10);
                }}
                className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors ${
                  selectedStyle === st
                    ? 'bg-rose-100 text-rose-800 font-bold'
                    : 'text-slate-600 hover:bg-stone-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-rose-600 hover:underline font-bold text-xs shrink-0 flex items-center gap-1 pl-2"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 7 Core Store Sections Showcase Cards - Mobile Responsive Wrap */}
      {selectedCollection === 'all' && !searchQuery && (
        <section className="pt-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Explore Store Sections
            </span>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Curated photo categories & orders
            </span>
          </div>

          {/* Responsive grid that wraps neatly on mobile (2 cols mobile, 3 cols tablet, 6-7 cols desktop) */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 ${isAdmin ? 'xl:grid-cols-7' : 'lg:grid-cols-6'} gap-2.5 sm:gap-3`}>
            {/* 1. Polaroid Prints */}
            <div
              onClick={() => onNavigate('catalog?cat=polaroids')}
              className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-rose-400 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Camera className="w-5 h-5" />
              </div>
              <div className="mt-2 text-center w-full">
                <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-rose-600 transition-colors truncate">Polaroid Prints</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">All Polaroid designs</p>
              </div>
            </div>

            {/* 2. Posters */}
            <div
              onClick={() => onNavigate('catalog?cat=posters')}
              className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-blue-400 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="mt-2 text-center w-full">
                <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">Posters</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">All poster designs</p>
              </div>
            </div>

            {/* 3. Best Sellers */}
            <div
              onClick={() => onNavigate('catalog?cat=best-sellers')}
              className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-amber-400 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div className="mt-2 text-center w-full">
                <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-amber-600 transition-colors truncate">Best Sellers</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">Most popular products</p>
              </div>
            </div>

            {/* 4. New Arrivals */}
            <div
              onClick={() => onNavigate('catalog?cat=new-arrivals')}
              className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-rose-400 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Flame className="w-5 h-5" />
              </div>
              <div className="mt-2 text-center w-full">
                <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-rose-600 transition-colors truncate">New Arrivals</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">Recently added</p>
              </div>
            </div>

            {/* 5. Bundles & Sets */}
            <div
              onClick={() => onNavigate('catalog?cat=bundles')}
              className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-purple-400 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div className="mt-2 text-center w-full">
                <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-purple-600 transition-colors truncate">Bundles & Sets</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">Product combinations</p>
              </div>
            </div>

            {/* 6. My Orders */}
            <div
              onClick={() => onNavigate('account')}
              className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-slate-400 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-2xl bg-stone-100 text-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div className="mt-2 text-center w-full">
                <p className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-slate-700 transition-colors truncate">My Orders</p>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">Order history & status</p>
              </div>
            </div>

            {/* 7. Admin Dashboard (authorized administrators only) */}
            {isAdmin && (
              <div
                onClick={() => onNavigate('admin')}
                className="group cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-purple-950 text-white border border-purple-800/80 hover:bg-purple-900 hover:shadow-md transition-all text-center flex flex-col items-center justify-center min-h-[105px] sm:min-h-[115px] active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-900/80 text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform border border-purple-700/50 shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="mt-2 text-center w-full">
                  <p className="font-bold text-xs sm:text-sm text-white truncate">Admin Portal</p>
                  <p className="text-[10px] sm:text-[11px] text-purple-200 mt-0.5 line-clamp-1">Uploads & orders</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Shopping Experience: Visible Product Cards with Prices, Images & Add to Cart Actions */}
      {selectedCollection === 'all' && !searchQuery && (
        <section className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200/90 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-extrabold text-[10px] uppercase tracking-wider mb-1.5 border border-rose-200/60">
                <Sparkles className="w-3 h-3 text-rose-500" />
                <span>Featured Prints & Instant Cart</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-['Playfair_Display',serif] tracking-tight">
                Top Rated Photo Prints & Bestsellers
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Printed on 300 GSM Fuji Crystal Archive paper. Add to cart immediately or personalize with your custom photos.
              </p>
            </div>

            {/* Filter categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setShowcaseCategory('all')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                  showcaseCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
              >
                Top Picks
              </button>
              <button
                type="button"
                onClick={() => setShowcaseCategory('polaroids')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                  showcaseCategory === 'polaroids'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
              >
                Polaroid Prints
              </button>
              <button
                type="button"
                onClick={() => setShowcaseCategory('posters')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                  showcaseCategory === 'posters'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
              >
                Posters
              </button>
              <button
                type="button"
                onClick={() => setShowcaseCategory('bundles')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                  showcaseCategory === 'bundles'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
              >
                Bundles & Sets
              </button>
            </div>
          </div>

          {/* Product Cards Grid with Prices and Add to Cart */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {showcaseProducts.map((product) => {
              const originalMrp = Math.round(product.price * 1.38);
              const savings = originalMrp - product.price;
              const isAdded = addedProductId === product.id;

              return (
                <div
                  key={`showcase-${product.id}`}
                  onClick={() => onQuickView(product)}
                  className="group bg-[#faf9f7] hover:bg-white rounded-2xl border border-stone-200/80 hover:border-rose-300 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
                >
                  {/* Photo Thumbnail */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                    <img
                      src={resolveProductImageUrl(product)}
                      alt={product.name}
                      loading="lazy"
                      onError={(e) => {
                        console.warn(`[HomePage] Showcase image failed to load for "${product.name}" (ID: ${product.id}). Falling back to placeholder.`);
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                      }}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 pointer-events-none">
                      <span className="bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-extrabold text-rose-700 shadow-xs border border-rose-100/60 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-rose-500" />
                        {product.badge || 'Popular'}
                      </span>
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        Save ₹{savings}
                      </span>
                    </div>

                    {/* Hover quick details action */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="px-3 py-1.5 bg-white/95 text-slate-800 text-xs font-bold rounded-full shadow-md flex items-center gap-1 backdrop-blur-xs">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Quick View</span>
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Rating & Review */}
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 mb-1">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <span className="font-bold text-slate-700 ml-1">{product.rating.toFixed(1)}</span>
                        <span className="text-slate-400 text-[10px]">({product.reviewCount})</span>
                      </div>

                      {/* Product Title */}
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 group-hover:text-rose-600 transition-colors">
                        {product.name}
                      </h3>

                      {/* Tags/Category */}
                      <p className="text-[11px] text-slate-400 capitalize mt-0.5 line-clamp-1">
                        {product.sizes[0] || 'Standard Size'} • {product.paperFinishes[0] || 'Glossy Finish'}
                      </p>
                    </div>

                    {/* Price and Cart Actions */}
                    <div className="pt-2 border-t border-stone-200/60 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base sm:text-lg font-black text-slate-900">
                              ₹{product.price}
                            </span>
                            <span className="text-xs text-slate-400 line-through">
                              ₹{originalMrp}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-600 font-bold block -mt-0.5">
                            Inclusive of all taxes
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                          28% OFF
                        </span>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={(e) => handleInstantAddToCart(product, e)}
                          className={`w-full py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 ${
                            isAdded
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Add to Cart</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(product);
                          }}
                          className="w-full py-2 px-2 rounded-xl text-[11px] font-bold bg-white hover:bg-stone-100 text-slate-800 border border-stone-200 shadow-2xs flex items-center justify-center gap-1 transition-colors active:scale-95"
                        >
                          <Camera className="w-3.5 h-3.5 text-rose-500" />
                          <span>Customize</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => onNavigate('catalog')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-slate-800 text-xs font-bold transition-all"
            >
              <span>Browse Full Collection in Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Featured Collections Carousel Cards (Pinterest Visual Jumpers) */}
      {selectedCollection === 'all' && !searchQuery && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Explore Collections
            </span>
            <button
              onClick={() => onNavigate('collections')}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>View All Collections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {COLLECTIONS.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCollection(c.id)}
                className="group cursor-pointer relative rounded-2xl overflow-hidden aspect-[4/3] bg-stone-100 border border-stone-200/80 shadow-xs hover:shadow-md transition-all"
              >
                <img
                  src={c.coverImage}
                  alt={c.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                  <p className="font-bold text-xs line-clamp-1 drop-shadow-sm">{c.name}</p>
                  <p className="text-[10px] text-white/80">{c.designCount || 5} designs</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Pinterest Responsive Masonry Grid */}
      <section className="pt-2">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4 px-1">
          <p>
            Showing <strong className="text-slate-900">{displayedProducts.length}</strong> of{' '}
            <strong className="text-slate-900">{filteredProducts.length}</strong> photo designs
          </p>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fuji Archival 300 GSM</span>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-stone-200 space-y-4 max-w-md mx-auto my-8">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">No photo designs matched your search</h3>
            <p className="text-xs text-slate-500">
              Try adjusting your search terms or clearing your filters to explore all items.
            </p>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Multi-column Pinterest Masonry (2 columns mobile, 3 tablet, 4-5 desktop) */
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
                onQuickView={onQuickView}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="text-center pt-8 pb-4">
            <button
              type="button"
              onClick={handleLoadMore}
              className="px-8 py-3.5 bg-white hover:bg-stone-50 border border-stone-300 rounded-full font-bold text-xs text-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <span>Load More Designs</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
