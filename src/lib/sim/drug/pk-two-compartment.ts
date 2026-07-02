/**
 * Two-compartment pharmacokinetics — IV bolus.
 *
 * After an intravenous bolus, a drug does not just decay in the blood: it also
 * distributes into peripheral tissue and comes back. The body is modelled as a
 * central compartment (blood + well-perfused organs, volume V1) exchanging with a
 * peripheral one (volume V2), with the drug cleared only from the central one:
 *
 *     dA1/dt = −(k10 + k12)·A1 + k21·A2      (central amount)
 *     dA2/dt =  k12·A1 − k21·A2              (peripheral amount)
 *
 * in the standard clinical parameterization k10 = CL/V1, k12 = Q/V1, k21 = Q/V2,
 * where CL is clearance and Q the intercompartmental clearance. The plasma
 * concentration C = A1/V1 is the exact bi-exponential
 *
 *     C(t) = (Dose/V1) · [ (α−k21)/(α−β)·e^(−αt) + (k21−β)/(α−β)·e^(−βt) ],
 *
 * with the hybrid rate constants α > β the roots of λ² − (k10+k12+k21)λ + k10·k21.
 * α is the fast distribution phase, β the slow terminal-elimination phase.
 *
 * Deterministic and analytic: the closed form is evaluated directly (no integrator),
 * so results are exact. Requiring Q > 0 keeps α, β real, distinct and positive, so
 * the model is always well-posed (α−β = √((k10+k12+k21)²−4k10k21) > 0).
 *
 * References:
 *   - Gibaldi, M. & Perrier, D. (1982) Pharmacokinetics, 2nd ed. Marcel Dekker.
 *   - Rowland, M. & Tozer, T.N. (2011) Clinical Pharmacokinetics and
 *     Pharmacodynamics, 4th ed. Lippincott Williams & Wilkins.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** IV bolus dose (mg). */
    dose: z.number().positive().default(100),
    /** Central volume of distribution V1 (L). */
    v1: z.number().positive().default(10),
    /** Clearance CL (L/h) — drug removed from the central compartment. */
    cl: z.number().positive().default(5),
    /** Intercompartmental clearance Q (L/h). Must be > 0 for a real 2-compartment model. */
    q: z.number().positive().default(10),
    /** Peripheral volume of distribution V2 (L). */
    v2: z.number().positive().default(20),
    /** Simulated duration (h). */
    tEnd: z.number().positive().max(100_000).default(24),
    /** Points in the plotted concentration curve (>= 2). */
    outputPoints: z.number().int().min(2).max(4000).default(300),
  })
  .strict();

export type PkTwoCompartmentParams = z.infer<typeof paramsSchema>;

export interface HybridConstants {
  /** Micro-rate constants. */
  k10: number;
  k12: number;
  k21: number;
  /** Fast (distribution) hybrid rate constant. */
  alpha: number;
  /** Slow (terminal elimination) hybrid rate constant. */
  beta: number;
}

/** Derive the micro-rate constants and hybrid constants α > β from CL/V parameters. */
export function hybridConstants(p: PkTwoCompartmentParams): HybridConstants {
  const k10 = p.cl / p.v1;
  const k12 = p.q / p.v1;
  const k21 = p.q / p.v2;
  const sum = k10 + k12 + k21;
  // Discriminant is strictly positive because k12 = Q/V1 > 0:
  //   (k10+k12+k21)² − 4·k10·k21 = (k10−k21)² + k12·(k12+2k10+2k21) > 0.
  const disc = Math.sqrt(sum * sum - 4 * k10 * k21);
  const alpha = (sum + disc) / 2;
  const beta = (sum - disc) / 2;
  return { k10, k12, k21, alpha, beta };
}

const LN2 = Math.log(2);

export function run(rawParams: Partial<PkTwoCompartmentParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { k10, k12, k21, alpha, beta } = hybridConstants(p);

  const c0 = p.dose / p.v1; // Cmax for a bolus, at t = 0
  const span = alpha - beta; // > 0
  const coefA = (alpha - k21) / span;
  const coefB = (k21 - beta) / span;

  const central = (t: number) => c0 * (coefA * Math.exp(-alpha * t) + coefB * Math.exp(-beta * t));
  // Peripheral concentration C2 = A2/V2, A2(t) = D·k12/(α−β)·(e^−βt − e^−αt).
  const peripheral = (t: number) =>
    ((p.dose * k12) / (p.v2 * span)) * (Math.exp(-beta * t) - Math.exp(-alpha * t));

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.tEnd * i) / (n - 1));
  const centralSeries = times.map(central);
  const peripheralSeries = times.map(peripheral);

  const terminalHalfLife = LN2 / beta;
  const distributionHalfLife = LN2 / alpha;
  const auc = p.dose / p.cl; // AUC(0→∞) = Dose / CL, exact
  const vss = p.v1 + p.v2; // volume of distribution at steady state
  const peripheralTmax = Math.log(alpha / beta) / span; // time of peak tissue level

  const metrics: Metric[] = [
    { key: 'cmax', label: 'Peak plasma conc Cmax', value: c0, note: 'Dose/V1 at t=0 (bolus)' },
    { key: 'alpha', label: 'Distribution rate α', value: alpha, note: '1/h (fast phase)' },
    { key: 'beta', label: 'Terminal rate β', value: beta, note: '1/h (slow phase)' },
    {
      key: 'terminalHalfLife',
      label: 'Terminal half-life t½β',
      value: terminalHalfLife,
      note: 'ln2/β (h)',
    },
    {
      key: 'distributionHalfLife',
      label: 'Distribution half-life t½α',
      value: distributionHalfLife,
      note: 'ln2/α (h)',
    },
    { key: 'auc', label: 'AUC(0→∞)', value: auc, note: 'Dose/CL (mg·h/L)' },
    { key: 'vss', label: 'Volume of distribution at steady state', value: vss, note: 'V1+V2 (L)' },
    {
      key: 'peripheralTmax',
      label: 'Time of peak tissue level',
      value: peripheralTmax,
      note: 'ln(α/β)/(α−β) (h)',
    },
  ];

  const series: Series[] = [
    {
      x: times,
      y: { central: centralSeries, peripheral: peripheralSeries },
      xLabel: 'time (h)',
      yLabel: 'concentration (mg/L)',
    },
  ];

  return {
    engine: 'pk-two-compartment',
    summary: `Two-compartment IV bolus: Cmax=${c0.toFixed(2)} mg/L, distributes with t½α=${distributionHalfLife.toFixed(2)} h then clears with terminal t½β=${terminalHalfLife.toFixed(2)} h; AUC=${auc.toFixed(1)} mg·h/L.`,
    metrics,
    series,
    detail: { k10, k12, k21, alpha, beta, coefA, coefB },
    provenance: provenance('pk-two-compartment', '1.0.0', p),
  };
}

export const spec: EngineSpec<PkTwoCompartmentParams> = {
  slug: 'pk-two-compartment',
  title: 'Two-Compartment Pharmacokinetics (IV bolus)',
  domain: 'drug-discovery',
  version: '1.0.0',
  description:
    'The classic two-compartment IV-bolus pharmacokinetic model: a drug distributes from blood (central, V1) into tissue (peripheral, V2) and back while being cleared (CL), giving the exact bi-exponential plasma curve C(t)=(Dose/V1)[(α−k21)/(α−β)·e^(−αt)+(k21−β)/(α−β)·e^(−βt)]. Reports the hybrid rate constants α/β, distribution and terminal half-lives, AUC=Dose/CL, steady-state volume, and the peripheral (tissue) concentration. Evaluated in closed form — exact and deterministic.',
  references: [
    'Gibaldi, M. & Perrier, D. (1982) Pharmacokinetics, 2nd ed. Marcel Dekker.',
    'Rowland, M. & Tozer, T.N. (2011) Clinical Pharmacokinetics and Pharmacodynamics, 4th ed. Lippincott Williams & Wilkins.',
  ],
  paramsSchema: paramsSchema as z.ZodType<PkTwoCompartmentParams>,
  run,
  example: paramsSchema.parse({ dose: 100, v1: 10, cl: 5, q: 10, v2: 20, tEnd: 24 }),
  tags: ['drug-discovery', 'pharmacokinetics', 'PK', 'ADME', 'bi-exponential'],
};

export default spec;
