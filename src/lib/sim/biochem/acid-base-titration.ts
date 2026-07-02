/**
 * Acid–base titration curve — a weak monoprotic acid titrated with strong base.
 *
 * Add strong base (concentration Cb) a little at a time to a weak acid HA (initial
 * concentration Ca, volume Va) and read the pH after each addition. At every added
 * volume Vb the hydrogen-ion concentration h = [H⁺] satisfies the exact charge
 * balance
 *
 *     [Na⁺] + h = Kw/h + [A⁻],
 *
 * with [Na⁺] = Cb·Vb/Vt, [A⁻] = (Ca·Va/Vt)·Ka/(Ka+h), Vt = Va+Vb, Kw = 1e-14. The
 * left side rises and the right falls with h, so the balance has a single root, found
 * here by bracketed geometric bisection (robust across the whole pH range — pH is
 * linear in log h). Converting, pH = −log₁₀ h.
 *
 * The curve has the classic shape: a buffer plateau where pH ≈ pKa (exactly pKa at
 * half-equivalence, by Henderson–Hasselbalch), a steep jump at the equivalence volume
 * Veq = Ca·Va/Cb, and — because the conjugate base A⁻ is itself basic — an equivalence
 * pH above 7.
 *
 * Deterministic; every pH comes from a converged bracketed solve (no fixed-point).
 *
 * References:
 *   - Harris, D.C. (2015) Quantitative Chemical Analysis, 9th ed. W.H. Freeman.
 *   - Skoog, D.A., West, D.M., Holler, F.J. & Crouch, S.R. (2013) Fundamentals of
 *     Analytical Chemistry, 9th ed. Brooks/Cole.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

const KW = 1e-14;

export const paramsSchema = z
  .object({
    /** Acid dissociation constant as pKa (Ka = 10^(−pKa)). */
    pKa: z.number().min(0).max(14).default(4.76),
    /** Initial concentration of the weak acid (mol/L). */
    acidConc: z.number().min(1e-6).max(10).default(0.1),
    /** Initial volume of the acid solution (mL). */
    acidVolume: z.number().positive().max(1e5).default(25),
    /** Concentration of the strong-base titrant (mol/L). */
    baseConc: z.number().min(1e-6).max(10).default(0.1),
    /** Points in the plotted titration curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type AcidBaseTitrationParams = z.infer<typeof paramsSchema>;

/**
 * Solve the charge balance [Na⁺] + h = Kw/h + cAcid·Ka/(Ka+h) for h = [H⁺] by
 * bracketed geometric bisection. The residual is monotone increasing in h, so a
 * single root is bracketed by [1e-15, 10] (pH ≈ 15 down to −1).
 */
export function solveProton(cNa: number, cAcid: number, ka: number): number {
  const f = (h: number) => cNa + h - KW / h - (cAcid * ka) / (ka + h);
  let lo = 1e-15;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi); // geometric midpoint — pH is linear in log h
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/** pH after adding `vb` mL of titrant. */
export function phAtVolume(p: AcidBaseTitrationParams, ka: number, vb: number): number {
  const vt = p.acidVolume + vb;
  const cNa = (p.baseConc * vb) / vt;
  const cAcid = (p.acidConc * p.acidVolume) / vt;
  return -Math.log10(solveProton(cNa, cAcid, ka));
}

export function run(rawParams: Partial<AcidBaseTitrationParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const ka = 10 ** -p.pKa;
  const equivalenceVolume = (p.acidConc * p.acidVolume) / p.baseConc; // Ca·Va/Cb

  const ph = (vb: number) => phAtVolume(p, ka, vb);
  const initialPH = ph(0);
  const phAtHalfEquivalence = ph(equivalenceVolume / 2);
  const phAtEquivalence = ph(equivalenceVolume);

  const metrics: Metric[] = [
    { key: 'pKa', label: 'pKa', value: p.pKa },
    {
      key: 'equivalenceVolume',
      label: 'Equivalence volume',
      value: equivalenceVolume,
      unit: 'mL',
      note: 'Ca·Va/Cb',
    },
    {
      key: 'phAtHalfEquivalence',
      label: 'pH at half-equivalence',
      value: phAtHalfEquivalence,
      note: '≈ pKa (Henderson–Hasselbalch)',
    },
    {
      key: 'phAtEquivalence',
      label: 'pH at the equivalence point',
      value: phAtEquivalence,
      note: '> 7 for a weak acid + strong base',
    },
    { key: 'initialPH', label: 'Initial pH', value: initialPH },
    {
      key: 'bufferLow',
      label: 'Buffer range (low)',
      value: p.pKa - 1,
      note: 'pKa − 1: useful buffering from here…',
    },
    { key: 'bufferHigh', label: 'Buffer range (high)', value: p.pKa + 1, note: '…to pKa + 1' },
  ];

  const n = p.outputPoints;
  const vMax = 2 * equivalenceVolume;
  const volumes = Array.from({ length: n }, (_, i) => (vMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: volumes,
      y: { pH: volumes.map(ph) },
      xLabel: 'titrant added (mL)',
      yLabel: 'pH',
    },
  ];

  return {
    engine: 'acid-base-titration',
    summary: `Titration of ${p.acidConc} M weak acid (pKa ${p.pKa}) with ${p.baseConc} M base: buffers near pH ${p.pKa} at half-equivalence, jumps through the equivalence point at ${equivalenceVolume.toFixed(1)} mL (pH ${phAtEquivalence.toFixed(2)}).`,
    metrics,
    series,
    detail: { equivalenceVolume, phAtHalfEquivalence, phAtEquivalence, initialPH },
    provenance: provenance('acid-base-titration', '1.0.0', p),
  };
}

export const spec: EngineSpec<AcidBaseTitrationParams> = {
  slug: 'acid-base-titration',
  title: 'Acid–Base Titration Curve (weak acid)',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    'The titration curve of a weak monoprotic acid with strong base: pH versus titrant volume, computed from the exact charge balance [Na⁺]+[H⁺]=Kw/[H⁺]+[A⁻] solved for [H⁺] at each addition by bracketed bisection. Reports the equivalence volume Ca·Va/Cb, the pH at half-equivalence (= pKa, the buffer plateau), the equivalence-point pH (> 7 because the conjugate base is itself basic), the initial pH, and the pKa±1 buffer range. Deterministic and exact — the pedagogical burette experiment.',
  references: [
    'Harris, D.C. (2015) Quantitative Chemical Analysis, 9th ed. W.H. Freeman.',
    'Skoog, D.A., West, D.M., Holler, F.J. & Crouch, S.R. (2013) Fundamentals of Analytical Chemistry, 9th ed. Brooks/Cole.',
  ],
  paramsSchema: paramsSchema as z.ZodType<AcidBaseTitrationParams>,
  run,
  example: paramsSchema.parse({ pKa: 4.76, acidConc: 0.1, acidVolume: 25, baseConc: 0.1 }),
  tags: ['biochemistry', 'titration', 'pH', 'pKa', 'buffer', 'equivalence-point'],
};

export default spec;
