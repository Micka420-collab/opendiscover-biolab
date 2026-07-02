'use client';

/**
 * The living Earth — a self-contained 2D-canvas dot-globe (no textures, no assets,
 * CSP-safe, no R3F/SSR risk). Every confirmed technique lights its beacon at real map
 * coordinates and adds an aurora ribbon; the ribbons' amplitude and brightness scale
 * with the AURORA index, so a fuller planet visibly glows more.
 *
 * Motion path: a single rAF loop rotates + animates. Under prefers-reduced-motion the
 * loop is disabled and a separate effect repaints once per prop change, so a newly-lit
 * beacon still appears (statically) for reduced-motion users.
 */

import { CHALLENGE_POOL } from '@/lib/lab/daily-challenge';
import { useCallback, useEffect, useRef } from 'react';
import { planetFor } from '../lib/planet';

interface Props {
  litIds: Set<string>;
  index: number;
  reducedMotion: boolean;
  /** Increments on each lock to trigger an ignition flash. */
  pulseKey: number;
  className?: string;
}

interface Dot {
  x: number;
  y: number;
  z: number;
}

/** A Fibonacci sphere of unit vectors — evenly spread, deterministic, computed once. */
function fibSphere(n: number): Dot[] {
  const pts: Dot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

/** Module-level so the 340-point sphere is built once, not on every render. */
const GLOBE_DOTS: Dot[] = fibSphere(340);

function latLonToVec(latDeg: number, lonDeg: number): Dot {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}

export function AuroraEarth({ litIds, index, reducedMotion, pulseKey, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ litIds, index, reducedMotion, pulseKey });
  const flash = useRef({ key: pulseKey, start: -1 });
  state.current = { litIds, index, reducedMotion, pulseKey };

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { litIds: lit, index: idx, reducedMotion: reduced, pulseKey: pk } = state.current;
    if (pk !== flash.current.key) flash.current = { key: pk, start: t };

    const parent = canvas.parentElement;
    const size = Math.max(140, Math.min(parent?.clientWidth ?? 260, parent?.clientHeight ?? 260));
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.4;
    const rot = reduced ? 0.6 : (t / 9000) % (Math.PI * 2);
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const project = (v: Dot) => ({
      x: v.x * cosR + v.z * sinR,
      y: v.y,
      z: -v.x * sinR + v.z * cosR,
    });

    const halo = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.35);
    halo.addColorStop(0, `hsl(142 71% 45% / ${0.04 + idx * 0.12})`);
    halo.addColorStop(1, 'hsl(142 71% 45% / 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
    ctx.fill();

    const ocean = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    ocean.addColorStop(0, 'hsl(220 45% 14%)');
    ocean.addColorStop(1, 'hsl(230 50% 7%)');
    ctx.fillStyle = ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    for (const d of GLOBE_DOTS) {
      const p = project(d);
      if (p.z <= 0) continue;
      const sx = cx + p.x * R;
      const sy = cy - p.y * R;
      const a = 0.12 + p.z * 0.33;
      ctx.fillStyle = `hsl(205 30% 65% / ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reduced && idx > 0) {
      const bands = 3;
      for (let b = 0; b < bands; b++) {
        ctx.beginPath();
        const yBase = cy - R * (0.55 + b * 0.12);
        for (let sx = cx - R; sx <= cx + R; sx += 6) {
          const dx = (sx - cx) / R;
          if (Math.abs(dx) > 1) continue;
          const wob = Math.sin(dx * 3 + t / 700 + b) * R * 0.05 * idx;
          const y = yBase + wob - Math.abs(dx) * R * 0.12;
          if (sx === cx - R) ctx.moveTo(sx, y);
          else ctx.lineTo(sx, y);
        }
        ctx.strokeStyle = `hsl(${142 - b * 20} 80% 60% / ${(0.1 + idx * 0.35) * (1 - b * 0.25)})`;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'hsl(142 80% 55%)';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    for (const c of CHALLENGE_POOL) {
      const spot = planetFor(c.id);
      const p = project(latLonToVec(spot.lat, spot.lon));
      if (p.z <= 0.02) continue;
      const sx = cx + p.x * R;
      const sy = cy - p.y * R;
      if (lit.has(c.id)) {
        ctx.fillStyle = `hsl(${spot.hue} 85% 62%)`;
        ctx.shadowBlur = reduced ? 0 : 10;
        ctx.shadowColor = `hsl(${spot.hue} 85% 62%)`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = `hsl(${spot.hue} 30% 55% / ${(0.25 + p.z * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const fl = flash.current;
    if (!reduced && fl.start >= 0) {
      const age = (t - fl.start) / 900;
      if (age < 1) {
        const a = (1 - age) * 0.5;
        ctx.strokeStyle = `hsl(140 60% 92% / ${a.toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1 + age * 0.3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const shade = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
    shade.addColorStop(0, 'hsl(230 50% 4% / 0)');
    shade.addColorStop(1, 'hsl(230 50% 4% / 0.45)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Animated rotation loop — disabled under reduced motion.
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let alive = true;
    const loop = (t: number) => {
      draw(t);
      if (alive) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion, draw]);

  // Reduced-motion (and initial) static repaint — fires when the lit set / index / pulse change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: draw reads litIds/index/pulseKey via a ref; they are listed to force a repaint when they change under reduced motion.
  useEffect(() => {
    if (!reducedMotion) return;
    draw(0);
  }, [reducedMotion, draw, litIds, index, pulseKey]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={`Earth with ${litIds.size} of ${CHALLENGE_POOL.length} discovery beacons lit (${Math.round(index * 100)}%).`}
    />
  );
}
