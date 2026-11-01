import React, { useState } from 'react';
import { 
  X, 
  Star, 
  ShoppingBag, 
  ArrowRight, 
  Sparkles, 
  Check, 
  Upload, 
  Heart, 
  ShieldCheck, 
  Plus, 
  Minus,
  CheckCircle2,
  Image as ImageIcon,
  Camera
} from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../services/cartContext';
import { uploadPhotoToFirebaseStorage, resolveProductImageUrl, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

interface QuickViewModalProps {
  product: Product | null;
  allProducts: Product[];
  onClose: () => void;
  onCustomize: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  allProducts,
  onClose,
  onCustomize,
  onSelectProduct,
}) => {
  const { addItem } = useCart();

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedFinish, setSelectedFinish] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // Sync defaults when product changes
  React.useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes[0] || 'Standard');
      setSelectedFinish(product.paperFinishes[0] || 'Glossy');
      setQuantity(1);
      setUploadedPhotos([]);
      setCaption('');
      setAddedSuccess(false);
      setUploadError(null);
      setIsZoomed(false);
    }
  }, [product]);

  if (!product) return null;

  // Related products from the same collection/category
  const relatedDesigns = allProducts
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.collectionId === product.collectionId || p.category === product.category)
    )
    .slice(0, 4);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const previewUrl = URL.createObjectURL(file);
    
    // Instant local preview
    setUploadedPhotos((prev) => [...prev, previewUrl]);
    setIsUploading(true);
    setUploadError(null);

    try {
      const url = await uploadPhotoToFirebaseStorage(file, 'quickview_uploads');
      setUploadedPhotos((prev) => prev.map((u) => (u === previewUrl ? url : u)));
    } catch (err: any) {
      console.warn('Quickview upload fallback:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      product,
      size: selectedSize || product.sizes[0] || 'Standard',
      finish: selectedFinish || product.paperFinishes[0] || 'Glossy',
      quantity,
      unitPrice: product.price,
      photos: uploadedPhotos.length > 0 ? uploadedPhotos : [product.imageUrl],
      caption: caption.trim() || undefined,
      previewThumbnail: uploadedPhotos[0] || product.imageUrl,
    });

    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative bg-white rounded-3xl max-w-4xl w-full my-6 overflow-hidden shadow-2xl border border-stone-100 flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-stone-100 backdrop-blur-md flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-md transition-colors"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Column: Big Image Display with Zoom Lens & Finish Reflection */}
        <div className="md:w-1/2 bg-stone-100 relative flex flex-col justify-between overflow-hidden group">
          <div 
            onClick={() => setIsZoomed(!isZoomed)}
            className="relative aspect-[3/4] md:h-full w-full cursor-zoom-in overflow-hidden"
            title="Click to zoom photo"
          >
            <img
              src={uploadedPhotos[0] || resolveProductImageUrl(product)}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
              }}
              className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                isZoomed ? 'scale-150 cursor-zoom-out' : 'group-hover:scale-105'
              }`}
            />

            {/* Paper Finish Sheen Overlay (Glossy Pearl reflection vs Matte Velvet subtle diffusion) */}
            {selectedFinish === 'Glossy Pearl' || selectedFinish === 'Glossy' ? (
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/25 to-transparent pointer-events-none opacity-60 mix-blend-overlay" />
            ) : (
              <div className="absolute inset-0 bg-stone-900/5 pointer-events-none mix-blend-multiply" />
            )}

            {/* Overlaid Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-none">
              {product.badge && (
                <span className="bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-rose-600 shadow-sm border border-rose-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {product.badge}
                </span>
              )}
              {product.style && (
                <span className="bg-slate-900/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm">
                  {product.style} Style
                </span>
              )}
              {isZoomed && (
                <span className="bg-rose-600/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm">
                  1.5x Zoom Active
                </span>
              )}
            </div>

            {/* Zoom hint badge */}
            <div className="absolute bottom-4 right-4 bg-slate-900/70 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full z-10 pointer-events-none">
              {isZoomed ? 'Click to reset' : 'Click to zoom'}
            </div>
          </div>
        </div>

        {/* Right Column: Details, Options, & Actions */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-6 max-h-[85vh] overflow-y-auto">
          <div className="space-y-4">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-rose-600">
                <span>{product.category.replace('-', ' ')}</span>
                {product.occasion && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">{product.occasion}</span>
                  </>
                )}
              </div>

              <h2 className="font-['Playfair_Display',serif] text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {product.name}
              </h2>

              {/* Price & Rating */}
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">₹{product.price * quantity}</span>
                  {product.originalPrice > product.price && (
                    <span className="text-sm text-slate-400 line-through">
                      ₹{product.originalPrice * quantity}
                    </span>
                  )}
                  {quantity > 1 && (
                    <span className="text-xs text-slate-400 font-medium">
                      (₹{product.price} each)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{product.rating}</span>
                  <span className="text-slate-400 font-normal">({product.reviewCount})</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 leading-relaxed">
              {product.description}
            </p>

            {/* Size Variants */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Print Size: <span className="font-semibold text-rose-600">{selectedSize}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedSize === sz
                        ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Finish */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Paper Finish: <span className="font-semibold text-rose-600">{selectedFinish}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {product.paperFinishes.map((fn) => (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => setSelectedFinish(fn)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedFinish === fn
                        ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {fn}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Photo Upload & Caption */}
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-rose-600" />
                  <span>Personalize With Your Photo</span>
                </span>
                {uploadedPhotos.length > 0 && (
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 hover:border-rose-400 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors">
                  <Upload className="w-3.5 h-3.5 text-rose-600" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>

                <input
                  type="text"
                  placeholder="Caption (e.g. Goa 2026)"
                  value={caption}
                  maxLength={40}
                  onChange={(e) => setCaption(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              {uploadError && (
                <p className="text-[11px] text-rose-600">{uploadError}</p>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-800">Quantity:</span>
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3.5 py-1.5 font-black text-xs text-slate-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAddToCart}
                className={`py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                  addedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white'
                }`}
              >
                {addedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add to Cart • ₹{product.price * quantity}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCustomize(product);
                }}
                className="py-3 bg-stone-100 hover:bg-stone-200 text-slate-800 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5"
              >
                <span>Full Studio Customizer</span>
                <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
              </button>
            </div>
          </div>

          {/* Related Designs From Same Collection */}
          {relatedDesigns.length > 0 && (
            <div className="pt-4 border-t border-stone-100 space-y-2.5">
              <h4 className="font-bold text-xs text-slate-800">
                More from {product.collectionId?.replace('-', ' ') || 'this collection'}:
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {relatedDesigns.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectProduct(rel)}
                    className="cursor-pointer group aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 relative hover:border-rose-400 transition-all"
                    title={rel.name}
                  >
                    <img
                      src={resolveProductImageUrl(rel)}
                      alt={rel.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold p-1 text-center">
                      ₹{rel.price}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
