import React from 'react';
import { PosterDesign } from '../shared/posterDesigns';

// Vector artwork for the built-in designs. Original shapes only, so there is no
// third-party IP in the default catalog. If a design has an imageUrl it is shown instead.

const W = 300;
const H = 424;

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function Motif({ design }: { design: PosterDesign }) {
  const [, , accent, ink] = design.palette;
  const r = rng(design.seed);

  switch (design.theme) {
    case 'cars':
      return (
        <g>
          <circle cx={150} cy={170} r={84} fill={accent} opacity={0.9} />
          <rect x={0} y={170} width={W} height={H} fill={design.palette[1]} opacity={0.92} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={150 + (i - 2.5) * 12} y1={170} x2={150 + (i - 2.5) * 70} y2={H} stroke={ink} strokeWidth={2} opacity={0.35} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={-20 + i * 14} y={196 + i * 26} width={120 - i * 14} height={4} fill={ink} opacity={0.6} />
          ))}
          <path d="M70 232 Q95 206 140 206 L190 206 Q226 210 240 232 Z" fill={ink} />
          <circle cx={104} cy={236} r={14} fill={design.palette[0]} stroke={ink} strokeWidth={4} />
          <circle cx={206} cy={236} r={14} fill={design.palette[0]} stroke={ink} strokeWidth={4} />
        </g>
      );
    case 'heroes':
      return (
        <g>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2;
            const a2 = ((i + 0.5) / 18) * Math.PI * 2;
            return (
              <polygon
                key={i}
                points={`150,190 ${150 + Math.cos(a) * 320},${190 + Math.sin(a) * 320} ${150 + Math.cos(a2) * 320},${190 + Math.sin(a2) * 320}`}
                fill={i % 2 ? accent : ink}
                opacity={0.14}
              />
            );
          })}
          <path d="M150 96 L226 126 L226 206 Q226 262 150 296 Q74 262 74 206 L74 126 Z" fill={design.palette[0]} stroke={accent} strokeWidth={6} />
          <path d="M150 140 L186 210 L150 190 L114 210 Z" fill={accent} />
        </g>
      );
    case 'gaming': {
      const cells: React.ReactNode[] = [];
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 10; x++) {
          if (r() > 0.62) {
            cells.push(<rect key={`${x}-${y}`} x={x * 30} y={y * 20} width={28} height={18} fill={r() > 0.5 ? accent : ink} opacity={0.35 + r() * 0.4} />);
          }
        }
      }
      return <g>{cells}<rect x={96} y={120} width={108} height={108} fill={design.palette[0]} stroke={accent} strokeWidth={6} /><rect x={120} y={144} width={22} height={22} fill={accent} /><rect x={160} y={144} width={22} height={22} fill={accent} /><rect x={120} y={190} width={62} height={14} fill={ink} /></g>;
    }
    case 'sports':
      return (
        <g>
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={i * 30} y={0} width={30} height={30} fill={i % 2 ? ink : design.palette[0]} opacity={0.9} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={i * 30} y={30} width={30} height={30} fill={i % 2 ? design.palette[0] : ink} opacity={0.9} />
          ))}
          <circle cx={150} cy={190} r={74} fill="none" stroke={accent} strokeWidth={16} />
          <circle cx={150} cy={190} r={40} fill={accent} />
        </g>
      );
    case 'music':
      return (
        <g>
          {[110, 86, 62, 38, 14].map((rad, i) => (
            <circle key={i} cx={150} cy={190} r={rad} fill={i % 2 ? design.palette[0] : accent} opacity={i === 4 ? 1 : 0.85} />
          ))}
          <circle cx={150} cy={190} r={5} fill={ink} />
          {Array.from({ length: 22 }).map((_, i) => {
            const h = 10 + r() * 46;
            return <rect key={i} x={20 + i * 12} y={300 - h} width={7} height={h} rx={3} fill={ink} opacity={0.75} />;
          })}
        </g>
      );
    case 'movies':
      return (
        <g>
          <polygon points="150,0 240,300 60,300" fill={accent} opacity={0.18} />
          <rect x={0} y={0} width={34} height={H} fill={design.palette[0]} opacity={0.9} />
          <rect x={W - 34} y={0} width={34} height={H} fill={design.palette[0]} opacity={0.9} />
          {Array.from({ length: 14 }).map((_, i) => (
            <g key={i}>
              <rect x={9} y={14 + i * 30} width={16} height={18} rx={3} fill={ink} opacity={0.8} />
              <rect x={W - 25} y={14 + i * 30} width={16} height={18} rx={3} fill={ink} opacity={0.8} />
            </g>
          ))}
          <rect x={76} y={110} width={148} height={104} fill="none" stroke={accent} strokeWidth={6} />
          <polygon points="136,138 136,186 180,162" fill={accent} />
        </g>
      );
    case 'gym':
      return (
        <g>
          {Array.from({ length: 7 }).map((_, i) => (
            <polygon key={i} points={`${-60 + i * 62},${H} ${-10 + i * 62},${H} ${150 + i * 62},0 ${100 + i * 62},0`} fill={i % 2 ? accent : ink} opacity={0.16} />
          ))}
          <rect x={34} y={176} width={232} height={14} fill={ink} />
          <rect x={52} y={140} width={22} height={86} rx={4} fill={accent} />
          <rect x={80} y={152} width={16} height={62} rx={4} fill={ink} />
          <rect x={226} y={140} width={22} height={86} rx={4} fill={accent} />
          <rect x={204} y={152} width={16} height={62} rx={4} fill={ink} />
        </g>
      );
    case 'divine':
      return (
        <g>
          <circle cx={150} cy={170} r={112} fill={accent} opacity={0.2} />
          {Array.from({ length: 12 }).map((_, i) => (
            <ellipse key={i} cx={150} cy={118} rx={16} ry={52} fill={i % 2 ? accent : ink} opacity={0.75} transform={`rotate(${i * 30} 150 170)`} />
          ))}
          <circle cx={150} cy={170} r={22} fill={design.palette[0]} stroke={accent} strokeWidth={5} />
        </g>
      );
    case 'kollywood':
    default:
      return (
        <g>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const a2 = ((i + 0.5) / 24) * Math.PI * 2;
            return (
              <polygon
                key={i}
                points={`150,300 ${150 + Math.cos(a) * 340},${300 + Math.sin(a) * 340} ${150 + Math.cos(a2) * 340},${300 + Math.sin(a2) * 340}`}
                fill={i % 2 ? accent : ink}
                opacity={0.16}
              />
            );
          })}
          <circle cx={150} cy={226} r={64} fill={accent} />
          <rect x={0} y={226} width={W} height={H} fill={design.palette[1]} />
          <rect x={0} y={226} width={W} height={6} fill={ink} opacity={0.6} />
        </g>
      );
  }
}

function wrapTitle(title: string): string[] {
  const words = title.toUpperCase().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 11 && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// ------------------------------------------------------------------------------------------------
// Tamil & Malayalam slang posters: a bold colour background, the word in huge letters, its English
// meaning underneath and a small icon. The word IS the design, so it is always drawn (even in thumbnails).
// ------------------------------------------------------------------------------------------------
function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
}

function SlangIconArt({ icon, accent, ink, bg }: { icon: string; accent: string; ink: string; bg: string }) {
  const cx = 150;
  const cy = 98;
  switch (icon) {
    case 'star':
      return <polygon points={starPoints(cx, cy, 36, 15)} fill={accent} />;
    case 'moon':
      return (
        <g>
          <circle cx={cx - 6} cy={cy} r={34} fill={accent} />
          <circle cx={cx + 10} cy={cy - 8} r={30} fill={bg} />
          <g fontFamily="'Plus Jakarta Sans', system-ui, sans-serif" fontWeight={900} fill={ink}>
            <text x={cx + 28} y={cy - 14} fontSize={24}>z</text>
            <text x={cx + 46} y={cy - 34} fontSize={32}>z</text>
          </g>
        </g>
      );
    case 'arrow':
      return (
        <g fill="none" stroke={accent} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round">
          <polyline points={`${cx - 34},${cy + 14} ${cx},${cy - 20} ${cx + 34},${cy + 14}`} />
          <polyline points={`${cx - 34},${cy + 44} ${cx},${cy + 10} ${cx + 34},${cy + 44}`} />
        </g>
      );
    case 'tea':
      return (
        <g>
          <path d={`M${cx - 30} ${cy - 16} L${cx + 26} ${cy - 16} L${cx + 19} ${cy + 36} Q${cx} ${cy + 42} ${cx - 17} ${cy + 36} Z`} fill={accent} />
          <path d={`M${cx + 26} ${cy - 4} Q${cx + 50} ${cy - 2} ${cx + 45} ${cy + 18} Q${cx + 41} ${cy + 30} ${cx + 21} ${cy + 26}`} fill="none" stroke={accent} strokeWidth={7} strokeLinecap="round" />
          <g fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" opacity={0.55}>
            <path d={`M${cx - 16} ${cy - 26} q-8 -10 0 -20 q8 -10 0 -20`} />
            <path d={`M${cx + 4} ${cy - 26} q-8 -10 0 -20 q8 -10 0 -20`} />
          </g>
        </g>
      );
    case 'plate':
      return (
        <g>
          <circle cx={cx} cy={cy} r={38} fill="none" stroke={accent} strokeWidth={9} />
          <circle cx={cx} cy={cy} r={22} fill={accent} opacity={0.4} />
        </g>
      );
    case 'drop':
      return <path d={`M${cx} ${cy - 38} C${cx} ${cy - 38} ${cx - 32} ${cy} ${cx - 32} ${cy + 20} A32 32 0 0 0 ${cx + 32} ${cy + 20} C${cx + 32} ${cy} ${cx} ${cy - 38} ${cx} ${cy - 38} Z`} fill={accent} />;
    default:
      return null;
  }
}

function SlangArt({ design, className }: { design: PosterDesign; className?: string }) {
  const [c1, c2, accent, ink] = design.palette;
  const look = design.look || 'solid';
  const lines = design.title.toUpperCase().split(' ');
  const longest = Math.max(...lines.map((l) => l.length));
  // Heavy capitals are about 0.72 of the font size wide per letter. The exact width is also set with
  // textLength below, so a word always fits the poster whatever font the device falls back to.
  const size = Math.max(40, Math.min(92, 252 / (longest * 0.72)));
  const hasIcon = !!design.icon && design.icon !== 'none';
  const firstY = lines.length === 1 ? (hasIcon ? 252 : 236) : hasIcon ? 218 : 200;
  const lastY = firstY + (lines.length - 1) * size * 0.95;
  const subY = lastY + 40;
  const font = "'Plus Jakarta Sans', 'Arial Black', system-ui, sans-serif";

  let background: React.ReactNode;
  if (look === 'stripes') {
    background = (
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={i * 60} y={0} width={60} height={H} fill={i % 2 ? c2 : c1} />
        ))}
        <rect x={0} y={firstY - size * 0.85 - 12} width={W} height={subY - firstY + size * 0.85 + 30} fill={accent} />
      </g>
    );
  } else if (look === 'split') {
    background = (
      <g>
        <rect width={150} height={H} fill={c1} />
        <rect x={150} width={150} height={H} fill={c2} />
      </g>
    );
  } else if (look === 'burst') {
    background = (
      <g>
        <rect width={W} height={H} fill={c1} />
        {Array.from({ length: 20 }).map((_, i) => {
          const a = (i / 20) * Math.PI * 2;
          const a2 = ((i + 1) / 20) * Math.PI * 2;
          return i % 2 ? null : (
            <polygon key={i} points={`150,230 ${150 + Math.cos(a) * 420},${230 + Math.sin(a) * 420} ${150 + Math.cos(a2) * 420},${230 + Math.sin(a2) * 420}`} fill={c2} />
          );
        })}
      </g>
    );
  } else if (look === 'dots') {
    const dots: React.ReactNode[] = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 12; x++) {
      const r = 2 + ((x + y) % 5) * 1.3;
      dots.push(<circle key={`${x}-${y}`} cx={x * 28 + (y % 2) * 14} cy={y * 28} r={r} fill={ink} opacity={0.14} />);
    }
    background = (<g><rect width={W} height={H} fill={c1} />{dots}</g>);
  } else {
    background = <rect width={W} height={H} fill={c1} />;
  }

  const bgForCutout = look === 'split' ? c1 : c1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={`${design.title}: ${design.subtitle}`}>
      {background}
      {hasIcon && <SlangIconArt icon={design.icon!} accent={accent} ink={ink} bg={bgForCutout} />}
      <g fontFamily={font} fontWeight={900} fill={ink} textAnchor="middle">
        {lines.map((line, i) => (
          <text key={i} x={150} y={firstY + i * size * 0.95} fontSize={size} textLength={Math.min(252, line.length * size * 0.72)} lengthAdjust="spacingAndGlyphs">
            {line}
          </text>
        ))}
        <text x={150} y={subY} fontSize={20} fontWeight={700} letterSpacing={0.5} opacity={0.9}>
          {design.subtitle}
        </text>
        <text x={150} y={H - 24} fontSize={11} fontWeight={800} letterSpacing={4} opacity={0.55}>
          {design.lang === 'ml' ? 'MALAYALAM' : 'TAMIL'}
        </text>
      </g>
    </svg>
  );
}

interface PosterArtProps {
  design: PosterDesign;
  className?: string;
  showTitle?: boolean;
}

export const PosterArt: React.FC<PosterArtProps> = ({ design, className, showTitle = true }) => {
  if (design.imageUrl) {
    return <img src={design.imageUrl} alt={design.title} className={className} style={{ objectFit: 'cover' }} />;
  }
  if (design.theme === 'slang') {
    return <SlangArt design={design} className={className} />;
  }
  const [c1, c2, , ink] = design.palette;
  const gid = `g-${design.id}`;
  const lines = wrapTitle(design.title);
  const fontSize = lines.some((l) => l.length > 9) ? 30 : 36;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={design.title}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gid})`} />
      <Motif design={design} />
      {showTitle && (
        <g fontFamily="'Plus Jakarta Sans', system-ui, sans-serif" fontWeight={800} fill={ink}>
          {lines.map((line, i) => (
            <text key={i} x={24} y={H - 28 - (lines.length - 1 - i) * (fontSize + 4)} fontSize={fontSize} letterSpacing={-0.5}>
              {line}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
};
