/**
 * Beer–Lambert spectrophotometry — mixing and un-mixing two absorbers.
 *
 * Each species has a Gaussian absorption band  ε_i(λ) = εmax_i·exp(−½((λ−λ_i)/w_i)²),
 * and by the Beer–Lambert law the absorbances of a mixture simply add:
 *
 *     A(λ) = l · Σ c_i·ε_i(λ),      transmittance  T = 10^(−A).
 *
 * The forward problem draws the mixture spectrum. The inverse problem — the real work
 * of quantitative spectrophotometry — recovers the concentrations from that spectrum
 * by least squares: with the design matrix E (rows = wavelengths, E[j][i]=l·ε_i(λ_j))
 * the fit is the normal-equations solution c = (EᵀE)⁻¹EᵀA, here a 2×2 system solved
 * in closed form by Cramer's rule. Because EᵀE is a Gram matrix it is positive
 * semidefinite; a tiny ridge keeps the solve finite even when the two bands are so
 * similar that only their combined signal is identifiable (flagged, not divided by 0).
 *
 * Deterministic and closed-form. The un-mixing recovers the true concentrations
 * exactly on noiseless data — a built-in self-check.
 *
 * References:
 *   - Ingle, J.D. & Crouch, S.R. (1988) Spectrochemical Analysis. Prentice Hall.
 *   - Skoog, D.A., Holler, F.J. & Crouch, S.R. (2017) Principles of Instrumental
 *     Analysis, 7th ed. (ch. 13, molecular absorption spectrometry).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Component 1 peak molar absorptivity (absorbance per concentration unit per cm). */
    eMax1: z.number().positive().max(1e6).default(0.02),
    /** Component 1 absorption-peak wavelength (nm). */
    peak1: z.number().min(1).max(2000).default(450),
    /** Component 1 band width σ (nm). */
    width1: z.number().positive().max(1000).default(30),
    /** Component 1 concentration. */
    conc1: z.number().min(0).max(1e6).default(20),
    /** Component 2 peak molar absorptivity. */
    eMax2: z.number().positive().max(1e6).default(0.025),
    /** Component 2 absorption-peak wavelength (nm). */
    peak2: z.number().min(1).max(2000).default(550),
    /** Component 2 band width σ (nm). */
    width2: z.number().positive().max(1000).default(40),
    /** Component 2 concentration. */
    conc2: z.number().min(0).max(1e6).default(15),
    /** Cuvette path length l (cm). */
    pathLength: z.number().min(1e-9).max(100).default(1),
    /** Low end of the scanned wavelength range (nm). */
    lambdaMin: z.number().min(1).max(2000).default(400),
    /** High end of the scanned wavelength range (nm). */
    lambdaMax: z.number().min(1).max(2000).default(700),
    /** Wavelength (nm) at which to report the absorbance readout. */
    readoutWavelength: z.number().min(1).max(2000).default(550),
    /** Points in the plotted spectrum (and rows of the un-mixing fit). */
    outputPoints: z.number().int().min(4).max(4000).default(300),
  })
  .strict()
  .refine((p) => p.lambdaMax > p.lambdaMin, {
    message: 'lambdaMax must be greater than lambdaMin',
  });

export type BeerLambertParams = z.infer<typeof paramsSchema>;

/** Gaussian molar absorptivity ε(λ) = εmax·exp(−½((λ−peak)/width)²). */
export function absorptivity(lambda: number, eMax: number, peak: number, width: number): number {
  const z0 = (lambda - peak) / width;
  return eMax * Math.exp(-0.5 * z0 * z0);
}

export interface Unmix {
  c1: number;
  c2: number;
  wellConditioned: boolean;
}

/**
 * Recover the two concentrations from a mixture spectrum by least squares (2×2 normal
 * equations, Cramer's rule, ridge-stabilized). `e1`/`e2` are the per-wavelength
 * absorptivities×pathLength (columns of the design matrix); `a` is the measured
 * absorbance at each wavelength.
 */
export function unmix(e1: number[], e2: number[], a: number[]): Unmix {
  let aa = 0;
  let bb = 0;
  let dd = 0;
  let p = 0;
  let q = 0;
  for (let j = 0; j < a.length; j++) {
    const e1j = e1[j] ?? 0;
    const e2j = e2[j] ?? 0;
    const aj = a[j] ?? 0;
    aa += e1j * e1j;
    bb += e1j * e2j;
    dd += e2j * e2j;
    p += e1j * aj;
    q += e2j * aj;
  }
  const det = aa * dd - bb * bb; // ≥ 0 (Gram matrix)
  // Scale-invariant conditioning: det/(aa·dd) = sin²(angle) between the two spectral
  // columns e1,e2. Compare against the Gram scale aa·dd itself — NOT an absolute floor —
  // so weak (low-absorptivity) but well-separated bands are not mislabelled unresolvable.
  const wellConditioned = aa * dd > 0 && det > 1e-6 * aa * dd;
  // Ridge (relative to the matrix scale) keeps the solve finite when the two bands are
  // (nearly) collinear, without an absolute floor that would bias small-signal fits.
  const scale = Math.max(aa, dd);
  const ridge = scale > 0 ? 1e-9 * scale : 1e-12;
  const aR = aa + ridge;
  const dR = dd + ridge;
  const detR = aR * dR - bb * bb;
  const c1 = (p * dR - q * bb) / detR;
  const c2 = (aR * q - bb * p) / detR;
  return { c1, c2, wellConditioned };
}

export function run(rawParams: Partial<BeerLambertParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const n = p.outputPoints;

  const lambdas = Array.from(
    { length: n },
    (_, i) => p.lambdaMin + ((p.lambdaMax - p.lambdaMin) * i) / (n - 1),
  );
  const e1 = lambdas.map((l) => p.pathLength * absorptivity(l, p.eMax1, p.peak1, p.width1));
  const e2 = lambdas.map((l) => p.pathLength * absorptivity(l, p.eMax2, p.peak2, p.width2));
  const comp1 = e1.map((e) => e * p.conc1);
  const comp2 = e2.map((e) => e * p.conc2);
  const total = comp1.map((a, j) => a + (comp2[j] ?? 0));

  // Un-mix: recover the concentrations from the mixture spectrum.
  const rec = unmix(e1, e2, total);

  // Peak absorbance and its wavelength.
  let peakA = Number.NEGATIVE_INFINITY;
  let peakLambda = lambdas[0] ?? 0;
  for (let j = 0; j < n; j++) {
    if ((total[j] ?? 0) > peakA) {
      peakA = total[j] ?? 0;
      peakLambda = lambdas[j] ?? 0;
    }
  }
  const absorbanceAtReadout =
    p.pathLength *
    (p.conc1 * absorptivity(p.readoutWavelength, p.eMax1, p.peak1, p.width1) +
      p.conc2 * absorptivity(p.readoutWavelength, p.eMax2, p.peak2, p.width2));
  const minTransmittancePct = 100 * 10 ** -peakA;

  const metrics: Metric[] = [
    {
      key: 'recoveredConc1',
      label: 'Recovered concentration (component 1)',
      value: rec.c1,
      note: 'least-squares un-mixing',
    },
    { key: 'recoveredConc2', label: 'Recovered concentration (component 2)', value: rec.c2 },
    { key: 'peakAbsorbance', label: 'Peak absorbance', value: peakA },
    { key: 'peakWavelength', label: 'Wavelength of peak', value: peakLambda, unit: 'nm' },
    {
      key: 'absorbanceAtReadout',
      label: `Absorbance at ${p.readoutWavelength} nm`,
      value: absorbanceAtReadout,
    },
    {
      key: 'minTransmittancePct',
      label: 'Minimum % transmittance',
      value: minTransmittancePct,
      unit: '%',
      note: '100·10^(−A_peak)',
    },
    {
      key: 'wellConditioned',
      label: 'Spectra separable',
      value: rec.wellConditioned ? 1 : 0,
      note: rec.wellConditioned ? 'concentrations are identifiable' : 'bands too similar to un-mix',
    },
  ];

  const series: Series[] = [
    {
      x: lambdas,
      y: { absorbance: total, component1: comp1, component2: comp2 },
      xLabel: 'wavelength (nm)',
      yLabel: 'absorbance',
    },
  ];

  return {
    engine: 'beer-lambert',
    summary: `Beer–Lambert: peak absorbance ${peakA.toFixed(3)} at ${peakLambda.toFixed(0)} nm (${minTransmittancePct.toFixed(1)}% T); un-mixed to c₁=${rec.c1.toFixed(2)}, c₂=${rec.c2.toFixed(2)}${rec.wellConditioned ? '' : ' (spectra too similar — combined signal only)'}.`,
    metrics,
    series,
    detail: {
      recoveredConc1: rec.c1,
      recoveredConc2: rec.c2,
      peakAbsorbance: peakA,
      peakWavelength: peakLambda,
      wellConditioned: rec.wellConditioned,
    },
    provenance: provenance('beer-lambert', '1.0.0', p),
  };
}

export const spec: EngineSpec<BeerLambertParams> = {
  slug: 'beer-lambert',
  title: 'Beer–Lambert Spectrophotometry (two-component un-mixing)',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    "Beer–Lambert absorption of a two-component mixture: each species is a Gaussian band ε(λ)=εmax·exp(−½((λ−λ₀)/w)²) and absorbances add, A(λ)=l·Σc_i·ε_i(λ), with transmittance T=10^(−A). Draws the mixture spectrum and its component contributions, and solves the INVERSE problem — recovering the two concentrations from the spectrum by least squares (2×2 normal equations, Cramer's rule, ridge-stabilized), the everyday task of quantitative spectrophotometry. Flags when the two bands are too similar to separate. Closed-form and deterministic; the un-mixing recovers the true concentrations on noiseless data.",
  references: [
    'Ingle, J.D. & Crouch, S.R. (1988) Spectrochemical Analysis. Prentice Hall.',
    'Skoog, D.A., Holler, F.J. & Crouch, S.R. (2017) Principles of Instrumental Analysis, 7th ed. Cengage.',
  ],
  paramsSchema: paramsSchema as z.ZodType<BeerLambertParams>,
  run,
  example: paramsSchema.parse({}),
  tags: ['biochemistry', 'spectrophotometry', 'beer-lambert', 'absorbance', 'un-mixing'],
};

export default spec;
