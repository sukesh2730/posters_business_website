import React from 'react';
import { SPLIT_TEMPLATES, SplitPieces } from '../shared/printPricing';
import { PosterDesign } from '../shared/posterDesigns';
import { PosterArt } from './PosterArt';

interface SplitPreviewProps {
  pieces: SplitPieces;
  design?: PosterDesign;
  photoUrl?: string;
  focusX?: number; // 0..100
  focusY?: number; // 0..100
  className?: string;
}

const GAP = 1.2; // percent gap between panels

/**
 * One image cut into N panels. Every panel shows its own slice of the SAME artwork by
 * scaling an inner layer to the full artwork size and offsetting it.
 */
export const SplitPreview: React.FC<SplitPreviewProps> = ({
  pieces,
  design,
  photoUrl,
  focusX = 50,
  focusY = 50,
  className = '',
}) => {
  const tpl = SPLIT_TEMPLATES[pieces];
  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden ${className}`}
      style={{
        aspectRatio: `${tpl.aspect * 1.12} / 1`,
        background: 'linear-gradient(180deg, #ece6da 0%, #e4ddcf 100%)',
      }}
    >
      <div className="absolute" style={{ inset: '6% 5.4%' }}>
        {tpl.panels.map((p, i) => (
          <div
            key={i}
            className="absolute overflow-hidden bg-white shadow-[0_2px_8px_rgba(60,40,20,0.3)]"
            style={{
              left: `${p.x * 100 + GAP / 2}%`,
              top: `${p.y * 100 + GAP / 2}%`,
              width: `${p.w * 100 - GAP}%`,
              height: `${p.h * 100 - GAP}%`,
            }}
          >
            <div
              className="absolute"
              style={{
                width: `${100 / p.w}%`,
                height: `${100 / p.h}%`,
                left: `${(-p.x / p.w) * 100}%`,
                top: `${(-p.y / p.h) * 100}%`,
                backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: `${focusX}% ${focusY}%`,
              }}
            >
              {!photoUrl && design && <PosterArt design={design} showTitle className="w-full h-full block" />}
            </div>
          </div>
        ))}
        {!photoUrl && !design && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-500">
            Pick a design or upload a photo
          </div>
        )}
      </div>
    </div>
  );
};
