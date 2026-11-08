// Original, non-branded poster designs used by the wall builder, split posters and
// mix & match packs. Each design is rendered as vector art (see PosterArt.tsx), so
// there are no image files or third-party artwork involved. Replace or extend these
// with licensed/original artwork by adding an `imageUrl` to a design.

export type PosterThemeId =
  | 'cars'
  | 'heroes'
  | 'gaming'
  | 'sports'
  | 'music'
  | 'movies'
  | 'gym'
  | 'divine'
  | 'kollywood';

export interface PosterTheme {
  id: PosterThemeId;
  label: string;
  tagline: string;
}

export const POSTER_THEMES: PosterTheme[] = [
  { id: 'cars', label: 'Cars', tagline: 'Garage walls and midnight drives' },
  { id: 'heroes', label: 'Superheroes', tagline: 'Capes, skylines and big moments' },
  { id: 'gaming', label: 'Gaming', tagline: 'Pixels, boss fights and high scores' },
  { id: 'sports', label: 'Sports & F1', tagline: 'Race day, cricket and the final whistle' },
  { id: 'music', label: 'Music', tagline: 'Vinyl, basslines and front-row nights' },
  { id: 'movies', label: 'Movies', tagline: 'Noir frames and cult favourites' },
  { id: 'gym', label: 'Gym & Quotes', tagline: 'Discipline you can read from the bed' },
  { id: 'divine', label: 'Divine', tagline: 'Calm, devotional and sacred geometry' },
  { id: 'kollywood', label: 'Kollywood', tagline: 'Chennai street, screen and sunset' },
];

export interface PosterDesign {
  id: string;
  theme: PosterThemeId;
  title: string;
  /** [background top, background bottom, accent, ink] */
  palette: [string, string, string, string];
  seed: number;
  imageUrl?: string;
}

const PALETTES: Record<PosterThemeId, Array<[string, string, string, string]>> = {
  cars: [
    ['#0f172a', '#1e293b', '#f97316', '#f8fafc'],
    ['#1c1917', '#44403c', '#facc15', '#fafaf9'],
    ['#082f49', '#0c4a6e', '#38bdf8', '#f0f9ff'],
    ['#450a0a', '#7f1d1d', '#fca5a5', '#fff1f2'],
  ],
  heroes: [
    ['#1e1b4b', '#3730a3', '#f43f5e', '#eef2ff'],
    ['#111827', '#374151', '#fbbf24', '#f9fafb'],
    ['#4c0519', '#9f1239', '#38bdf8', '#fff1f2'],
    ['#064e3b', '#047857', '#fde047', '#ecfdf5'],
  ],
  gaming: [
    ['#2e1065', '#5b21b6', '#22d3ee', '#faf5ff'],
    ['#052e16', '#166534', '#a3e635', '#f0fdf4'],
    ['#172554', '#1d4ed8', '#f472b6', '#eff6ff'],
    ['#27272a', '#52525b', '#fb923c', '#fafafa'],
  ],
  sports: [
    ['#7f1d1d', '#b91c1c', '#fef08a', '#fef2f2'],
    ['#0c4a6e', '#0369a1', '#f8fafc', '#f0f9ff'],
    ['#14532d', '#15803d', '#fde68a', '#f0fdf4'],
    ['#18181b', '#3f3f46', '#ef4444', '#fafafa'],
  ],
  music: [
    ['#3b0764', '#86198f', '#f0abfc', '#fdf4ff'],
    ['#0f172a', '#312e81', '#a5b4fc', '#eef2ff'],
    ['#431407', '#9a3412', '#fdba74', '#fff7ed'],
    ['#042f2e', '#0f766e', '#5eead4', '#f0fdfa'],
  ],
  movies: [
    ['#09090b', '#27272a', '#fbbf24', '#fafafa'],
    ['#1c1917', '#57534e', '#f5f5f4', '#fafaf9'],
    ['#3f0d12', '#7f1d1d', '#fcd34d', '#fef2f2'],
    ['#0f172a', '#1e3a8a', '#fda4af', '#eff6ff'],
  ],
  gym: [
    ['#18181b', '#27272a', '#ef4444', '#fafafa'],
    ['#111827', '#1f2937', '#a3e635', '#f9fafb'],
    ['#fafaf9', '#e7e5e4', '#171717', '#0c0a09'],
    ['#1e293b', '#334155', '#fb923c', '#f8fafc'],
  ],
  divine: [
    ['#7c2d12', '#c2410c', '#fde68a', '#fffbeb'],
    ['#1e1b4b', '#4338ca', '#fcd34d', '#eef2ff'],
    ['#831843', '#be185d', '#fef3c7', '#fdf2f8'],
    ['#14532d', '#166534', '#fde68a', '#f0fdf4'],
  ],
  kollywood: [
    ['#7c2d12', '#ea580c', '#fef08a', '#fff7ed'],
    ['#4a044e', '#a21caf', '#fde047', '#fdf4ff'],
    ['#064e3b', '#0d9488', '#fecdd3', '#f0fdfa'],
    ['#1e3a8a', '#2563eb', '#fed7aa', '#eff6ff'],
  ],
};

const TITLES: Record<PosterThemeId, string[]> = {
  cars: ['Midnight Coupe', 'Apex Corner', 'Turbo Dawn', 'Gravel Hero', 'Neon Drift', 'Long Straight', 'Garage Light', 'Redline'],
  heroes: ['The Caped Guardian', 'Neon Vigilante', 'Last Sentinel', 'Skyline Watcher', 'Iron Resolve', 'Shadow Runner', 'Thunder Fist', 'Rooftop Hero'],
  gaming: ['Pixel Quest', 'Boss Level', 'Respawn', 'Player Two', 'High Score', 'Dungeon Crawl', 'Final Stage', 'Co-op Night'],
  sports: ['Pole Position', 'Chequered Flag', 'Lights Out', 'Pit Lane', 'Wicket Fever', 'Last Over', 'Full Court', 'Golden Goal'],
  music: ['Vinyl Nights', 'Soundwave', 'Encore', 'Bass Drop', 'Lo-fi Hours', 'Unplugged', 'Mixtape 99', 'Front Row'],
  movies: ['Noir Reel', 'Last Frame', 'Midnight Screening', 'Directors Cut', 'Popcorn Hour', 'Plot Twist', 'Rolling Credits', 'Cult Classic'],
  gym: ['Discipline', 'No Days Off', 'Earn It', 'Iron Mind', 'Sweat Equity', 'One More Rep', 'Quiet Grind', 'Morning Grind'],
  divine: ['Om Sunrise', 'Lotus Path', 'Temple Bells', 'Diya Glow', 'Karma Path', 'Moon and Mantra', 'Ganga Aarti', 'Sacred Geometry'],
  kollywood: ['Chennai Kuthu', 'Marina Sunset', 'Filter Coffee', 'Mass Entry', 'Auto Rickshaw', 'Jasmine Evenings', 'Pongal Morning', 'First Day First Show'],
};

export const POSTER_DESIGNS: PosterDesign[] = POSTER_THEMES.flatMap((theme, themeIdx) =>
  TITLES[theme.id].map((title, i) => ({
    id: `${theme.id}-${i + 1}`,
    theme: theme.id,
    title,
    palette: PALETTES[theme.id][i % PALETTES[theme.id].length],
    seed: (themeIdx + 1) * 101 + (i + 1) * 17,
  }))
);

const DESIGN_INDEX = new Map(POSTER_DESIGNS.map((d) => [d.id, d]));

export function getDesign(id: string): PosterDesign | undefined {
  return DESIGN_INDEX.get(id);
}

export function designsByTheme(theme: PosterThemeId | 'all'): PosterDesign[] {
  return theme === 'all' ? POSTER_DESIGNS : POSTER_DESIGNS.filter((d) => d.theme === theme);
}
