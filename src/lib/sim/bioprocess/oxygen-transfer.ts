/**
 * Oxygen transfer and limitation in a stirred bioreactor.
 *
 * Cells need dissolved oxygen, but O2 is barely soluble in water, so in a dense
 * culture oxygen supply — not food — is usually the bottleneck. Gas transfers from
 * bubbles to liquid at rate OTR = kLa·(C* − C) (kLa the volumetric mass-transfer
 * coefficient, C* the saturation concentration, C the dissolved O2), while the cells
 * consume it at OUR (the oxygen uptake rate). With OUR roughly constant the dissolved
 * O2 obeys a linear ODE with the closed-form solution
 *
 *     C(t) = C_ss + (C0 − C_ss)·e^(−kLa·t),   C_ss = C* − OUR/kLa,
 *
 * relaxing to the steady state C_ss on a time constant 1/kLa. If kLa is too small,
 * C_ss falls below the cells' critical level and the culture becomes oxygen-limited;
 * the minimum kLa to hold DO at C_crit is kLa_crit = OUR/(C* − C_crit).
 *
 * Deterministic and closed-form. Distinct from the `bioreactor` engine (substrate–
 * biomass Monod kinetics); this is the gas–liquid mass-transfer side.
 *
 * References:
 *   - Doran, P.M. (2013) Bioprocess Engineering Principles, 2nd ed., ch. 10.
 *   - Garcia-Ochoa, F. & Gomez, E. (2009) Bioreactor scale-up and oxygen transfer
 *     rate in microbial processes. Biotechnology Advances 27:153-176.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Volumetric oxygen mass-transfer coefficient kLa (1/h). */
    kLa: z.number().positive().max(100_000).default(100),
    /** Saturation dissolved-O2 concentration C* (mg/L) — ~8 mg/L for air/water at 25°C. */
    saturationDO: z.number().positive().max(1000).default(8),
    /** Oxygen uptake rate OUR = qO2·X (mg/L/h). */
    our: z.number().min(0).max(1_000_000).default(400),
    /** Initial dissolved O2 (mg/L). */
    initialDO: z.number().min(0).max(1000).default(8),
    /** Critical dissolved O2 below which the culture is O2-limited (mg/L). */
    criticalDO: z.number().min(0).max(1000).default(1),
    /** Simulated duration (h) — the response is fast (~1/kLa). */
    tEnd: z.number().positive().max(100).default(0.2),
    /** Points in the plotted DO curve. */
    outputPoints: z.number().int().min(2).max(4000).default(200),
  })
  .strict()
  .refine((p) => p.criticalDO < p.saturationDO, {
    message: 'criticalDO must be below the saturation concentration',
  });

export type OxygenTransferParams = z.infer<typeof paramsSchema>;

export function run(rawParams: Partial<OxygenTransferParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const cStar = p.saturationDO;

  // Mathematical steady state (may be negative → oxygen-limited); the achievable DO
  // clamps at zero.
  const rawSteadyState = cStar - p.our / p.kLa;
  const steadyStateDO = Math.max(0, rawSteadyState);
  const oxygenLimited = rawSteadyState < p.criticalDO;
  // Minimum kLa needed to hold dissolved O2 at the critical level.
  const criticalKLa = p.our / (cStar - p.criticalDO);
  const timeConstant = 1 / p.kLa;

  const conc = (t: number) => {
    const c = rawSteadyState + (p.initialDO - rawSteadyState) * Math.exp(-p.kLa * t);
    return Math.min(cStar, Math.max(0, c)); // dissolved O2 is physically in [0, C*]
  };

  const metrics: Metric[] = [
    {
      key: 'steadyStateDO',
      label: 'Steady-state dissolved O₂',
      value: steadyStateDO,
      unit: 'mg/L',
      note: 'C* − OUR/kLa (clamped ≥ 0)',
    },
    {
      key: 'percentSaturation',
      label: 'Steady-state % of air saturation',
      value: (100 * steadyStateDO) / cStar,
      unit: '%',
    },
    {
      key: 'oxygenLimited',
      label: 'Oxygen-limited',
      value: oxygenLimited ? 1 : 0,
      note: '1 = steady-state DO is below the critical level',
    },
    {
      key: 'criticalKLa',
      label: 'Critical kLa',
      value: criticalKLa,
      unit: '1/h',
      note: 'OUR/(C* − C_crit): the minimum kLa to hold DO at C_crit',
    },
    {
      key: 'responseTimeConstant',
      label: 'DO response time constant',
      value: timeConstant,
      unit: 'h',
      note: '1/kLa',
    },
    {
      key: 'otrAtSteadyState',
      label: 'Steady-state O₂ transfer rate',
      value: oxygenLimited ? p.kLa * cStar : p.our,
      unit: 'mg/L/h',
      note: 'balances OUR when not limited',
    },
    { key: 'kLa', label: 'Mass-transfer coefficient kLa', value: p.kLa, unit: '1/h' },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.tEnd * i) / (n - 1));
  const series: Series[] = [
    {
      x: times,
      y: { dissolvedO2: times.map(conc) },
      xLabel: 'time (h)',
      yLabel: 'dissolved O₂ (mg/L)',
    },
  ];

  return {
    engine: 'oxygen-transfer',
    summary: oxygenLimited
      ? `Oxygen transfer: OXYGEN-LIMITED — kLa=${p.kLa}/h cannot meet OUR=${p.our} mg/L/h (need kLa ≥ ${criticalKLa.toFixed(0)}/h); DO crashes below C_crit.`
      : `Oxygen transfer: dissolved O₂ settles at ${steadyStateDO.toFixed(2)} mg/L (${((100 * steadyStateDO) / cStar).toFixed(0)}% saturation) on a ${(60 * timeConstant).toFixed(1)}-min time constant.`,
    metrics,
    series,
    detail: { steadyStateDO, oxygenLimited, criticalKLa, timeConstant },
    provenance: provenance('oxygen-transfer', '1.0.0', p),
  };
}

export const spec: EngineSpec<OxygenTransferParams> = {
  slug: 'oxygen-transfer',
  title: 'Oxygen Transfer & Limitation (kLa)',
  domain: 'bioprocess',
  version: '1.0.0',
  description:
    "Gas–liquid oxygen transfer in a stirred bioreactor: dissolved O2 obeys dC/dt = kLa(C*−C) − OUR with the closed-form solution C(t)=C_ss+(C0−C_ss)e^(−kLa·t) relaxing to C_ss=C*−OUR/kLa on a 1/kLa time constant. Reports the steady-state dissolved O2 and % saturation, whether the culture is oxygen-limited, and the critical kLa=OUR/(C*−C_crit) — the minimum transfer needed to keep cells breathing. The mass-transfer side of scale-up, distinct from the bioreactor engine's substrate–biomass kinetics.",
  references: [
    'Doran, P.M. (2013) Bioprocess Engineering Principles, 2nd ed. Academic Press (ch. 10).',
    'Garcia-Ochoa, F. & Gomez, E. (2009) Bioreactor scale-up and oxygen transfer rate in microbial processes. Biotechnology Advances 27:153-176.',
  ],
  paramsSchema: paramsSchema as z.ZodType<OxygenTransferParams>,
  run,
  example: paramsSchema.parse({ kLa: 100, saturationDO: 8, our: 400, initialDO: 8 }),
  tags: ['bioprocess', 'oxygen-transfer', 'kLa', 'dissolved-oxygen', 'scale-up', 'fermentation'],
};

export default spec;
