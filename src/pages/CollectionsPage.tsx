import React from 'react';
import { Sparkles, ArrowRight, Camera, Film, Heart, Gift, Image as ImageIcon } from 'lucide-react';
import { COLLECTIONS } from '../data/defaultProducts';
import { Product, CollectionInfo } from '../types';

interface CollectionsPageProps {
  products: Product[];
  collections?: CollectionInfo[];
  onSelectCollection: (collectionId: string) => void;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  products,
  collections,
  onSelectCollection,
}) => {
  const activeCollections = collections && collections.length > 0 ? collections : COLLECTIONS;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-rose-600" />
          <span>Curated Photo Aesthetics</span>
        </div>
        <h1 className="font-['Playfair_Display',serif] text-3xl sm:text-4xl font-extrabold text-slate-900">
          Explore MemoPrint Collections
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Discover our themed photo product lines, from vintage photobooth strips and nostalgic Polaroids to pastel room aesthetics.
        </p>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {activeCollections.map((col) => {
          const matchingCount = products.filter(
            (p) => p.collectionId === col.id || p.category === col.id
          ).length;

          return (
            <div
              key={col.id}
              onClick={() => onSelectCollection(col.id)}
              className="group cursor-pointer rounded-3xl overflow-hidden bg-white border border-stone-200/90 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
            >
              {/* Cover Image */}
              <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden">
                <img
                  src={col.coverImage}
                  alt={col.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                {/* Badge Count */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-900 shadow-sm">
                  {matchingCount || col.designCount || 5} Designs
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="font-['Playfair_Display',serif] text-xl font-black drop-shadow-sm">
                    {col.name}
                  </h3>
                </div>
              </div>

              {/* Description & Footer */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {col.description}
                </p>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-600 group-hover:underline">
                    Browse Collection
                  </span>
                  <div className="w-8 h-8 rounded-full bg-rose-50 group-hover:bg-rose-600 group-hover:text-white text-rose-600 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
