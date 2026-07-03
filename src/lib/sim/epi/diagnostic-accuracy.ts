/**
 * Diagnostic test predictive value — what a positive (or negative) medical test result actually
 * means, from Bayes' theorem, and why a positive test for a RARE disease is usually a false alarm.
 *
 * A test is described by two numbers: its sensitivity (the chance it catches a real case) and its
 * specificity (the chance it correctly clears a healthy person). But the question a patient cares
 * about is the reverse: given a POSITIVE result, what is the chance I actually have the disease?
 * That is the positive predictive value, and by Bayes' theorem it depends on how common the
 * disease is (the prevalence p):
 *
 *     PPV = (sens·p) / (sens·p + (1−spec)·(1−p)),
 *     NPV = (spec·(1−p)) / (spec·(1−p) + (1−sens)·p).
 *
 * The counter-intuitive lesson — the "base-rate fallacy" — is that when a disease is rare, even
 * an excellent test throws off far more false positives than true ones, so a positive result is
 * more likely wrong than right. This is why screening rare conditions needs extremely high
 * specificity, and why doctors re-test before acting on a surprising positive.
 *
 * This engine reports the positive and negative predictive values, the false-discovery rate, the
 * overall accuracy, and the true- vs false-positive counts in a population, plus the PPV/NPV
 * curves across prevalence (the base-rate curve). Closed-form and deterministic; the predictive
 * values are guarded so the degenerate cases (no positives / no negatives) stay finite.
 *
 * References:
 *   - Bayes, T. (1763) An essay towards solving a problem in the doctrine of chances.
 *   - Altman, D.G. & Bland, J.M. (1994) Diagnostic tests 2: predictive values. BMJ 309:102.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Disease prevalence p — the fraction of the tested population that truly has it. */
    prevalence: z.number().min(0).max(1).default(0.01),
    /** Sensitivity — P(test positive | has disease), the true-positive rate. */
    sensitivity: z.number().min(0).max(1).default(0.95),
    /** Specificity — P(test negative | healthy), the true-negative rate. */
    specificity: z.number().min(0).max(1).default(0.9),
    /** Population size, for the true/false count breakdown. */
    populationSize: z.number().int().min(1).max(1e9).default(100000),
    /** Points in the plotted PPV/NPV-vs-prevalence curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type DiagnosticParams = z.infer<typeof paramsSchema>;

/** Group an integer with commas, deterministically (locale-independent, unlike toLocaleString). */
function group(x: number): string {
  return Math.round(x)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Positive predictive value P(disease | positive), guarded to 0 when there are no positives. */
export function positivePredictiveValue(
  prevalence: number,
  sensitivity: number,
  specificity: number,
): number {
  const denom = sensitivity * prevalence + (1 - specificity) * (1 - prevalence);
  return denom > 0 ? (sensitivity * prevalence) / denom : 0;
}

/** Negative predictive value P(healthy | negative), guarded to 0 when there are no negatives. */
export function negativePredictiveValue(
  prevalence: number,
  sensitivity: number,
  specificity: number,
): number {
  const denom = specificity * (1 - prevalence) + (1 - sensitivity) * prevalence;
  return denom > 0 ? (specificity * (1 - prevalence)) / denom : 0;
}

export function run(rawParams: Partial<DiagnosticParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { prevalence: prev, sensitivity: sens, specificity: spec, populationSize: N } = p;

  const ppv = positivePredictiveValue(prev, sens, spec);
  const npv = negativePredictiveValue(prev, sens, spec);
  const falseDiscoveryRate = 1 - ppv;
  const accuracy = prev * sens + (1 - prev) * spec; // (TP+TN)/N
  const testPositiveRate = sens * prev + (1 - spec) * (1 - prev);

  const truePositives = N * prev * sens;
  const falseNegatives = N * prev * (1 - sens);
  const falsePositives = N * (1 - prev) * (1 - spec);
  const trueNegatives = N * (1 - prev) * spec;

  const metrics: Metric[] = [
    {
      key: 'ppv',
      label: 'Positive predictive value',
      value: ppv,
      note: 'P(disease | positive test) — the chance a positive is real',
    },
    {
      key: 'npv',
      label: 'Negative predictive value',
      value: npv,
      note: 'P(healthy | negative test) — the chance a negative is real',
    },
    {
      key: 'falseDiscoveryRate',
      label: 'False-discovery rate',
      value: falseDiscoveryRate,
      note: '1 − PPV: the share of positives that are false alarms',
    },
    {
      key: 'overallAccuracy',
      label: 'Overall accuracy',
      value: accuracy,
      note: 'fraction of all tests that are correct (TP+TN)/N',
    },
    {
      key: 'truePositives',
      label: 'True positives (per population)',
      value: truePositives,
      note: 'real cases the test catches',
    },
    {
      key: 'falsePositives',
      label: 'False positives (per population)',
      value: falsePositives,
      note: 'healthy people wrongly flagged — often outnumber true positives when disease is rare',
    },
  ];

  const n = p.outputPoints;
  const prevalences = Array.from({ length: n }, (_, i) => i / (n - 1));
  const ppvCurve = prevalences.map((x) => positivePredictiveValue(x, sens, spec));
  const npvCurve = prevalences.map((x) => negativePredictiveValue(x, sens, spec));
  const series: Series[] = [
    {
      x: prevalences,
      y: { ppv: ppvCurve, npv: npvCurve },
      xLabel: 'disease prevalence',
      yLabel: 'predictive value',
    },
  ];

  return {
    engine: 'diagnostic-accuracy',
    summary: `At ${(prev * 100).toPrecision(3)}% prevalence, a ${(sens * 100).toPrecision(3)}%-sensitive / ${(spec * 100).toPrecision(3)}%-specific test has PPV ${(ppv * 100).toPrecision(3)}% — of every ${group(truePositives + falsePositives)} positives in ${group(N)} people, ${group(falsePositives)} are false alarms. NPV ${(npv * 100).toPrecision(4)}%.`,
    metrics,
    series,
    detail: {
      ppv,
      npv,
      truePositives,
      falseNegatives,
      falsePositives,
      trueNegatives,
      testPositiveRate,
    },
    provenance: provenance('diagnostic-accuracy', '1.0.0', p),
  };
}

export const spec: EngineSpec<DiagnosticParams> = {
  slug: 'diagnostic-accuracy',
  title: 'Diagnostic Test Predictive Value',
  domain: 'epidemiology',
  version: '1.0.0',
  description:
    "What a positive or negative medical test really means, from Bayes' theorem. A test's sensitivity and specificity are fixed, but the chance a POSITIVE result is real — the positive predictive value PPV=sens·p/(sens·p+(1−spec)(1−p)) — depends heavily on how common the disease is. The base-rate fallacy: when a disease is rare, even an excellent test produces more false positives than true ones, so a positive is more likely wrong than right. Reports PPV, NPV, false-discovery rate, overall accuracy, and the true/false-positive counts in a population, plus the PPV/NPV-vs-prevalence curves. Predictive values are guarded so the no-positives / no-negatives cases stay finite. Closed-form and deterministic.",
  references: [
    'Altman, D.G. & Bland, J.M. (1994) Diagnostic tests 2: predictive values. BMJ 309:102.',
  ],
  paramsSchema: paramsSchema as z.ZodType<DiagnosticParams>,
  run,
  example: paramsSchema.parse({ prevalence: 0.01, sensitivity: 0.95, specificity: 0.9 }),
  tags: ['epidemiology', 'diagnostics', 'bayes', 'screening', 'predictive-value', 'base-rate'],
};

export default spec;
