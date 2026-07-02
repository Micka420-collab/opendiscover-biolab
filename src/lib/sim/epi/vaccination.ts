/**
 * Vaccination & herd immunity — the SIR intervention/threshold calculator.
 *
 * Where the SIR ODE (`compartmental`) integrates an outbreak in time, this engine answers
 * the public-health question: how much vaccine, at what efficacy, stops it? Vaccinating a
 * fraction v of the population with a vaccine of efficacy ε removes a fraction εv from the
 * susceptible pool, leaving s₀ = 1 − εv susceptible and dropping the reproduction number to
 *
 *     R_eff = R₀·(1 − εv).
 *
 * The epidemic cannot take off once R_eff ≤ 1, which happens at the CRITICAL COVERAGE
 *
 *     v_c = (1 − 1/R₀) / ε.
 *
 * (With a perfect vaccine ε=1 this is the classic herd-immunity threshold 1 − 1/R₀; with
 * ε<1 it is higher, and if it exceeds 1 the vaccine cannot eradicate the disease even at
 * full coverage.) Below the threshold an outbreak still occurs, and its final size — the
 * fraction of the WHOLE population ever infected — is the nonzero root of
 *
 *     z = s₀·(1 − e^(−R₀·z)),        z ∈ (0, s₀],
 *
 * found here by BRACKETED bisection on the nonzero root (never fixed-point iteration), with
 * the no-epidemic case R_eff ≤ 1 → z = 0 handled explicitly.
 *
 * Closed-form and deterministic. Distinct from `compartmental`/`sir-endemic`/`sis`/
 * `reed-frost`: this is the vaccine-coverage POLICY tool (efficacy, critical coverage,
 * eradication feasibility, cases prevented), not a time-course integrator.
 *
 * References:
 *   - Anderson, R.M. & May, R.M. (1991) Infectious Diseases of Humans. Oxford Univ. Press
 *     (ch. 5, mass vaccination and herd immunity).
 *   - Fine, P., Eames, K. & Heymann, D.L. (2011) "Herd immunity": a rough guide. Clin.
 *     Infect. Dis. 52:911-916.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Basic reproduction number R₀ (secondary cases per case in a fully susceptible pop). */
    r0: z.number().min(0.01).max(50).default(3),
    /** Vaccination coverage v — fraction of the population vaccinated. */
    coverage: z.number().min(0).max(1).default(0.5),
    /** Vaccine efficacy ε — probability a vaccinee is actually protected. */
    efficacy: z.number().min(0.01).max(1).default(0.95),
    /** Points in the plotted coverage-response curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type VaccinationParams = z.infer<typeof paramsSchema>;

/**
 * Final epidemic size z (fraction of the whole population ever infected) for an SIR
 * outbreak with initial susceptible fraction s0, as the nonzero root of z = s0·(1−e^(−R₀z))
 * by bracketed bisection. Returns 0 when R_eff = R₀·s0 ≤ 1 (no epidemic takes off).
 */
export function finalSizeGivenS0(r0: number, s0: number): number {
  if (s0 <= 0 || r0 * s0 <= 1) return 0; // no epidemic (herd immunity or R0<1)
  // g(0)=0, g'(0)=R₀·s0−1>0 so g>0 just above 0; g(s0)=−s0·e^(−R₀s0)<0 → root in (0,s0).
  const g = (zz: number) => s0 * (1 - Math.exp(-r0 * zz)) - zz;
  let lo = 1e-12; // g(lo) > 0
  let hi = s0; // g(hi) < 0
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function run(rawParams: Partial<VaccinationParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { r0, coverage, efficacy } = p;

  const s0 = Math.max(0, 1 - efficacy * coverage); // remaining susceptible fraction
  const effectiveR = r0 * s0;
  // Critical coverage (1−1/R₀)/ε; ≤0 when R₀≤1 (no vaccination needed), >1 when this
  // vaccine cannot eradicate even at full coverage.
  const criticalCoverageRaw = r0 > 1 ? (1 - 1 / r0) / efficacy : 0;
  const eradicationFeasible = criticalCoverageRaw <= 1;
  const herdImmunityReached = eradicationFeasible && coverage >= criticalCoverageRaw;

  const finalSize = finalSizeGivenS0(r0, s0);
  const finalSizeNoVax = finalSizeGivenS0(r0, 1);
  const casesPrevented = Math.max(0, finalSizeNoVax - finalSize);

  const metrics: Metric[] = [
    { key: 'r0', label: 'Basic reproduction number R₀', value: r0 },
    {
      key: 'criticalCoverage',
      label: 'Critical coverage v_c',
      value: criticalCoverageRaw,
      note: eradicationFeasible
        ? '(1−1/R₀)/ε: coverage that reaches herd immunity'
        : '>1: this vaccine cannot eradicate even at full coverage',
    },
    {
      key: 'effectiveR',
      label: 'Effective reproduction R_eff',
      value: effectiveR,
      note: 'R₀·(1−εv); an outbreak needs R_eff > 1',
    },
    {
      key: 'finalSize',
      label: 'Final epidemic size',
      value: finalSize,
      note: herdImmunityReached ? 'herd immunity — no outbreak' : 'fraction ever infected',
    },
    { key: 'finalSizeNoVax', label: 'Final size with no vaccination', value: finalSizeNoVax },
    {
      key: 'casesPrevented',
      label: 'Population fraction spared',
      value: casesPrevented,
      note: 'infections averted vs no vaccination',
    },
    {
      key: 'herdImmunity',
      label: 'Herd immunity reached',
      value: herdImmunityReached ? 1 : 0,
      note: herdImmunityReached ? 'coverage ≥ v_c' : 'coverage below v_c',
    },
  ];

  const n = p.outputPoints;
  const coverageGrid = Array.from({ length: n }, (_, i) => i / (n - 1));
  const series: Series[] = [
    {
      x: coverageGrid,
      y: {
        finalSize: coverageGrid.map((v) => finalSizeGivenS0(r0, Math.max(0, 1 - efficacy * v))),
        effectiveR: coverageGrid.map((v) => r0 * Math.max(0, 1 - efficacy * v)),
      },
      xLabel: 'vaccination coverage v',
      yLabel: 'final size / R_eff',
    },
  ];

  const outbreak = herdImmunityReached
    ? 'herd immunity reached — no outbreak'
    : `${(100 * finalSize).toFixed(1)}% infected (R_eff=${effectiveR.toFixed(2)})`;
  return {
    engine: 'vaccination',
    summary: `Vaccination vs R₀=${r0}: critical coverage v_c=${eradicationFeasible ? `${(100 * criticalCoverageRaw).toFixed(0)}%` : '>100% (cannot eradicate)'} at ε=${efficacy}; at v=${(100 * coverage).toFixed(0)}% → ${outbreak}.`,
    metrics,
    series,
    detail: {
      criticalCoverage: criticalCoverageRaw,
      effectiveR,
      finalSize,
      casesPrevented,
      herdImmunityReached,
    },
    provenance: provenance('vaccination', '1.0.0', p),
  };
}

export const spec: EngineSpec<VaccinationParams> = {
  slug: 'vaccination',
  title: 'Vaccination & Herd Immunity (SIR threshold)',
  domain: 'epidemiology',
  version: '1.0.0',
  description:
    'The vaccination-policy calculator for an SIR disease: vaccinating a fraction v at efficacy ε drops the reproduction number to R_eff=R₀(1−εv), and the outbreak is prevented once coverage reaches the critical value v_c=(1−1/R₀)/ε (the classic 1−1/R₀ when ε=1, higher for an imperfect vaccine, and >1 — impossible — for a weak vaccine against a very transmissible disease). Below threshold it reports the final epidemic size (the nonzero root of z=s₀(1−e^(−R₀z)) by bracketed bisection, with the no-epidemic R_eff≤1 case handled), the fraction of the population spared versus no vaccination, and a full coverage-response curve. Closed-form and deterministic; the threshold/eradication tool, not a time-course integrator.',
  references: [
    'Anderson, R.M. & May, R.M. (1991) Infectious Diseases of Humans. Oxford University Press.',
    'Fine, P., Eames, K. & Heymann, D.L. (2011) "Herd immunity": a rough guide. Clin. Infect. Dis. 52:911-916.',
  ],
  paramsSchema: paramsSchema as z.ZodType<VaccinationParams>,
  run,
  example: paramsSchema.parse({ r0: 3, coverage: 0.5, efficacy: 0.95 }),
  tags: [
    'epidemiology',
    'vaccination',
    'herd-immunity',
    'threshold',
    'final-size',
    'public-health',
  ],
};

export default spec;
