import React from 'react';
import { BuilderConfig, getWallLayout } from '../shared/printPricing';
import { getDesign } from '../shared/posterDesigns';
import { WallPreview } from './WallPreview';
import { SplitPreview } from './SplitPreview';
import { PosterArt } from './PosterArt';

/** Small picture of a built wall / split poster / mix pack for cart, checkout and admin. */
export const BuilderThumb: React.FC<{ builder: BuilderConfig }> = ({ builder }) => {
  if (builder.kind === 'wall') {
    const layout = getWallLayout(builder.layoutId);
    if (!layout) return null;
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100">
        <WallPreview layout={layout} slots={builder.slots} mini />
      </div>
    );
  }
  if (builder.kind === 'split') {
    const design = builder.source.type === 'design' ? getDesign(builder.source.designId) : undefined;
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100">
        <SplitPreview
          pieces={builder.pieces}
          design={design}
          photoUrl={builder.source.type === 'photo' ? builder.source.url : undefined}
          focusX={builder.source.type === 'photo' ? builder.source.focusX : undefined}
          focusY={builder.source.type === 'photo' ? builder.source.focusY : undefined}
        />
      </div>
    );
  }
  const first = builder.designIds.slice(0, 4).map(getDesign).filter(Boolean);
  return (
    <div className="w-full h-full grid grid-cols-2 gap-px bg-stone-200">
      {first.map((d, i) => (
        <PosterArt key={i} design={d!} showTitle={false} className="w-full h-full block" />
      ))}
    </div>
  );
};
