/**
 * van Deemter — the plate-height / efficiency curve of a chromatography column.
 *
 * A chromatographic peak broadens as it travels, and the "height equivalent to a
 * theoretical plate" H measures that broadening per unit length: smaller H means sharper
 * peaks and a more efficient separation. Three effects add up as a function of the
 * mobile-phase velocity u:
 *
 *     H(u) = A + B/u + C·u,
 *
 * where A is eddy diffusion (flow paths of different length), B/u is longitudinal
 * diffusion (worse when the analyte lingers, i.e. at low u), and C·u is resistance to
 * mass transfer (worse at high u). The two velocity terms pull in opposite directions, so
 * there is a sweet-spot velocity that minimises H — found in closed form by setting
 * dH/du = −B/u² + C = 0:
 *
 *     u_opt = √(B/C),      H_min = A + 2·√(B·C).
 *
 * Run fast and mass transfer smears the peak; run slow and diffusion does; the optimum
 * balances them. Reports the optimum, the plate height and plates-per-metre at the chosen
 * velocity, and the full van Deemter curve. Closed-form and deterministic.
 *
 * References:
 *   - van Deemter, J.J., Zuiderweg, F.J. & Klinkenberg, A. (1956) Longitudinal diffusion
 *     and resistance to mass transfer as causes of nonideality in chromatography. Chem.
 *     Eng. Sci. 5:271-289.
 *   - Giddings, J.C. (1991) Unified Separation Science. Wiley.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Eddy-diffusion term A (mm) — the velocity-independent floor. */
    aTerm: z.number().min(0).max(100).default(0.5),
    /** Longitudinal-diffusion term B (mm·mm/s) — dominates at low velocity. */
    bTerm: z.number().min(1e-6).max(1e4).default(2),
    /** Mass-transfer term C (mm·s/mm) — dominates at high velocity. Lower bound keeps
     * u_opt=√(B/C) finite. */
    cTerm: z.number().min(1e-6).max(1e4).default(0.05),
    /** Mobile-phase velocity u at which to report the plate height (mm/s). */
    velocity: z.number().min(1e-6).max(1e4).default(2),
    /** Column length L (mm), for the plate-count N = L/H. */
    columnLength: z.number().positive().max(1e6).default(100),
    /** Highest velocity plotted (mm/s). Lower bound keeps B/uMin finite in the curve. */
    velocityMax: z.number().min(1e-3).max(1e4).default(12),
    /** Points in the plotted van Deemter curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type VanDeemterParams = z.infer<typeof paramsSchema>;

/** Plate height H(u) = A + B/u + C·u (mm). u must be > 0. */
export function plateHeight(u: number, a: number, b: number, c: number): number {
  return a + b / u + c * u;
}

export function run(rawParams: Partial<VanDeemterParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { aTerm: a, bTerm: b, cTerm: c } = p;

  // Closed-form optimum from dH/du = −B/u² + C = 0. Compute as √B/√C (not √(B/C)) so the
  // intermediate ratio cannot overflow to Infinity for extreme B/C.
  const uOpt = Math.sqrt(b) / Math.sqrt(c);
  const hMin = a + 2 * Math.sqrt(b * c);
  const hAtU = plateHeight(p.velocity, a, b, c);
  const platesPerMetre = 1000 / hAtU; // H in mm → plates per 1000 mm
  const plateCount = p.columnLength / hAtU; // N = L / H
  const efficiencyVsOptimum = hMin / hAtU; // ≤ 1, =1 only at u_opt

  const metrics: Metric[] = [
    {
      key: 'optimalVelocity',
      label: 'Optimal velocity u_opt',
      value: uOpt,
      unit: 'mm/s',
      note: '√(B/C): sharpest peaks here',
    },
    {
      key: 'minPlateHeight',
      label: 'Minimum plate height H_min',
      value: hMin,
      unit: 'mm',
      note: 'A + 2√(B·C)',
    },
    {
      key: 'plateHeightAtU',
      label: `Plate height at ${p.velocity} mm/s`,
      value: hAtU,
      unit: 'mm',
      note: 'A + B/u + C·u',
    },
    {
      key: 'plateCount',
      label: 'Theoretical plates N',
      value: plateCount,
      note: 'N = L / H (higher = better resolution)',
    },
    {
      key: 'platesPerMetre',
      label: 'Plates per metre',
      value: platesPerMetre,
      unit: '/m',
    },
    {
      key: 'efficiencyVsOptimum',
      label: 'Efficiency vs optimum',
      value: efficiencyVsOptimum,
      note: 'H_min / H(u); 1.0 at the optimal velocity',
    },
  ];

  const n = p.outputPoints;
  // Start just above 0 to avoid the B/u singularity at u = 0.
  const uMin = p.velocityMax / (2 * n);
  const velocities = Array.from(
    { length: n },
    (_, i) => uMin + ((p.velocityMax - uMin) * i) / (n - 1),
  );
  const series: Series[] = [
    {
      x: velocities,
      y: { plateHeight: velocities.map((u) => plateHeight(u, a, b, c)) },
      xLabel: 'mobile-phase velocity u (mm/s)',
      yLabel: 'plate height H (mm)',
    },
  ];

  return {
    engine: 'van-deemter',
    summary: `van Deemter: sharpest peaks at u_opt=${uOpt.toFixed(2)} mm/s (H_min=${hMin.toFixed(3)} mm); at u=${p.velocity} mm/s H=${hAtU.toFixed(3)} mm → ${plateCount.toFixed(0)} plates over ${p.columnLength} mm (${(100 * efficiencyVsOptimum).toFixed(0)}% of peak efficiency).`,
    metrics,
    series,
    detail: { optimalVelocity: uOpt, minPlateHeight: hMin, plateHeightAtU: hAtU, plateCount },
    provenance: provenance('van-deemter', '1.0.0', p),
  };
}

export const spec: EngineSpec<VanDeemterParams> = {
  slug: 'van-deemter',
  title: 'van Deemter Chromatography Efficiency',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    'The efficiency curve of a chromatography column: the plate height H(u)=A+B/u+C·u trades eddy diffusion (A), longitudinal diffusion (B/u, worst at low velocity) and mass-transfer resistance (C·u, worst at high velocity) as a function of mobile-phase velocity u. The opposing velocity terms give a closed-form optimum u_opt=√(B/C) with minimum plate height H_min=A+2√(B·C) — the fastest run that still gives sharp peaks. Reports the optimum, the plate height and theoretical-plate count N=L/H at a chosen velocity, the efficiency versus optimum, and the full van Deemter curve. Closed-form and deterministic.',
  references: [
    'van Deemter, J.J., Zuiderweg, F.J. & Klinkenberg, A. (1956) Longitudinal diffusion and resistance to mass transfer as causes of nonideality in chromatography. Chem. Eng. Sci. 5:271-289.',
    'Giddings, J.C. (1991) Unified Separation Science. Wiley.',
  ],
  paramsSchema: paramsSchema as z.ZodType<VanDeemterParams>,
  run,
  example: paramsSchema.parse({ aTerm: 0.5, bTerm: 2, cTerm: 0.05, velocity: 2 }),
  tags: ['biochemistry', 'chromatography', 'van-deemter', 'plate-height', 'separation', 'hplc'],
};

export default spec;
