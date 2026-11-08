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

interface PosterArtProps {
  design: PosterDesign;
  className?: string;
  showTitle?: boolean;
}

export const PosterArt: React.FC<PosterArtProps> = ({ design, className, showTitle = true }) => {
  if (design.imageUrl) {
    return <img src={design.imageUrl} alt={design.title} className={className} style={{ objectFit: 'cover' }} />;
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
