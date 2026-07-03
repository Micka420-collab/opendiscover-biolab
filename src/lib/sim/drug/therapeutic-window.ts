/**
 * Therapeutic window — the safety gap between the dose of a drug that helps and the dose that
 * harms, and why "more" is not "better".
 *
 * Every drug has two dose–response curves: an EFFICACY curve (the fraction of patients it helps)
 * and a TOXICITY curve (the fraction it harms), each a sigmoid set by a half-max dose and a
 * steepness. Both are modelled with the Hill equation, written in overflow-safe ratio form:
 *
 *     efficacy(D) = 1 / (1 + (ED50/D)^hE),      toxicity(D) = 1 / (1 + (TD50/D)^hT).
 *
 * A safe, useful drug is one whose toxicity curve sits far to the right of its efficacy curve —
 * a wide gap called the therapeutic window. The classic summary number is the therapeutic index
 * TI = TD50/ED50: how many times the effective dose you must give before toxicity sets in. Drugs
 * with a narrow window (warfarin, digoxin, lithium) need careful monitoring; a wide window means
 * a comfortable margin for error.
 *
 * This engine reports the therapeutic index, the efficacy and toxicity at a chosen dose, the net
 * benefit (helped AND not harmed) and the raw margin, plus both dose–response curves so the
 * window between them is visible. Because efficacy climbs and then toxicity catches up, net
 * benefit peaks at an intermediate dose — the sweet spot — not at the highest dose.
 *
 * Closed-form and deterministic; the ratio-form Hill keeps every value finite (at dose 0 the
 * ratio is +∞, giving a response of exactly 0, with no NaN).
 *
 * References:
 *   - Hill, A.V. (1910) J. Physiol. 40:iv-vii.
 *   - Muller, P.Y. & Milton, M.N. (2012) The determination and interpretation of the therapeutic
 *     index in drug development. Nat. Rev. Drug Discov. 11:751-761.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** ED50 — dose that produces the effect in half of patients. */
    ed50: z.number().min(1e-6).max(1e9).default(10),
    /** TD50 — dose that produces toxicity in half of patients. */
    td50: z.number().min(1e-6).max(1e9).default(100),
    /** Steepness of the efficacy curve (Hill coefficient). */
    hillEfficacy: z.number().min(0.1).max(10).default(1),
    /** Steepness of the toxicity curve (Hill coefficient). */
    hillToxicity: z.number().min(0.1).max(10).default(1),
    /** The dose to report efficacy/toxicity at. */
    dose: z.number().min(0).max(1e12).default(30),
    /** Upper dose for the plotted curves. */
    doseMax: z.number().min(1e-6).max(1e12).default(300),
    /** Points in the plotted curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type TherapeuticParams = z.infer<typeof paramsSchema>;

/**
 * Hill response 1/(1+(half/dose)^h), in ratio form so it never overflows. At dose 0 the ratio is
 * +∞ and the response is exactly 0 (not NaN).
 */
export function hillResponse(dose: number, half: number, hill: number): number {
  return 1 / (1 + (dose > 0 ? (half / dose) ** hill : Number.POSITIVE_INFINITY));
}

export function run(rawParams: Partial<TherapeuticParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const therapeuticIndex = p.td50 / p.ed50;
  const efficacyAtDose = hillResponse(p.dose, p.ed50, p.hillEfficacy);
  const toxicityAtDose = hillResponse(p.dose, p.td50, p.hillToxicity);
  const netBenefitAtDose = efficacyAtDose * (1 - toxicityAtDose); // helped AND not harmed
  const marginAtDose = efficacyAtDose - toxicityAtDose;

  const metrics: Metric[] = [
    {
      key: 'therapeuticIndex',
      label: 'Therapeutic index',
      value: therapeuticIndex,
      note: 'TD50 / ED50 — how many effective doses fit before toxicity; higher is safer',
    },
    {
      key: 'efficacyAtDose',
      label: `Efficacy at dose ${p.dose}`,
      value: efficacyAtDose,
      note: 'fraction of patients helped',
    },
    {
      key: 'toxicityAtDose',
      label: `Toxicity at dose ${p.dose}`,
      value: toxicityAtDose,
      note: 'fraction of patients harmed',
    },
    {
      key: 'netBenefitAtDose',
      label: 'Net benefit at dose',
      value: netBenefitAtDose,
      note: 'efficacy × (1 − toxicity): helped and not harmed — peaks at an intermediate dose',
    },
    {
      key: 'marginAtDose',
      label: 'Margin at dose',
      value: marginAtDose,
      note: 'efficacy − toxicity; negative means the dose harms more than it helps',
    },
  ];

  const n = p.outputPoints;
  const doses = Array.from({ length: n }, (_, i) => (p.doseMax * i) / (n - 1));
  const efficacy = doses.map((d) => hillResponse(d, p.ed50, p.hillEfficacy));
  const toxicity = doses.map((d) => hillResponse(d, p.td50, p.hillToxicity));
  const series: Series[] = [
    {
      x: doses,
      y: { efficacy, toxicity },
      xLabel: 'dose',
      yLabel: 'fraction of patients responding',
    },
  ];

  return {
    engine: 'therapeutic-window',
    summary: `Therapeutic index ${therapeuticIndex.toPrecision(3)} (TD50 ${p.td50} / ED50 ${p.ed50}). At dose ${p.dose}: ${(efficacyAtDose * 100).toPrecision(3)}% helped, ${(toxicityAtDose * 100).toPrecision(3)}% harmed → net benefit ${(netBenefitAtDose * 100).toPrecision(3)}%. Net benefit peaks at an intermediate dose, not the highest.`,
    metrics,
    series,
    detail: { therapeuticIndex, efficacyAtDose, toxicityAtDose, netBenefitAtDose, marginAtDose },
    provenance: provenance('therapeutic-window', '1.0.0', p),
  };
}

export const spec: EngineSpec<TherapeuticParams> = {
  slug: 'therapeutic-window',
  title: 'Therapeutic Window (Safety Margin)',
  domain: 'drug-discovery',
  version: '1.0.0',
  description:
    'The safety gap between the dose of a drug that helps and the dose that harms. Efficacy and toxicity are each Hill dose–response sigmoids, efficacy(D)=1/(1+(ED50/D)^hE) and toxicity(D)=1/(1+(TD50/D)^hT); the therapeutic index TD50/ED50 measures how far apart they sit. Reports the therapeutic index, efficacy and toxicity at a chosen dose, the net benefit (helped and not harmed) and the raw margin, plus both dose–response curves so the window between them is visible. Because toxicity eventually catches up with efficacy, net benefit peaks at an intermediate dose — more is not better. Closed-form and deterministic; ratio-form Hill keeps every value finite.',
  references: [
    'Muller, P.Y. & Milton, M.N. (2012) The therapeutic index in drug development. Nat. Rev. Drug Discov. 11:751-761.',
  ],
  paramsSchema: paramsSchema as z.ZodType<TherapeuticParams>,
  run,
  example: paramsSchema.parse({ ed50: 10, td50: 100, hillEfficacy: 1, hillToxicity: 1, dose: 30 }),
  tags: ['drug-discovery', 'therapeutic-index', 'toxicity', 'dose-response', 'safety', 'hill'],
};

export default spec;
