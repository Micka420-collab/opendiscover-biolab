'use client';

/**
 * The hero SignalScope — a 2D-canvas render of the round's fitness landscape.
 *
 * The whole search space is on screen: the curve of metric-vs-knob, coloured along the
 * aurora ramp by how close each point is to the answer, with the pass/perfect bands
 * shaded, the answer marked (a dashed target line or a glowing peak), and a live probe
 * tracking the player's dial. Left-to-right "scan" reveal is driven by `progress`.
 * A spectator watches the HUNT, not a black box.
 */

import { useEffect, useRef } from 'react';
import type { Landscape } from '../lib/landscape';
import { signalAtKnob, valueAtKnob } from '../lib/landscape';
import { scoreToColor } from '../lib/palette';

interface Props {
  landscape: Landscape;
  knob: number;
  /** 0..1 scan reveal. */
  progress: number;
  reducedMotion: boolean;
  className?: string;
}

export function SignalScope({ landscape, knob, progress, reducedMotion, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ landscape, knob, progress, reducedMotion });
  state.current = { landscape, knob, progress, reducedMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let alive = true;

    const draw = (t: number) => {
      const { landscape: land, knob: k, progress: prog, reducedMotion: reduced } = state.current;
      const parent = canvas.parentElement;
      const cssW = Math.max(120, parent?.clientWidth ?? canvas.clientWidth ?? 320);
      const cssH = Math.max(120, parent?.clientHeight ?? canvas.clientHeight ?? 220);
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const padL = 10;
      const padR = 12;
      const padT = 18;
      const padB = 22;
      const plotW = cssW - padL - padR;
      const plotH = cssH - padT - padB;
      const [kmin, kmax] = land.knobDomain;
      const [ymin, ymax] = land.yDomain;
      const kx = (kv: number) => padL + ((kv - kmin) / (kmax - kmin || 1)) * plotW;
      const vy = (vv: number) => {
        const f = (vv - ymin) / (ymax - ymin || 1);
        return padT + (1 - Math.max(0, Math.min(1, f))) * plotH;
      };

      const reveal = reduced ? 1 : Math.max(0, Math.min(1, prog));
      const revealX = padL + reveal * plotW;

      // baseline grid
      ctx.strokeStyle = 'hsl(240 6% 16% / 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      const pts = land.samples.map((s) => ({
        x: kx(s.knob),
        y: Number.isFinite(s.value) ? vy(s.value) : padT + plotH,
        signal: s.signal,
        finite: Number.isFinite(s.value),
      }));

      // clip to the revealed region so the curve "scans" in
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, revealX, cssH);
      ctx.clip();

      // pass / perfect band shading
      for (const band of land.passBands) {
        const x0 = kx(band.lo);
        const x1 = kx(band.hi);
        ctx.fillStyle = 'hsl(142 71% 45% / 0.12)';
        ctx.fillRect(Math.min(x0, x1), padT, Math.max(2, Math.abs(x1 - x0)), plotH);
      }
      for (const band of land.perfectBands) {
        const x0 = kx(band.lo);
        const x1 = kx(band.hi);
        ctx.fillStyle = 'hsl(96 80% 55% / 0.18)';
        ctx.fillRect(Math.min(x0, x1), padT, Math.max(2, Math.abs(x1 - x0)), plotH);
      }

      // area fill under the curve
      ctx.beginPath();
      ctx.moveTo(pts[0].x, padT + plotH);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(pts[pts.length - 1].x, padT + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, 'hsl(190 75% 45% / 0.22)');
      grad.addColorStop(1, 'hsl(222 55% 16% / 0.02)');
      ctx.fillStyle = grad;
      ctx.fill();

      // the curve, coloured per-segment by proximity, with a glow
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.shadowBlur = reduced ? 0 : 10;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (!a.finite || !b.finite) continue;
        const col = scoreToColor((a.signal + b.signal) / 2);
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // the marked answer
      if (land.marker) {
        if (land.marker.type === 'target') {
          const y = vy(land.marker.value);
          ctx.strokeStyle = 'hsl(142 71% 55% / 0.7)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + plotW, y);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const x = kx(land.marker.knob);
          const y = vy(land.marker.value);
          ctx.fillStyle = 'hsl(96 80% 60% / 0.95)';
          ctx.shadowBlur = reduced ? 0 : 12;
          ctx.shadowColor = 'hsl(96 80% 60%)';
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();

      // live probe (drawn only once the scan has reached it)
      if (kx(k) <= revealX + 0.5) {
        const px = kx(k);
        const liveV = valueAtKnob(land, k);
        const py = Number.isFinite(liveV) ? vy(liveV) : padT + plotH;
        const sig = signalAtKnob(land, k);
        const col = scoreToColor(sig);
        ctx.strokeStyle = 'hsl(0 0% 98% / 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        const pulse = reduced ? 0 : (Math.sin(t / 320) + 1) * 2;
        ctx.shadowBlur = reduced ? 0 : 14 + pulse;
        ctx.shadowColor = col;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'hsl(0 0% 100% / 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (alive && !reduced) raf = requestAnimationFrame(draw);
    };

    if (reducedMotion) draw(0);
    else raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={`Signal landscape for ${landscape.challenge.metricLabel}. The bright green region is the answer.`}
    />
  );
}
