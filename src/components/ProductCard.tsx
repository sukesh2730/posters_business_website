import React, { useState, useEffect } from 'react';
import { Sparkles, Heart, Eye, ArrowRight, Camera, ShoppingBag, Check } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../services/cartContext';
import { resolveProductImageUrl, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onQuickView,
}) => {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const resolvedSrc = resolveProductImageUrl(product);
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(resolvedSrc);

  useEffect(() => {
    setCurrentImageSrc(resolveProductImageUrl(product));
  }, [product.imageUrl, (product as any).image, product.id]);

  const handleImageError = () => {
    console.warn(`[ProductCard] Image failed to load for "${product.name}" (ID: ${product.id}). Attempted URL: "${currentImageSrc}". Falling back to default placeholder.`);
    setCurrentImageSrc(DEFAULT_FALLBACK_PRODUCT_IMAGE);
  };

  // Determine aspect ratio class for Pinterest masonry feel
  const getAspectClass = () => {
    switch (product.aspectRatio) {
      case 'tall':
        return 'aspect-[2/3] sm:aspect-[9/16]'; // tall photobooth or bookmark
      case 'square':
        return 'aspect-square'; // classic polaroid or mug
      case 'wide':
        return 'aspect-[4/3]'; // landscape canvas or framed memory
      case 'portrait':
      default:
        return 'aspect-[3/4]'; // standard photo print
    }
  };

  const originalMrp = Math.round(product.price * 1.38);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      productId: product.id,
      product,
      size: product.sizes[0] || 'Standard',
      finish: product.paperFinishes[0] || 'Glossy',
      quantity: 1,
      unitPrice: product.price,
      photos: [currentImageSrc],
      previewThumbnail: currentImageSrc,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div 
      className="group break-inside-avoid mb-4 sm:mb-6 cursor-pointer select-none transition-all duration-300"
      onClick={() => onQuickView(product)}
    >
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-stone-100 shadow-xs hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-stone-200/70">
        {/* Prominent Image */}
        <div className={`w-full overflow-hidden ${getAspectClass()} relative`}>
          <img
            src={currentImageSrc}
            alt={product.name}
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />

          {/* Dark gradient on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Top Badges */}
          <div className="absolute top-2.5 sm:top-3 inset-x-2.5 sm:inset-x-3 flex items-center justify-between gap-1.5 pointer-events-none">
            {product.badge ? (
              <span className="bg-white/95 backdrop-blur-md px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold text-rose-700 shadow-sm border border-rose-100/60 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500" />
                {product.badge}
              </span>
            ) : <span />}

            {/* Quick Action Button (Pinterest red style) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(product);
              }}
              className="pointer-events-auto bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 flex items-center gap-1"
            >
              <span>Customize</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Always Visible Price Badge on mobile, floating on desktop */}
          <div className="absolute bottom-2.5 sm:bottom-3 inset-x-2.5 sm:inset-x-3 flex items-center justify-between">
            <span className="bg-white/95 backdrop-blur-md text-slate-900 font-extrabold text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl shadow-md border border-stone-200/50">
              ₹{product.price}
            </span>

            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
              <button
                type="button"
                onClick={handleQuickAdd}
                className={`text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1 rounded-full shadow-md transition-all flex items-center gap-1 active:scale-95 ${
                  justAdded 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-slate-900/90 hover:bg-slate-900'
                }`}
                title="Quick Add to Cart"
              >
                {justAdded ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">Added</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3 h-3 text-rose-300" />
                    <span>+ Cart</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView(product);
                }}
                className="bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold p-1 sm:px-2.5 sm:py-1 rounded-full shadow-md transition-colors hidden sm:flex items-center gap-1"
                title="View Details"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Details</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Pinterest-Style Caption Under Pin */}
      <div className="px-1.5 pt-2 pb-1">
        <h3 className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-rose-600 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-slate-900 text-xs sm:text-sm">₹{product.price}</span>
            <span className="line-through text-slate-400 text-[10px]">₹{originalMrp}</span>
          </div>
          <span className="text-[10px] text-slate-400 capitalize truncate max-w-[100px]">
            {product.style || product.category.replace('-', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};
