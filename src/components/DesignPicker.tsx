import React, { useMemo } from 'react';
import { POSTER_THEMES, PosterThemeId, designsByTheme, PosterDesign } from '../shared/posterDesigns';
import { PosterArt } from './PosterArt';

interface DesignPickerProps {
  theme: PosterThemeId | 'all';
  onThemeChange: (t: PosterThemeId | 'all') => void;
  onPick: (design: PosterDesign) => void;
  /** designs shown with a count badge (mix & match) */
  counts?: Record<string, number>;
  columns?: string;
}

export const DesignPicker: React.FC<DesignPickerProps> = ({
  theme,
  onThemeChange,
  onPick,
  counts,
  columns = 'grid-cols-3 sm:grid-cols-4',
}) => {
  const designs = useMemo(() => designsByTheme(theme), [theme]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1" role="tablist" aria-label="Poster themes">
        {[{ id: 'all' as const, label: 'All' }, ...POSTER_THEMES].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={theme === t.id}
            onClick={() => onThemeChange(t.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              theme === t.id
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-600 border-stone-200 hover:border-rose-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={`grid ${columns} gap-2.5 max-h-[420px] overflow-y-auto pr-1`}>
        {designs.map((d) => {
          const n = counts?.[d.id] ?? 0;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onPick(d)}
              className="relative group text-left rounded-lg overflow-hidden bg-white shadow-sm border border-stone-200 hover:border-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label={`Use ${d.title}`}
            >
              <div style={{ aspectRatio: '300 / 424' }}>
                <PosterArt design={d} showTitle={false} className="w-full h-full block" />
              </div>
              <span className="block px-2 py-1.5 text-[11px] font-semibold text-slate-700 truncate">{d.title}</span>
              {n > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
