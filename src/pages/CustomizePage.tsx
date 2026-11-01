import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  ShoppingBag, 
  Check, 
  Info, 
  Star, 
  ShieldCheck, 
  Truck, 
  AlertCircle 
} from 'lucide-react';
import { Product } from '../types';
import { PhotoUploader } from '../components/PhotoUploader';
import { LiveProductPreview } from '../components/LiveProductPreview';
import { useCart } from '../services/cartContext';
import { resolveProductImageUrl, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

interface CustomizePageProps {
  product: Product;
  onBack: () => void;
  onOpenCart: () => void;
}

export const CustomizePage: React.FC<CustomizePageProps> = ({
  product,
  onBack,
  onOpenCart,
}) => {
  const { addItem } = useCart();

  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>(product.sizes[0] || 'Standard');
  const [selectedFinish, setSelectedFinish] = useState<string>(product.paperFinishes[0] || 'Glossy');
  const [frameColor, setFrameColor] = useState<string>('Natural Wood');
  const [caption, setCaption] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const isFrame = product.category === 'frames';

  const handleAddToCart = () => {
    setValidationError(null);

    // Validate min photos
    if (uploadedPhotos.length < product.minPhotos) {
      setValidationError(
        `Please upload at least ${product.minPhotos} photo${
          product.minPhotos > 1 ? 's' : ''
        } before adding to cart.`
      );
      return;
    }

    addItem({
      productId: product.id,
      product,
      size: selectedSize,
      finish: selectedFinish,
      quantity,
      unitPrice: product.price,
      photos: uploadedPhotos,
      caption: caption.trim() || undefined,
      notes: notes.trim() || undefined,
      frameColor: isFrame ? frameColor : undefined,
      previewThumbnail: uploadedPhotos[0] || resolveProductImageUrl(product),
    });

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onOpenCart();
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back button & Breadcrumb */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      {/* Main Grid: Left is Live Mockup, Right is Customization Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Live Interactive Mockup */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-stone-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Live Preview
              </span>
              <span className="text-[11px] text-slate-400">Updates in real-time</span>
            </div>

            <LiveProductPreview
              product={product}
              photos={uploadedPhotos}
              caption={caption}
              selectedSize={selectedSize}
              selectedFinish={selectedFinish}
              frameColor={frameColor}
            />

            <p className="text-[11px] text-center text-slate-400">
              * Screen preview is an approximation. Finished print utilizes true 300 DPI high-definition archival printing.
            </p>
          </div>

          {/* Product Highlights */}
          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-rose-950">
              <Truck className="w-4 h-4 text-rose-600" />
              <span>Pan-India Delivery</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Carefully packed in waterproof, crush-proof packaging. Dispatched within 24-48 hours.
            </p>
          </div>
        </div>

        {/* Right Column: Customization Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          {/* Header & Price */}
          <div className="border-b border-stone-100 pb-5 space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-500 font-bold">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-slate-800">{product.rating}</span>
              <span className="text-slate-400">({product.reviewCount} customer reviews)</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 uppercase tracking-wider text-[11px]">
                In Stock ({product.stock} available)
              </span>
            </div>

            <h1 className="font-['Playfair_Display',serif] text-2xl sm:text-3xl font-extrabold text-slate-900">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl font-black text-slate-900">
                ₹{product.price * quantity}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-sm text-slate-400 line-through">
                  ₹{product.originalPrice * quantity}
                </span>
              )}
              {quantity > 1 && (
                <span className="text-xs text-slate-500 font-medium">
                  (₹{product.price} each)
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {product.description}
            </p>
          </div>

          {/* STEP 1: Photo Uploader */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>Upload Photos for Customization</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {product.minPhotos === product.maxPhotos
                  ? `Exactly ${product.minPhotos} photo required`
                  : `${product.minPhotos} to ${product.maxPhotos} photos`}
              </span>
            </div>

            <PhotoUploader
              photos={uploadedPhotos}
              onChange={setUploadedPhotos}
              minPhotos={product.minPhotos}
              maxPhotos={product.maxPhotos}
            />
          </div>

          {/* STEP 2: Size Selection */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>Select Print Dimensions</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {product.sizes.map((sz) => {
                const isSelected = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`p-3 rounded-xl text-left border text-xs transition-all ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/50 text-rose-950 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <p>{sz}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Paper Finish Selection */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              <span>Select Paper Finish</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {product.paperFinishes.map((fn) => {
                const isSelected = selectedFinish === fn;
                return (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => setSelectedFinish(fn)}
                    className={`p-3 rounded-xl text-left border text-xs transition-all ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/50 text-rose-950 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <p>{fn}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frame Color Selection (if frame) */}
          {isFrame && (
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-sm text-slate-900">Frame Finish & Material</h3>
              <div className="grid grid-cols-3 gap-2.5">
                {['Natural Pine Wood', 'Matte Obsidian Black', 'Pure White Oak'].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setFrameColor(col)}
                    className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-all ${
                      frameColor === col
                        ? 'border-rose-600 bg-rose-50/50 text-rose-950'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Caption & Personalization Text */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                4
              </span>
              <span>Add Caption or Memory Note (Optional)</span>
            </h3>

            <input
              type="text"
              placeholder="e.g. Goa 2026 • Forever Together ❤️ • Happy 25th Anniversary"
              value={caption}
              maxLength={60}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white"
            />
            <div className="flex justify-between text-[11px] text-slate-400 px-1">
              <span>Printed in elegant handwritten font below the photograph</span>
              <span>{caption.length} / 60</span>
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-slate-700">
              Special Printing Instructions / Gift Note (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please crop closely to the faces, add gift wrapping, or include 'Happy Birthday Priya' card inside box."
              value={notes}
              maxLength={250}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white"
            />
          </div>

          {/* Quantity & CTA */}
          <div className="pt-4 border-t border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Quantity</span>
                <span className="text-[11px] text-slate-500">Each pack contains specified prints</span>
              </div>

              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="px-4 py-2 font-bold text-sm text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-200"
                >
                  +
                </button>
              </div>
            </div>

            {/* Validation Alert */}
            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleAddToCart}
              className={`w-full py-4 rounded-2xl font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                isSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white'
              }`}
            >
              {isSuccess ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  <span>Add to Cart • ₹{product.price * quantity}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar for Mobile Viewports (<lg) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-2xl z-40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={uploadedPhotos[0] || resolveProductImageUrl(product)}
            alt={product.name}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = DEFAULT_FALLBACK_PRODUCT_IMAGE;
            }}
            className="w-11 h-11 rounded-lg object-cover border border-stone-200 shrink-0"
          />
          <div className="truncate">
            <span className="text-xs font-bold text-slate-900 block truncate">
              {product.name}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-rose-600">
                ₹{product.price * quantity}
              </span>
              <span className="text-[10px] text-slate-400">
                • {selectedFinish}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all shrink-0 flex items-center gap-1.5 ${
            isSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          {isSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Added!</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
