/**
 * Dose-Response & Pharmacodynamics engine.
 *
 * Models the concentration -> effect relationship of a drug with the sigmoidal
 * Hill (four-parameter logistic) equation and provides the everyday
 * pharmacology toolkit built on top of it:
 *
 *   - Forward simulation of a dose-response curve over a log-concentration grid.
 *   - Non-linear least-squares FITTING of EC50 / IC50, Hill slope and the
 *     plateaus (E0, Emax) from noisy (concentration, response) data, using a
 *     grid-search initial guess refined by Levenberg-Marquardt (the LM normal
 *     equations are solved with the shared `solve` from core/linalg).
 *   - The distinction between the *relative* EC50 (the model potency parameter,
 *     halfway between the two plateaus) and the *absolute* IC50 (concentration
 *     at which the response is 50 % of the untreated control) — these differ
 *     whenever inhibition is incomplete (bottom plateau != 0), which is the
 *     GraphPad "relative vs absolute IC50" story.
 *   - Two classical drug-combination reference models: Bliss independence
 *     (probabilistic, effect-based) and Loewe additivity (dose-based
 *     isobologram / combination index).
 *
 * The Hill model
 * --------------
 *     E(C) = E0 + (Emax - E0) * C^n / (EC50^n + C^n)
 *
 *   E0    baseline effect as C -> 0
 *   Emax  maximal (saturating) effect as C -> inf
 *   EC50  concentration giving an effect exactly halfway between E0 and Emax
 *   n     Hill slope / coefficient (steepness; n>1 positive cooperativity)
 *
 * Key identities used and tested:
 *   - At C = EC50 the response is exactly (E0 + Emax)/2.
 *   - The curve is strictly monotonic in C (increasing if Emax>E0, decreasing
 *     otherwise) and saturates at Emax.
 *   - Inverting the equation: for a target response E with fractional effect
 *     f = (E-E0)/(Emax-E0) in (0,1),  C = EC50 * (f/(1-f))^(1/n).
 *
 * Combination indices
 * -------------------
 *   Bliss independence (two non-interacting drugs, effects as fractions
 *   affected fa,fb in [0,1]): the fraction unaffected multiplies, so the
 *   expected combined fraction affected is  fab = fa + fb - fa*fb.  The Bliss
 *   "excess" is observed - expected; ~0 means the drugs are non-interacting.
 *
 *   Loewe additivity / combination index: if doses dA,dB in combination produce
 *   an effect that the single agents reach alone at doses DA,DB, then
 *   CI = dA/DA + dB/DB.  CI = 1 additive (on the isobologram), CI<1 synergy,
 *   CI>1 antagonism.
 *
 * Assumptions: a single homogeneous receptor population / mechanism, effect
 * monotone in concentration, equilibrium (no time dependence), and for the
 * combination models the standard Bliss / Loewe idealisations. These are the
 * textbook pharmacodynamic assumptions (Goodman & Gilman; Motulsky & Christopoulos;
 * Chou 2006).
 *
 * Determinism: the science is pure and closed-form. The only stochastic element
 * is an OPTIONAL reproducible measurement-noise channel used to make synthetic
 * demo data; it draws from the shared seeded RNG so identical seeds reproduce
 * identical data (and therefore identical fits) byte-for-byte.
 */

import { z } from 'zod';
import { solve } from '../core/linalg';
import { createRng } from '../core/prng';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Core Hill parameters
// ---------------------------------------------------------------------------

/** The four parameters that fully specify a Hill dose-response curve. */
export interface HillParams {
  /** Baseline effect as C -> 0. */
  e0: number;
  /** Maximal (saturating) effect as C -> infinity. */
  emax: number;
  /** Concentration at the half-way effect between E0 and Emax (potency). */
  ec50: number;
  /** Hill slope / coefficient (steepness). */
  hill: number;
}

// ---------------------------------------------------------------------------
// Core scientific functions (exported individually for reuse & testing)
// ---------------------------------------------------------------------------

/**
 * Hill sigmoid occupancy / effect fraction s(C) = C^n / (EC50^n + C^n) in [0,1].
 * This is the fraction of the way from E0 to Emax at concentration C.
 */
export function hillFraction(c: number, ec50: number, hill: number): number {
  if (c <= 0) return 0;
  // Numerically stable form: 1 / (1 + (EC50/C)^n). Avoids overflow of C^n for
  // large n and huge concentrations.
  const ratio = ec50 / c;
  return 1 / (1 + ratio ** hill);
}

/** Hill dose-response: E(C) = E0 + (Emax - E0) * C^n/(EC50^n + C^n). */
export function hillResponse(c: number, p: HillParams): number {
  return p.e0 + (p.emax - p.e0) * hillFraction(c, p.ec50, p.hill);
}

/**
 * Invert the Hill equation: return the concentration that produces response E.
 * Uses f = (E-E0)/(Emax-E0); valid only for f in (0,1). Returns NaN when the
 * target response lies outside the (E0, Emax) range and is therefore
 * unreachable (e.g. asking for an absolute IC50 on a stimulatory curve).
 */
export function inverseHillConcentration(e: number, p: HillParams): number {
  const span = p.emax - p.e0;
  if (span === 0) return Number.NaN;
  const f = (e - p.e0) / span;
  if (f <= 0 || f >= 1) return Number.NaN;
  return p.ec50 * (f / (1 - f)) ** (1 / p.hill);
}

/**
 * Absolute IC50: the concentration at which the response is reduced to 50 % of
 * the untreated control (baseline E0), assuming full effect drives the signal
 * toward 0. Defined for inhibition curves (Emax < E0). Equals the EC50
 * parameter only when the bottom plateau is exactly 0 (complete inhibition);
 * for incomplete inhibition it is larger than EC50. Returns NaN when the curve
 * never crosses 50 % of control (e.g. a stimulatory curve, or inhibition that
 * plateaus above 50 % of control).
 */
export function absoluteIC50(p: HillParams): number {
  return inverseHillConcentration(0.5 * p.e0, p);
}

/** Is this a stimulatory (increasing) curve? */
export function isStimulatory(p: HillParams): boolean {
  return p.emax > p.e0;
}

export interface CurvePoint {
  concentration: number;
  logConcentration: number;
  response: number;
}

/**
 * Evaluate the dose-response curve on an explicit list of concentrations.
 * Concentrations must be > 0 (log axis). Returns points sorted as given.
 */
export function doseResponseCurve(p: HillParams, concentrations: number[]): CurvePoint[] {
  return concentrations.map((c) => ({
    concentration: c,
    logConcentration: Math.log10(c),
    response: hillResponse(c, p),
  }));
}

/** Build a log-spaced concentration grid from 10^logMin to 10^logMax. */
export function logConcentrationGrid(logMin: number, logMax: number, numPoints: number): number[] {
  if (numPoints < 2) return [10 ** logMin];
  const step = (logMax - logMin) / (numPoints - 1);
  return Array.from({ length: numPoints }, (_, i) => 10 ** (logMin + i * step));
}

// ---------------------------------------------------------------------------
// Non-linear least-squares fitting (grid-search init + Levenberg-Marquardt)
// ---------------------------------------------------------------------------

export interface DataPoint {
  concentration: number;
  response: number;
}

export interface FitResult extends HillParams {
  /** Root-mean-square residual of the fit. */
  rmse: number;
  /** Coefficient of determination R^2. */
  r2: number;
  /** LM iterations actually performed. */
  iterations: number;
  /** Whether the optimiser reached its convergence tolerance. */
  converged: boolean;
}

// Internal parameter vector for the optimiser: theta = [e0, emax, log10EC50, n].
// We fit log10(EC50) rather than EC50 so the parameter is well-scaled across
// many decades of concentration; n is kept strictly positive.
type Theta = [number, number, number, number];

const LN10 = Math.LN10;

function modelAt(c: number, th: Theta): number {
  const ec50 = 10 ** th[2];
  return th[0] + (th[1] - th[0]) * hillFraction(c, ec50, th[3]);
}

function sse(data: DataPoint[], th: Theta): number {
  let s = 0;
  for (const d of data) {
    const r = modelAt(d.concentration, th) - d.response;
    s += r * r;
  }
  return s;
}

/**
 * Analytic Jacobian row [dE/de0, dE/demax, dE/dlog10EC50, dE/dn] at one point.
 * Derived from s = C^n/(EC50^n+C^n):
 *   ds/dn          =  s(1-s)(lnC - lnEC50)
 *   ds/dlog10EC50  = -n s(1-s) ln10
 */
function jacobianRow(c: number, th: Theta): Theta {
  const [e0, emax, p, n] = th;
  const ec50 = 10 ** p;
  const s = hillFraction(c, ec50, n);
  const span = emax - e0;
  const s1 = s * (1 - s);
  const lnC = c > 0 ? Math.log(c) : 0;
  const lnEC = Math.log(ec50);
  return [
    1 - s, // d/de0
    s, // d/demax
    span * (-n * s1) * LN10, // d/dlog10EC50
    span * s1 * (lnC - lnEC), // d/dn
  ];
}

/**
 * Fit the four-parameter Hill model to (concentration, response) data by
 * least squares. Strategy: robust closed-form initial guess for the plateaus,
 * a coarse grid search over (log10EC50, n) to seed the potency and slope, then
 * Levenberg-Marquardt refinement of all four parameters. The LM step solves the
 * (damped) normal equations (JtJ + lambda*diag) delta = -Jt r with the shared
 * dense linear solver.
 */
export function fitHill(
  data: DataPoint[],
  opts: { maxIter?: number; tol?: number } = {},
): FitResult {
  const maxIter = opts.maxIter ?? 300;
  const tol = opts.tol ?? 1e-12;
  if (data.length < 4) {
    throw new Error('fitHill: need at least 4 data points to fit 4 parameters');
  }

  const sorted = [...data].sort((a, b) => a.concentration - b.concentration);
  const responses = sorted.map((d) => d.response);
  const n = sorted.length;

  // --- initial plateaus from the extreme-concentration responses -----------
  const lowAvg = (responses[0] + responses[Math.min(1, n - 1)]) / 2;
  const highAvg = (responses[n - 1] + responses[Math.max(n - 2, 0)]) / 2;
  const e0Init = lowAvg;
  const emaxInit = highAvg;

  // --- grid search over log10EC50 and Hill slope ---------------------------
  const logs = sorted.filter((d) => d.concentration > 0).map((d) => Math.log10(d.concentration));
  const logMin = Math.min(...logs);
  const logMax = Math.max(...logs);
  let best: Theta = [e0Init, emaxInit, (logMin + logMax) / 2, 1];
  let bestSse = sse(sorted, best);
  const nGrid = [0.5, 0.75, 1, 1.5, 2, 3, 4];
  const gridSteps = 40;
  for (let i = 0; i <= gridSteps; i++) {
    const p = logMin + ((logMax - logMin) * i) / gridSteps;
    for (const nn of nGrid) {
      const cand: Theta = [e0Init, emaxInit, p, nn];
      const s = sse(sorted, cand);
      if (s < bestSse) {
        bestSse = s;
        best = cand;
      }
    }
  }

  // --- Levenberg-Marquardt refinement --------------------------------------
  let theta: Theta = [...best] as Theta;
  let lambda = 1e-3;
  let curSse = sse(sorted, theta);
  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;

    // Accumulate JtJ (4x4) and Jt r (4).
    const JtJ: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const Jtr: number[] = [0, 0, 0, 0];
    for (const d of sorted) {
      const row = jacobianRow(d.concentration, theta);
      const r = modelAt(d.concentration, theta) - d.response;
      for (let a = 0; a < 4; a++) {
        Jtr[a] += row[a] * r;
        for (let b = 0; b < 4; b++) JtJ[a][b] += row[a] * row[b];
      }
    }

    // Try damped steps, increasing lambda until we find an improvement.
    let stepAccepted = false;
    for (let tries = 0; tries < 12; tries++) {
      const A = JtJ.map((r) => [...r]);
      for (let a = 0; a < 4; a++) A[a][a] += lambda * (JtJ[a][a] + 1e-12);
      const rhs = Jtr.map((v) => -v);
      const delta = solve(A, rhs);
      if (!delta) {
        lambda *= 10;
        continue;
      }
      const trial: Theta = [
        theta[0] + delta[0],
        theta[1] + delta[1],
        theta[2] + delta[2],
        Math.max(0.05, theta[3] + delta[3]), // keep the Hill slope positive
      ];
      const trialSse = sse(sorted, trial);
      if (trialSse < curSse) {
        const improvement = curSse - trialSse;
        theta = trial;
        lambda = Math.max(lambda / 10, 1e-12);
        const rel = improvement / (curSse + 1e-30);
        curSse = trialSse;
        stepAccepted = true;
        if (rel < tol) converged = true;
        break;
      }
      lambda *= 10;
    }

    if (!stepAccepted) {
      // No downhill step found: we are at a (local) minimum.
      converged = true;
      break;
    }
    if (converged) break;
  }

  // --- goodness of fit ------------------------------------------------------
  const meanY = responses.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  for (const y of responses) ssTot += (y - meanY) ** 2;
  const rmse = Math.sqrt(curSse / n);
  const r2 = ssTot === 0 ? 1 : 1 - curSse / ssTot;

  return {
    e0: theta[0],
    emax: theta[1],
    ec50: 10 ** theta[2],
    hill: theta[3],
    rmse,
    r2,
    iterations,
    converged,
  };
}

// ---------------------------------------------------------------------------
// Drug-combination indices
// ---------------------------------------------------------------------------

/**
 * Bliss independence expected combined fraction affected.
 * If two drugs act independently, the fraction UNaffected multiplies:
 *   (1 - fab) = (1 - fa)(1 - fb)  =>  fab = fa + fb - fa*fb.
 */
export function blissIndependence(fa: number, fb: number): number {
  return fa + fb - fa * fb;
}

/**
 * Bliss excess = observed combined fraction affected minus the Bliss-predicted
 * fraction. ~0 => additive/non-interacting, >0 => synergy, <0 => antagonism.
 */
export function blissExcess(faObserved: number, fa: number, fb: number): number {
  return faObserved - blissIndependence(fa, fb);
}

/**
 * Loewe combination index CI = dA/DA + dB/DB, where dA,dB are the doses used in
 * combination and DA,DB are the single-agent doses producing the same effect.
 * CI = 1 additive, CI < 1 synergy, CI > 1 antagonism.
 */
export function loeweCombinationIndex(dA: number, dB: number, DA: number, DB: number): number {
  return dA / DA + dB / DB;
}

export interface ComboAnalysis {
  /** Fraction affected by drug A alone at its combination dose. */
  faA: number;
  /** Fraction affected by drug B alone at its combination dose. */
  faB: number;
  /** Bliss-predicted combined fraction affected (independence). */
  blissExpected: number;
  /** Observed combined fraction affected (defaults to the Bliss prediction). */
  faObserved: number;
  /** Bliss excess (observed - expected). */
  blissExcess: number;
  /** Single-agent dose of A producing faObserved (isoeffective dose). */
  isoDoseA: number;
  /** Single-agent dose of B producing faObserved. */
  isoDoseB: number;
  /** Loewe combination index at the observed effect. */
  loeweCI: number;
}

/**
 * Isoeffective single-agent dose: the concentration of a drug (whose potency is
 * ec50, slope hill) that alone produces fraction affected `fa`. From the Hill
 * fraction s = C^n/(EC50^n+C^n): C = EC50 * (fa/(1-fa))^(1/n).
 */
export function doseForFraction(fa: number, ec50: number, hill: number): number {
  if (fa <= 0) return 0;
  if (fa >= 1) return Number.POSITIVE_INFINITY;
  return ec50 * (fa / (1 - fa)) ** (1 / hill);
}

/**
 * Full two-drug combination analysis at a pair of doses. Fractions affected are
 * measured on each drug's own effect scale (0 = E0, 1 = Emax). If an observed
 * combined fraction is supplied it is used for the Loewe isobologram and the
 * Bliss excess; otherwise the drugs are assumed non-interacting and the Bliss
 * prediction is used (giving CI as computed on the additive surface).
 */
export function analyzeCombination(
  drugA: HillParams,
  drugB: HillParams,
  doseA: number,
  doseB: number,
  faObserved?: number,
): ComboAnalysis {
  const faA = hillFraction(doseA, drugA.ec50, drugA.hill);
  const faB = hillFraction(doseB, drugB.ec50, drugB.hill);
  const blissExpected = blissIndependence(faA, faB);
  const observed = faObserved ?? blissExpected;
  const isoDoseA = doseForFraction(observed, drugA.ec50, drugA.hill);
  const isoDoseB = doseForFraction(observed, drugB.ec50, drugB.hill);
  return {
    faA,
    faB,
    blissExpected,
    faObserved: observed,
    blissExcess: observed - blissExpected,
    isoDoseA,
    isoDoseB,
    loeweCI: loeweCombinationIndex(doseA, doseB, isoDoseA, isoDoseB),
  };
}

// ---------------------------------------------------------------------------
// Parameters (Zod schema)
// ---------------------------------------------------------------------------

const dataPointSchema = z.object({
  concentration: z.number().positive(),
  response: z.number(),
});

const drugSchema = z.object({
  e0: z.number().default(0),
  emax: z.number().default(100),
  ec50: z.number().positive().default(1),
  hill: z.number().positive().default(1),
});

export const paramsSchema = z
  .object({
    // --- Hill curve parameters (curve-generation mode) ---
    /** Baseline effect at zero concentration. */
    e0: z.number().default(0),
    /** Maximal effect (top plateau). */
    emax: z.number().default(100),
    /** Half-maximal effective concentration (potency). */
    ec50: z.number().positive().default(50),
    /** Hill slope / coefficient. */
    hill: z.number().positive().default(1),

    // --- concentration grid for curve generation ---
    /** Explicit concentrations to evaluate (overrides the log grid). */
    concentrations: z.array(z.number().positive()).optional(),
    /** log10 of the smallest grid concentration. */
    logConcMin: z.number().default(-3),
    /** log10 of the largest grid concentration. */
    logConcMax: z.number().default(3),
    /** Number of points on the log grid. */
    numPoints: z.number().int().min(2).max(2000).default(49),

    // --- fitting mode ---
    /** (concentration,response) observations; when present the engine FITS. */
    data: z.array(dataPointSchema).optional(),

    // --- optional reproducible measurement noise for synthetic demo data ---
    /** Coefficient of variation of multiplicative measurement noise (0 = clean). */
    noiseCv: z.number().min(0).default(0),
    /** RNG seed for the noise channel. */
    seed: z.number().int().default(12345),

    // --- optional drug-combination analysis ---
    combo: z
      .object({
        drugA: drugSchema,
        drugB: drugSchema,
        doseA: z.number().positive(),
        doseB: z.number().positive(),
        /** Observed combined fraction affected (defaults to Bliss prediction). */
        faObserved: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .strict();

export type DoseResponseParams = z.infer<typeof paramsSchema>;

// ---------------------------------------------------------------------------
// Helpers to assemble the SimResult
// ---------------------------------------------------------------------------

/** Add optional reproducible multiplicative noise to a response vector. */
function noisyResponses(responses: number[], cv: number, seed: number): number[] | null {
  if (cv <= 0) return null;
  const rng = createRng(seed);
  return responses.map((r) => r * (1 + rng.normal(0, cv)));
}

function ic50Metric(p: HillParams): Metric {
  if (isStimulatory(p)) {
    // Absolute IC50 (50 % of control) is undefined for a stimulatory curve; we
    // report the relative half-maximal concentration (= EC50 parameter).
    return {
      key: 'ic50',
      label: 'IC50 (relative)',
      value: p.ec50,
      unit: 'concentration',
      note: 'stimulatory curve: IC50 coincides with the EC50 potency parameter',
    };
  }
  const abs = absoluteIC50(p);
  return {
    key: 'ic50',
    label: 'IC50 (absolute)',
    value: abs,
    unit: 'concentration',
    note: Number.isFinite(abs)
      ? 'concentration reducing response to 50% of control (E0)'
      : 'inhibition never reaches 50% of control (incomplete)',
  };
}

function comboMetrics(analysis: ComboAnalysis): Metric[] {
  return [
    {
      key: 'blissExpected',
      label: 'Bliss expected fraction',
      value: analysis.blissExpected,
      note: 'fa+fb-fa*fb',
    },
    {
      key: 'blissExcess',
      label: 'Bliss excess',
      value: analysis.blissExcess,
      note: '>0 synergy, ~0 additive, <0 antagonism',
    },
    {
      key: 'loeweCI',
      label: 'Loewe combination index',
      value: analysis.loeweCI,
      note: 'CI<1 synergy, ~1 additive, CI>1 antagonism',
    },
  ];
}

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

function runCurve(params: DoseResponseParams): SimResult {
  const p: HillParams = { e0: params.e0, emax: params.emax, ec50: params.ec50, hill: params.hill };
  const concentrations =
    params.concentrations ??
    logConcentrationGrid(params.logConcMin, params.logConcMax, params.numPoints);
  const curve = doseResponseCurve(p, concentrations);

  const logC = curve.map((c) => c.logConcentration);
  const response = curve.map((c) => c.response);
  const y: Record<string, number[]> = { response };

  const noisy = noisyResponses(response, params.noiseCv, params.seed);
  if (noisy) y.measuredResponse = noisy;

  const metrics: Metric[] = [
    {
      key: 'ec50',
      label: 'EC50',
      value: p.ec50,
      unit: 'concentration',
      note: 'halfway between E0 and Emax',
    },
    { key: 'hillSlope', label: 'Hill slope', value: p.hill },
    { key: 'emax', label: 'Emax', value: p.emax, note: 'saturating effect' },
    ic50Metric(p),
  ];

  const series: Series[] = [{ x: logC, y, xLabel: 'log10(concentration)', yLabel: 'response' }];

  let detail: Record<string, unknown> = { mode: 'curve', ...p };

  if (params.combo) {
    const analysis = analyzeCombination(
      params.combo.drugA,
      params.combo.drugB,
      params.combo.doseA,
      params.combo.doseB,
      params.combo.faObserved,
    );
    metrics.push(...comboMetrics(analysis));
    detail = { ...detail, combo: analysis };
  }

  return {
    engine: 'dose-response',
    summary: `Hill dose-response: EC50 ${p.ec50} (n=${p.hill}), effect ${p.e0} -> ${p.emax}.`,
    metrics,
    series,
    detail,
    provenance: provenance('dose-response', '1.0.0', params, params.seed),
  };
}

function runFit(params: DoseResponseParams, data: DataPoint[]): SimResult {
  const fit = fitHill(data);
  const fitted: HillParams = { e0: fit.e0, emax: fit.emax, ec50: fit.ec50, hill: fit.hill };

  // Observed points (sorted by concentration for a clean series) plus the
  // fitted curve sampled at the same concentrations.
  const sorted = [...data].sort((a, b) => a.concentration - b.concentration);
  const logC = sorted.map((d) => Math.log10(d.concentration));
  const observed = sorted.map((d) => d.response);
  const fittedResponse = sorted.map((d) => hillResponse(d.concentration, fitted));

  const metrics: Metric[] = [
    { key: 'ec50', label: 'EC50 (fitted)', value: fit.ec50, unit: 'concentration' },
    { key: 'hillSlope', label: 'Hill slope (fitted)', value: fit.hill },
    { key: 'emax', label: 'Emax (fitted)', value: fit.emax },
    { key: 'e0', label: 'E0 (fitted)', value: fit.e0 },
    ic50Metric(fitted),
    { key: 'rmse', label: 'Fit RMSE', value: fit.rmse },
    { key: 'r2', label: 'Fit R^2', value: fit.r2 },
  ];

  const series: Series[] = [
    {
      x: logC,
      y: { observed, fitted: fittedResponse },
      xLabel: 'log10(concentration)',
      yLabel: 'response',
    },
  ];

  return {
    engine: 'dose-response',
    summary: `Fitted Hill: EC50 ${fit.ec50.toPrecision(3)}, slope ${fit.hill.toPrecision(3)}, Emax ${fit.emax.toPrecision(3)} (R^2 ${fit.r2.toFixed(3)}).`,
    metrics,
    series,
    detail: { mode: 'fit', ...fit },
    provenance: provenance('dose-response', '1.0.0', params, params.seed),
  };
}

/** Pure, deterministic entry point. Fits when `data` is supplied, else generates a curve. */
export function run(rawParams: Partial<DoseResponseParams> = {}): SimResult {
  const params = paramsSchema.parse(rawParams);
  if (params.data && params.data.length > 0) {
    return runFit(params, params.data);
  }
  return runCurve(params);
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

export const spec: EngineSpec<DoseResponseParams> = {
  slug: 'dose-response',
  title: 'Dose-Response & Pharmacodynamics',
  domain: 'drug-discovery',
  version: '1.0.0',
  description:
    'Sigmoidal Hill dose-response modelling: E = E0 + (Emax-E0)*C^n/(EC50^n+C^n). Generates dose-response curves over a log-concentration grid, fits EC50/IC50, Hill slope and plateaus from noisy data by grid-seeded Levenberg-Marquardt least squares, distinguishes the relative EC50 (potency parameter) from the absolute IC50 (50% of control), and scores two-drug combinations with Bliss independence and the Loewe additivity combination index.',
  references: [
    'Hill, A.V. (1910) The possible effects of the aggregation of the molecules of haemoglobin. J. Physiol. 40:iv-vii.',
    'Motulsky, H. & Christopoulos, A. (2004) Fitting Models to Biological Data using Linear and Nonlinear Regression.',
    'Chou, T.-C. (2006) Theoretical basis, experimental design, and computerized simulation of synergism and antagonism. Pharmacol. Rev. 58:621-681.',
    'Bliss, C.I. (1939) The toxicity of poisons applied jointly. Ann. Appl. Biol. 26:585-615.',
    'Loewe, S. (1953) The problem of synergism and antagonism of combined drugs. Arzneimittelforschung 3:285-290.',
  ],
  // The schema uses zod defaults (making inputs optional) while EngineSpec pins
  // z.ZodType<TParams>; the parsed *output* is exactly DoseResponseParams, so
  // this cast is sound.
  paramsSchema: paramsSchema as z.ZodType<DoseResponseParams>,
  run,
  example: paramsSchema.parse({
    e0: 0,
    emax: 100,
    ec50: 50,
    hill: 1,
    logConcMin: -1,
    logConcMax: 4,
    numPoints: 49,
  }),
  tags: [
    'pharmacodynamics',
    'dose-response',
    'hill-equation',
    'ec50',
    'ic50',
    'drug-combination',
    'bliss',
    'loewe',
  ],
};

export default spec;
