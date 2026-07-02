'use client';

/**
 * The VerdictGauge — the single most room-legible spectator readout: a 270° arc that
 * fills along the aurora ramp with how close the current dial is to the answer, and
 * blooms white-hot on a confirmed LOCK. SVG + CSS transitions, so reduced-motion is
 * honoured automatically by globals.css.
 */

import { clamp01, scoreToColor } from '../lib/palette';

interface Props {
  signal: number;
  locked: boolean;
  perfect: boolean;
  children?: React.ReactNode;
}

const R = 80;
const C = 2 * Math.PI * R;
const SWEEP = 0.75; // 270°
const ARC = C * SWEEP;

export function VerdictGauge({ signal, locked, perfect, children }: Props) {
  const s = clamp01(signal);
  const color = locked ? 'hsl(140 60% 92%)' : scoreToColor(s);
  const offset = ARC * (1 - s);

  return (
    <div className="relative aspect-square w-full max-w-[280px] mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-0" aria-hidden="true">
        <title>Proximity gauge</title>
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="hsl(240 6% 16%)"
          strokeWidth="12"
          strokeDasharray={`${ARC} ${C}`}
          strokeLinecap="round"
          transform="rotate(135 100 100)"
        />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${ARC} ${C}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(135 100 100)"
          style={{
            transition: 'stroke-dashoffset 220ms ease-out, stroke 220ms ease-out',
            filter: `drop-shadow(0 0 ${locked ? 14 : 6 + s * 8}px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        {children}
        <div
          className="mt-1 text-[11px] uppercase tracking-widest font-mono"
          style={{ color }}
          aria-live="polite"
        >
          {locked ? (perfect ? 'PERFECT LOCK' : 'LOCKED') : `${Math.round(s * 100)}% signal`}
        </div>
      </div>
    </div>
  );
}
