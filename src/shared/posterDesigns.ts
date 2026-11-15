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
  | 'kollywood'
  | 'slang';

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
  { id: 'slang', label: 'Tamil & Malayalam', tagline: 'Everyday slang on bold colour blocks' },
];

export interface PosterDesign {
  id: string;
  theme: PosterThemeId;
  title: string;
  /** [background top, background bottom, accent, ink] */
  palette: [string, string, string, string];
  seed: number;
  imageUrl?: string;
  /** Slang designs only: what the word means in English, which language it is, and how it is drawn. */
  subtitle?: string;
  lang?: 'ta' | 'ml';
  look?: SlangLook;
  icon?: SlangIcon;
}

export type SlangLook = 'solid' | 'burst' | 'stripes' | 'split' | 'dots';
export type SlangIcon = 'star' | 'moon' | 'arrow' | 'tea' | 'plate' | 'drop' | 'none';

type ClassicThemeId = Exclude<PosterThemeId, 'slang'>;

const PALETTES: Record<ClassicThemeId, Array<[string, string, string, string]>> = {
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

const TITLES: Record<ClassicThemeId, string[]> = {
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

const CLASSIC_DESIGNS: PosterDesign[] = POSTER_THEMES.filter((t) => t.id !== 'slang').flatMap((theme, themeIdx) =>
  TITLES[theme.id as ClassicThemeId].map((title, i) => ({
    id: `${theme.id}-${i + 1}`,
    theme: theme.id,
    title,
    palette: PALETTES[theme.id as ClassicThemeId][i % PALETTES[theme.id as ClassicThemeId].length],
    seed: (themeIdx + 1) * 101 + (i + 1) * 17,
  }))
);

// ---------------------------------------------------------------------------------------------
// Tamil & Malayalam slang. Original wording and artwork only: no film titles, no dialogue from films,
// no real people. Words are written in English letters. Ask a native speaker to check meanings
// and spelling before you print.
// palette = [colour 1, colour 2, accent, ink]
// ---------------------------------------------------------------------------------------------
const SLANG: Array<{ word: string; meaning: string; lang: 'ta' | 'ml'; look: SlangLook; icon: SlangIcon; palette: [string, string, string, string] }> = [
  { word: 'Semma', meaning: 'Awesome', lang: 'ta', look: 'burst', icon: 'star', palette: ['#FFC914', '#FFB300', '#111111', '#111111'] },
  { word: 'Vera Level', meaning: 'Next level', lang: 'ta', look: 'stripes', icon: 'arrow', palette: ['#FF9A0B', '#00D4FF', '#111111', '#FFFFFF'] },
  { word: 'Machi', meaning: 'Buddy', lang: 'ta', look: 'split', icon: 'none', palette: ['#2AA9A0', '#FFFFFF', '#111111', '#0F172A'] },
  { word: 'Thoongu', meaning: 'Sleep', lang: 'ta', look: 'solid', icon: 'moon', palette: ['#FFC914', '#FFC914', '#111111', '#111111'] },
  { word: 'Kalakkal', meaning: 'Brilliant', lang: 'ta', look: 'burst', icon: 'star', palette: ['#D7263D', '#B81E32', '#FFE9A8', '#FFFFFF'] },
  { word: 'Mokka', meaning: 'Lame joke', lang: 'ta', look: 'dots', icon: 'none', palette: ['#6A3AB2', '#6A3AB2', '#FFFFFF', '#FFFFFF'] },
  { word: 'Paavam', meaning: 'Poor thing', lang: 'ta', look: 'solid', icon: 'drop', palette: ['#FF8FA3', '#FF8FA3', '#3B0A1E', '#3B0A1E'] },
  { word: 'Saapadu', meaning: 'Meal time', lang: 'ta', look: 'split', icon: 'plate', palette: ['#FF9A0B', '#FFF4D6', '#7A2E00', '#3A1A00'] },
  { word: 'Ayyo', meaning: 'Oh no!', lang: 'ta', look: 'stripes', icon: 'none', palette: ['#111111', '#FFC914', '#FFC914', '#111111'] },
  { word: 'Adipoli', meaning: 'Fantastic', lang: 'ml', look: 'burst', icon: 'star', palette: ['#0F7A3F', '#0B6A36', '#FFFFFF', '#FFFFFF'] },
  { word: 'Pwoli', meaning: 'Superb', lang: 'ml', look: 'dots', icon: 'none', palette: ['#FF6B2C', '#FF6B2C', '#2A0F00', '#2A0F00'] },
  { word: 'Mwone', meaning: 'Dear friend', lang: 'ml', look: 'solid', icon: 'none', palette: ['#6A3AB2', '#6A3AB2', '#FFD84D', '#FFFFFF'] },
  { word: 'Chetta', meaning: 'Big brother', lang: 'ml', look: 'split', icon: 'none', palette: ['#2AA9A0', '#FFFFFF', '#111111', '#0F172A'] },
  { word: 'Kidu', meaning: 'Awesome', lang: 'ml', look: 'stripes', icon: 'arrow', palette: ['#00D4FF', '#FF9A0B', '#111111', '#FFFFFF'] },
  { word: 'Pinne', meaning: 'Of course!', lang: 'ml', look: 'solid', icon: 'none', palette: ['#C1121F', '#C1121F', '#FFE9A8', '#FFF4D6'] },
  { word: 'Chaya', meaning: 'Tea', lang: 'ml', look: 'solid', icon: 'tea', palette: ['#F6E7C1', '#F6E7C1', '#9A4A12', '#5A2D0C'] },
];

const SLANG_DESIGNS: PosterDesign[] = SLANG.map((d, i) => ({
  id: `slang-${i + 1}`,
  theme: 'slang' as const,
  title: d.word,
  palette: d.palette,
  seed: 1000 + i * 13,
  subtitle: d.meaning,
  lang: d.lang,
  look: d.look,
  icon: d.icon,
}));

export const POSTER_DESIGNS: PosterDesign[] = [...CLASSIC_DESIGNS, ...SLANG_DESIGNS];

const DESIGN_INDEX = new Map(POSTER_DESIGNS.map((d) => [d.id, d]));

export function getDesign(id: string): PosterDesign | undefined {
  return DESIGN_INDEX.get(id);
}

export function designsByTheme(theme: PosterThemeId | 'all'): PosterDesign[] {
  return theme === 'all' ? POSTER_DESIGNS : POSTER_DESIGNS.filter((d) => d.theme === theme);
}
