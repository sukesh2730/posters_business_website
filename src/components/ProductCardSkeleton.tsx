import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-xs animate-pulse flex flex-col">
      {/* Image Skeleton */}
      <div className="w-full aspect-[4/5] bg-stone-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-stone-100/50 to-transparent animate-shimmer" />
        <div className="absolute top-3 left-3 w-16 h-5 bg-stone-300 rounded-full" />
      </div>

      {/* Content Skeleton */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="h-4 bg-stone-200 rounded w-3/4" />
          <div className="h-3 bg-stone-100 rounded w-1/2" />
        </div>

        {/* Price & Rating Skeleton */}
        <div className="flex items-center justify-between pt-2">
          <div className="h-5 bg-stone-200 rounded w-20" />
          <div className="h-4 bg-stone-100 rounded w-12" />
        </div>

        {/* Action Button Skeleton */}
        <div className="h-9 bg-stone-200 rounded-xl w-full" />
      </div>
    </div>
  );
};
