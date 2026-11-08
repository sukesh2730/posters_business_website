import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { WallLayout, SlotFill, computeWallGeometry } from '../shared/printPricing';
import { getDesign } from '../shared/posterDesigns';
import { PosterArt } from './PosterArt';

interface WallPreviewProps {
  layout: WallLayout;
  slots?: Array<SlotFill | null>;
  selectedIndex?: number | null;
  onSelectSlot?: (index: number) => void;
  /** compact thumbnail with no interaction (layout cards) */
  mini?: boolean;
}

/** Draws the wall to scale. Slots are positioned in percentages so it scales to any width. */
export const WallPreview: React.FC<WallPreviewProps> = ({
  layout,
  slots,
  selectedIndex,
  onSelectSlot,
  mini = false,
}) => {
  const geo = useMemo(() => computeWallGeometry(layout), [layout]);
  const pad = 6; // cm of wall around the posters
  const totalW = geo.width + pad * 2;
  const totalH = geo.height + pad * 2;
  const interactive = !mini && !!onSelectSlot;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: `${totalW} / ${totalH}`,
        background: 'linear-gradient(180deg, #ece6da 0%, #e4ddcf 100%)',
        boxShadow: mini ? undefined : 'inset 0 0 0 1px rgba(120,100,70,0.12)',
      }}
    >
      {geo.slots.map((s) => {
        const fill = slots?.[s.index] ?? null;
        const design = fill?.type === 'design' ? getDesign(fill.designId) : undefined;
        const selected = selectedIndex === s.index;
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${((s.x + pad) / totalW) * 100}%`,
          top: `${((s.y + pad) / totalH) * 100}%`,
          width: `${(s.w / totalW) * 100}%`,
          height: `${(s.h / totalH) * 100}%`,
        };
        const common = 'overflow-hidden bg-white shadow-[0_2px_6px_rgba(60,40,20,0.25)]';

        const content = fill ? (
          fill.type === 'photo' ? (
            <img src={fill.url} alt="" className="w-full h-full object-cover" draggable={false} />
          ) : design ? (
            <PosterArt design={design} showTitle={!mini} className="w-full h-full block" />
          ) : null
        ) : mini ? (
          <div className="w-full h-full bg-stone-50" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/70 border border-dashed border-stone-400/70 text-stone-400">
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
          </div>
        );

        if (!interactive) {
          return (
            <div key={s.index} style={style} className={common}>
              {content}
            </div>
          );
        }
        return (
          <button
            key={s.index}
            type="button"
            style={style}
            onClick={() => onSelectSlot!(s.index)}
            aria-label={`Poster ${s.index + 1}, ${s.size}${fill ? ', filled' : ', empty'}`}
            aria-pressed={selected}
            className={`${common} transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              selected ? 'ring-[3px] ring-rose-500 z-10 scale-[1.04]' : 'hover:scale-[1.03]'
            }`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
};
