import React from 'react';
import { Product } from '../types';
import { resolveProductImageUrl, DEFAULT_FALLBACK_PRODUCT_IMAGE } from '../services/orderService';

interface LiveProductPreviewProps {
  product: Product;
  photos: string[];
  caption?: string;
  selectedSize: string;
  selectedFinish: string;
  frameColor?: string;
}

export const LiveProductPreview: React.FC<LiveProductPreviewProps> = ({
  product,
  photos,
  caption,
  selectedSize,
  selectedFinish,
  frameColor = 'Natural Wood',
}) => {
  const defaultProductImg = resolveProductImageUrl(product);
  const displayPhotos = photos.length > 0 ? photos : [defaultProductImg];

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = defaultProductImg || DEFAULT_FALLBACK_PRODUCT_IMAGE;
  };

  // 1. Polaroid-style preview
  if (product.category === 'polaroids') {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-50/50 via-rose-50/30 to-purple-50/30 rounded-2xl border border-rose-100/60 shadow-inner">
        <div className="relative bg-white p-3.5 pb-8 pt-3.5 rounded shadow-[0_12px_35px_-8px_rgba(0,0,0,0.18)] max-w-xs w-full transition-transform duration-300 hover:rotate-1">
          {/* Polaroid Photo Frame */}
          <div className="aspect-[4/4.2] w-full bg-slate-100 overflow-hidden rounded-[2px] relative shadow-inner">
            <img
              src={displayPhotos[0]}
              alt="Polaroid Preview"
              onError={handleImgError}
              className={`w-full h-full object-cover transition-all ${
                selectedFinish.toLowerCase().includes('matte') ? 'contrast-[0.95] brightness-[1.02]' : 'contrast-[1.05]'
              }`}
            />
            {/* Subtle vintage sheen overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-amber-100/10 pointer-events-none" />
          </div>

          {/* Caption text area at bottom of Polaroid */}
          <div className="mt-4 px-1 min-h-[2rem] flex items-center justify-center text-center">
            <p className="font-['Caveat',cursive] text-slate-800 text-xl font-bold tracking-wide">
              {caption || 'Your memories live here ✨'}
            </p>
          </div>

          {/* Top pin or tape decorative touch */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-amber-200/80 backdrop-blur-sm -rotate-2 rounded-sm shadow-xs border-t border-amber-300/40" />
        </div>

        {photos.length > 1 && (
          <p className="mt-4 text-xs text-slate-500 font-medium">
            + {photos.length - 1} more photo{photos.length - 1 > 1 ? 's' : ''} in this pack
          </p>
        )}
      </div>
    );
  }

  // 2. Photobooth Strip preview
  if (product.category === 'photo-strips') {
    const stripPhotos = displayPhotos.slice(0, 4);
    // Fill up to 3 slots if fewer provided
    const paddedPhotos = [...stripPhotos];
    while (paddedPhotos.length < 3) {
      paddedPhotos.push(displayPhotos[0] || defaultProductImg);
    }

    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-rose-50/40 rounded-2xl border border-slate-200/60 shadow-inner">
        <div className="bg-white p-3 pb-6 rounded-md shadow-2xl w-48 transition-all hover:scale-[1.02] border border-slate-100">
          <div className="space-y-2.5">
            {paddedPhotos.map((photo, idx) => (
              <div key={idx} className="aspect-[4/3] w-full bg-slate-100 rounded-sm overflow-hidden shadow-inner">
                <img
                  src={photo}
                  alt={`Strip item ${idx + 1}`}
                  onError={handleImgError}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Photobooth Strip Bottom Brand & Date */}
          <div className="mt-4 text-center border-t border-slate-100 pt-3">
            <span className="font-['Playfair_Display',serif] text-xs font-bold tracking-widest text-slate-700 uppercase">
              MemoPrint Strip
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {caption || 'PHOTOBOOTH • MEMORIES'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Photo Frame preview
  if (product.category === 'frames') {
    const isWood = frameColor.toLowerCase().includes('wood') || frameColor.toLowerCase().includes('pine');
    const isBlack = frameColor.toLowerCase().includes('black') || frameColor.toLowerCase().includes('obsidian');

    return (
      <div className="flex flex-col items-center justify-center p-6 bg-stone-100/70 rounded-2xl border border-stone-200/60 shadow-inner">
        {/* Frame Border */}
        <div
          className={`p-4 rounded-lg shadow-2xl transition-all duration-300 max-w-sm w-full ${
            isWood
              ? 'bg-[#c59b6c] border-[6px] border-[#a27b4f]'
              : isBlack
              ? 'bg-slate-900 border-[6px] border-slate-950'
              : 'bg-stone-50 border-[6px] border-stone-200'
          }`}
        >
          {/* Inner White Passe-Partout Mat */}
          <div className="bg-white p-5 rounded-xs shadow-inner">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xs shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)] relative">
              <img
                src={displayPhotos[0]}
                alt="Framed Artwork"
                onError={handleImgError}
                className="w-full h-full object-cover"
              />
              {/* Acrylic Glass Reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
            </div>
            {caption && (
              <p className="text-center text-xs font-medium text-slate-600 mt-2 font-['Playfair_Display',serif] italic">
                "{caption}"
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 font-medium">
          {frameColor} • {selectedSize}
        </div>
      </div>
    );
  }

  // 4. Poster / Collage / Gift generic preview
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200/80 shadow-inner">
      <div className="relative rounded-xl overflow-hidden shadow-xl max-w-sm w-full aspect-square bg-slate-100">
        <img
          src={displayPhotos[0]}
          alt="Product Preview"
          onError={handleImgError}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
          <p className="font-semibold text-sm">{product.name}</p>
          <p className="text-xs text-white/80">{selectedSize} • {selectedFinish}</p>
          {caption && <p className="text-xs font-['Caveat',cursive] text-amber-200 text-base mt-1">{caption}</p>}
        </div>
      </div>
    </div>
  );
};
