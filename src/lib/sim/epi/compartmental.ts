/**
 * Epidemic compartmental models (SIR / SEIR / SIRD).
 *
 * Deterministic, well-mixed, closed-population transmission models integrated with
 * the shared adaptive RK45 (Dormand–Prince) solver. Individuals flow between mutually
 * exclusive compartments and the total population N is conserved (no births/deaths
 * other than disease mortality in SIRD, which merely moves mass I → D within N).
 *
 * Frequency-dependent (standard) incidence is used: the force of infection is
 *   λ = β · I / N,
 * so the number of new infections per unit time is β·S·I/N. β is the effective
 * contact-and-transmission rate, γ the removal (recovery) rate, σ the incubation
 * rate (E → I) for SEIR, and μ the disease-induced mortality rate for SIRD.
 *
 * Governing equations (state written as [S, E, I, R, D]):
 *
 *   SIR    dS/dt = -βSI/N
 *          dI/dt =  βSI/N − γI
 *          dR/dt =  γI
 *
 *   SEIR   dS/dt = -βSI/N
 *          dE/dt =  βSI/N − σE
 *          dI/dt =  σE   − γI
 *          dR/dt =  γI
 *
 *   SIRD   dS/dt = -βSI/N
 *          dI/dt =  βSI/N − (γ+μ)I
 *          dR/dt =  γI
 *          dD/dt =  μI
 *
 * Derived epidemiology:
 *   - Basic reproduction number R0 = β/γ (SIR, SEIR) or β/(γ+μ) (SIRD). The latent
 *     period in SEIR delays but does not change R0 in the absence of vital dynamics.
 *   - Herd-immunity threshold  H = 1 − 1/R0  (critical immune fraction that drives the
 *     effective reproduction number below 1).
 *   - Final epidemic size (attack rate) A = 1 − s(∞), the fraction ever infected,
 *     obtained by solving the transcendental final-size equation
 *         ln(s∞/s0) = R0·(s∞ − s0 − i0),
 *     which for a fully-susceptible start reduces to  s∞ = e^{−R0(1−s∞)}.
 *   - Epidemic peak (SIR / SIRD only, direct-transmission models): dI/dt = 0 ⇒ S = N/R0.
 *     For SIR this yields the closed-form peak prevalence
 *         i_max = i0 + s0 − 1/R0 − (1/R0)·ln(R0·s0),
 *     valid only when the effective reproduction number R0·s0 > 1 (otherwise I declines
 *     monotonically from t=0 and the peak is simply i0). The peak time has no elementary
 *     closed form and is read from the integrated trajectory. For SEIR, dI/dt = σE − γI,
 *     so the peak occurs where σE = γI — a condition that lags the S = N/R0 crossing by
 *     roughly the mean latent period 1/σ, not the same instant.
 *
 * References:
 *   - Kermack WO, McKendrick AG (1927). A contribution to the mathematical theory of
 *     epidemics. Proc. R. Soc. Lond. A 115:700–721.
 *   - Anderson RM, May RM. "Infectious Diseases of Humans" (1991).
 *   - Diekmann O, Heesterbeek JAP. "Mathematical Epidemiology of Infectious Diseases"
 *     (2000) — final-size relation and next-generation R0.
 *   - Hethcote HW (2000). The mathematics of infectious diseases. SIAM Review 42:599.
 */

import { z } from 'zod';
import { rk45 } from '../core/ode';
import { createRng } from '../core/prng';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

// ---------------------------------------------------------------------------
// Model kinds & closed-form epidemiology
// ---------------------------------------------------------------------------

export type EpiModel = 'SIR' | 'SEIR' | 'SIRD';

/** State vector layout used everywhere: index 0..4 = S, E, I, R, D. */
export const S_IDX = 0;
export const E_IDX = 1;
export const I_IDX = 2;
export const R_IDX = 3;
export const D_IDX = 4;

/**
 * Basic reproduction number R0.
 *   SIR / SEIR : β/γ            (mean infectious period 1/γ)
 *   SIRD       : β/(γ+μ)        (infectious period shortened by mortality μ)
 * R0 is the expected number of secondary cases produced by one infectious
 * individual in an otherwise fully susceptible population.
 */
export function basicReproductionNumber(
  model: EpiModel,
  beta: number,
  gamma: number,
  mu = 0,
): number {
  const removal = model === 'SIRD' ? gamma + mu : gamma;
  return beta / removal;
}

/**
 * Herd-immunity threshold H = 1 − 1/R0: the minimum immune fraction needed for the
 * effective reproduction number R_eff = R0·s to fall to 1. Clamped to 0 when R0 ≤ 1
 * (no epidemic ⇒ no immunity required).
 */
export function herdImmunityThreshold(R0: number): number {
  if (R0 <= 1) return 0;
  return 1 - 1 / R0;
}

/**
 * Final epidemic size (attack rate) A = 1 − s(∞), the total fraction of the
 * population ever infected. Solves the transcendental final-size equation
 *   ln(s∞/s0) = R0·(s∞ − s0 − i0)
 * for the epidemic root s∞ ∈ (0, s0] by bisection. `s0` and `i0` are the initial
 * susceptible and infectious FRACTIONS (they should satisfy s0 + i0 ≈ 1 for the
 * standard interpretation). A tiny positive i0 guarantees a unique non-trivial root.
 */
export function finalSize(R0: number, s0 = 1, i0 = 0): number {
  if (R0 <= 0) return Math.min(1, Math.max(0, i0));
  // g(s) = ln(s/s0) − R0·(s − s0 − i0). g(s0) = R0·i0 ≥ 0, g(0+) = −∞, and g has a
  // single sign change on (0, s0]: exactly the epidemic final-size root we want.
  const g = (s: number) => Math.log(s / s0) - R0 * (s - s0 - i0);
  let lo = 1e-15; // g(lo) → −∞ < 0
  let hi = s0; // g(hi) = R0·i0 ≥ 0
  // If i0 is exactly 0 the upper root is the trivial s∞ = s0; nudge hi down so the
  // bracket captures the non-trivial epidemic root when one exists (R0 > 1).
  if (i0 <= 0 && R0 > 1) hi = 1 / R0;
  for (let iter = 0; iter < 200; iter++) {
    const mid = 0.5 * (lo + hi);
    if (g(mid) > 0) hi = mid;
    else lo = mid;
  }
  const sInf = 0.5 * (lo + hi);
  return Math.min(1, Math.max(0, 1 - sInf));
}

/**
 * Closed-form SIR peak prevalence (fraction infectious at the epidemic peak),
 * valid for the SIR model. Derived from the conserved quantity
 *   i + s − (1/R0)·ln s = const
 * evaluated at the peak where s = 1/R0:
 *   i_max = i0 + s0 − 1/R0 − (1/R0)·ln(R0·s0).
 * This closed form only applies when the trajectory actually reaches S = N/R0, i.e.
 * when the EFFECTIVE reproduction number R0·s0 > 1 (equivalently s0 > 1/R0). If the
 * initial susceptible fraction s0 is already at or below the threshold 1/R0 (e.g. due
 * to pre-existing immunity/a large removed fraction), S never crosses N/R0 and I
 * declines monotonically from t=0, so the peak equals the initial i0.
 */
export function peakInfectedFractionSIR(R0: number, s0 = 1, i0 = 0): number {
  if (R0 * s0 <= 1) return i0;
  return i0 + s0 - 1 / R0 - (1 / R0) * Math.log(R0 * s0);
}

// ---------------------------------------------------------------------------
// Vector field & integration
// ---------------------------------------------------------------------------

export interface EpiRates {
  beta: number;
  gamma: number;
  /** Incubation rate σ (E → I); used only by SEIR. */
  sigma: number;
  /** Disease mortality rate μ (I → D); used only by SIRD. */
  mu: number;
}

/**
 * Build the compartmental derivative f(t, y) for the chosen model. The returned
 * function is pure and depends only on (t, y), as required by the core integrator.
 * The full 5-vector [S, E, I, R, D] is always used; compartments not present in a
 * given model simply keep a zero derivative (and therefore stay at their zero start).
 */
export function makeDerivative(model: EpiModel, r: EpiRates, N: number) {
  const { beta, gamma, sigma, mu } = r;
  return (_t: number, y: number[]): number[] => {
    const S = y[S_IDX];
    const E = y[E_IDX];
    const I = y[I_IDX];
    const infection = (beta * S * I) / N; // βSI/N new infections per unit time
    switch (model) {
      case 'SEIR':
        return [-infection, infection - sigma * E, sigma * E - gamma * I, gamma * I, 0];
      case 'SIRD':
        return [-infection, 0, infection - (gamma + mu) * I, gamma * I, mu * I];
      default: // SIR
        return [-infection, 0, infection - gamma * I, gamma * I, 0];
    }
  };
}

export interface EpiTrajectory {
  t: number[];
  S: number[];
  E: number[];
  I: number[];
  R: number[];
  D: number[];
}

/**
 * Integrate a compartmental model from t = 0 to tMax with the shared adaptive RK45.
 * Initial condition: one infectious seed of size i0, the remainder susceptible,
 * everything else empty. Because Σ(dy/dt) = 0 exactly, total mass N is conserved to
 * machine precision along the whole trajectory.
 */
export function simulate(
  model: EpiModel,
  r: EpiRates,
  N: number,
  i0: number,
  tMax: number,
  outputPoints: number,
): EpiTrajectory {
  const y0 = [N - i0, 0, i0, 0, 0]; // [S, E, I, R, D]
  const f = makeDerivative(model, r, N);
  const traj = rk45(f, y0, 0, tMax, { tol: 1e-9, outputPoints });
  return {
    t: traj.t,
    S: traj.y.map((row) => row[S_IDX]),
    E: traj.y.map((row) => row[E_IDX]),
    I: traj.y.map((row) => row[I_IDX]),
    R: traj.y.map((row) => row[R_IDX]),
    D: traj.y.map((row) => row[D_IDX]),
  };
}

/** Locate the epidemic peak (max prevalence) and its time from a trajectory. */
export function findPeak(traj: EpiTrajectory): {
  peakInfected: number;
  peakDay: number;
  peakIndex: number;
} {
  let peakInfected = Number.NEGATIVE_INFINITY;
  let peakIndex = 0;
  for (let i = 0; i < traj.I.length; i++) {
    if (traj.I[i] > peakInfected) {
      peakInfected = traj.I[i];
      peakIndex = i;
    }
  }
  return { peakInfected, peakDay: traj.t[peakIndex], peakIndex };
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

export const compartmentalParams = z.object({
  /** Which compartmental structure to integrate. */
  model: z.enum(['SIR', 'SEIR', 'SIRD']).default('SIR'),
  /** Effective transmission rate β (per unit time). */
  beta: z.number().positive(),
  /** Removal / recovery rate γ (per unit time); mean infectious period = 1/γ. */
  gamma: z.number().min(1e-9),
  /** Incubation rate σ (E → I); mean latent period = 1/σ. Used by SEIR. */
  sigma: z.number().positive().default(0.2),
  /** Disease mortality rate μ (I → D). Used by SIRD. */
  mu: z.number().min(0).default(0.02),
  /** Total (constant) population N. */
  population: z.number().min(1e-9).default(1_000_000),
  /** Initial number of infectious individuals. */
  i0: z.number().positive().default(1),
  /** Simulation horizon in the same time units as the rates. */
  tMax: z.number().positive().default(160),
  /** Number of evenly spaced output samples along the trajectory. */
  outputPoints: z.number().int().positive().default(400),
  /**
   * Optional case-ascertainment probability in (0, 1] for a stochastic "reported
   * incidence" series (imperfect surveillance). 0 (default) disables it and keeps
   * the whole run purely deterministic ODE output.
   */
  reportingRate: z.number().min(0).max(1).default(0),
  /** Seed for the (optional) reporting RNG — determinism is guaranteed per seed. */
  seed: z.union([z.number(), z.string()]).default('compartmental'),
});

export type CompartmentalParams = z.input<typeof compartmentalParams>;

export interface CompartmentalDetail {
  model: EpiModel;
  r0: number;
  herdImmunityThreshold: number;
  /** Peak prevalence as a fraction of N. */
  peakInfectedFraction: number;
  /** Analytic final size from the transcendental equation (attack-rate fraction). */
  finalSizeAnalytic: number;
  /** Final size read from the simulated trajectory: 1 − S(tMax)/N. */
  finalSizeSimulated: number;
  totalRecovered: number;
  totalDeaths: number;
  trajectory: EpiTrajectory;
  /** Deterministic stochastic surveillance series (only when reportingRate > 0). */
  reportedIncidence?: { t: number[]; reported: number[] };
}

const VERSION = '1.0.0';

function run(rawParams: CompartmentalParams): SimResult<CompartmentalDetail> {
  const p = compartmentalParams.parse(rawParams);
  const model = p.model;
  const N = p.population;
  const rates: EpiRates = { beta: p.beta, gamma: p.gamma, sigma: p.sigma, mu: p.mu };

  // Derived epidemiology.
  const R0 = basicReproductionNumber(model, p.beta, p.gamma, p.mu);
  const herd = herdImmunityThreshold(R0);
  const s0 = (N - p.i0) / N;
  const i0Frac = p.i0 / N;
  const attackRate = finalSize(R0, s0, i0Frac);

  // Integrate the trajectory.
  const traj = simulate(model, rates, N, p.i0, p.tMax, p.outputPoints);
  const { peakInfected, peakDay } = findPeak(traj);
  const last = traj.t.length - 1;
  const finalSizeSim = 1 - traj.S[last] / N;
  const totalRecovered = traj.R[last];
  const totalDeaths = traj.D[last];

  // Optional deterministic stochastic reporting (imperfect case ascertainment).
  let reportedIncidence: CompartmentalDetail['reportedIncidence'];
  if (p.reportingRate > 0) {
    const rng = createRng(p.seed);
    const reported: number[] = [0];
    for (let k = 1; k < traj.t.length; k++) {
      // True new infections in [t_{k-1}, t_k] = drop in susceptibles.
      const newInfections = Math.max(0, Math.round(traj.S[k - 1] - traj.S[k]));
      // Each true case is reported independently with probability reportingRate.
      reported.push(rng.binomial(newInfections, p.reportingRate));
    }
    reportedIncidence = { t: traj.t, reported };
  }

  const detail: CompartmentalDetail = {
    model,
    r0: R0,
    herdImmunityThreshold: herd,
    peakInfectedFraction: peakInfected / N,
    finalSizeAnalytic: attackRate,
    finalSizeSimulated: finalSizeSim,
    totalRecovered,
    totalDeaths,
    trajectory: traj,
    reportedIncidence,
  };

  // Model-appropriate series keys (E only for SEIR, D only for SIRD).
  const yseries: Record<string, number[]> = { S: traj.S, I: traj.I, R: traj.R };
  if (model === 'SEIR') yseries.E = traj.E;
  if (model === 'SIRD') yseries.D = traj.D;

  // Whether prevalence actually grows from t=0 is governed by the EFFECTIVE
  // reproduction number R0·s0 (accounting for any initial immune/removed fraction),
  // not the raw R0 (which is defined for an otherwise fully susceptible population).
  const effectiveR0 = R0 * s0;
  const summary =
    `${model}: R0=${R0.toFixed(2)} ⇒ ${effectiveR0 > 1 ? 'epidemic' : 'no epidemic (dies out)'}. ` +
    `Herd-immunity threshold ${(herd * 100).toFixed(1)}%, ` +
    `attack rate ${(attackRate * 100).toFixed(1)}%, ` +
    `peak prevalence ${((peakInfected / N) * 100).toFixed(1)}% on day ${peakDay.toFixed(1)}.`;

  return {
    engine: 'compartmental',
    summary,
    metrics: [
      {
        key: 'r0',
        label: 'Basic reproduction number R₀',
        value: R0,
        note: model === 'SIRD' ? 'β/(γ+μ)' : 'β/γ',
      },
      {
        key: 'herdImmunityThreshold',
        label: 'Herd-immunity threshold',
        value: herd,
        note: '1 − 1/R₀ (fraction that must be immune)',
      },
      {
        key: 'peakInfected',
        label: 'Peak infectious',
        value: peakInfected,
        unit: 'individuals',
        note:
          model === 'SEIR'
            ? 'Maximum simultaneous prevalence (dI/dt = 0 at σE = γI; lags the S = N/R₀ ' +
              'crossing by roughly the mean latent period 1/σ)'
            : 'Maximum simultaneous prevalence (dI/dt = 0 at S = N/R₀)',
      },
      {
        key: 'peakDay',
        label: 'Peak day',
        value: peakDay,
        unit: 'time',
        note: 'Time of maximum prevalence',
      },
      {
        key: 'finalSize',
        label: 'Final epidemic size (attack rate)',
        value: attackRate,
        note: 'Fraction ever infected, from the final-size equation',
      },
    ],
    series: [
      {
        x: traj.t,
        y: yseries,
        xLabel: 'time',
        yLabel: 'individuals',
      },
    ],
    detail,
    provenance: provenance('compartmental', VERSION, { ...p }, p.seed),
  };
}

export const spec: EngineSpec<CompartmentalParams, CompartmentalDetail> = {
  slug: 'compartmental',
  title: 'Epidemic Compartmental Models',
  domain: 'epidemiology',
  version: VERSION,
  description:
    'Deterministic SIR / SEIR / SIRD transmission models with standard (frequency-' +
    'dependent) incidence βSI/N, integrated by the shared adaptive RK45 solver. ' +
    'Computes the basic reproduction number R₀, the herd-immunity threshold 1 − 1/R₀, ' +
    'the epidemic peak (height and time), and the final epidemic size (attack rate) by ' +
    'numerically solving the transcendental final-size equation. Population is conserved ' +
    'exactly and an optional seeded case-ascertainment model produces a stochastic ' +
    'reported-incidence series for surveillance studies.',
  references: [
    'Kermack WO, McKendrick AG (1927). Proc. R. Soc. Lond. A 115:700.',
    'Anderson RM, May RM. Infectious Diseases of Humans (1991).',
    'Diekmann O, Heesterbeek JAP. Mathematical Epidemiology of Infectious Diseases (2000).',
    'Hethcote HW (2000). SIAM Review 42:599.',
  ],
  paramsSchema: compartmentalParams,
  run,
  example: {
    model: 'SIR',
    beta: 0.5,
    gamma: 0.2,
    sigma: 0.2,
    mu: 0.02,
    population: 1_000_000,
    i0: 10,
    tMax: 160,
    outputPoints: 400,
    reportingRate: 0,
    seed: 'compartmental',
  },
  tags: ['epidemiology', 'SIR', 'SEIR', 'SIRD', 'R0', 'herd-immunity', 'ode', 'final-size'],
};

export default spec;
