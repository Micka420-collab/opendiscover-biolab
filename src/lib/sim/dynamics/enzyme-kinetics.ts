/**
 * Enzyme kinetics engine.
 *
 * Models the initial-rate behaviour of a single-substrate enzyme under the
 * Michaelis–Menten (MM) framework, its three classical reversible-inhibition
 * variants, and the cooperative Hill extension. It also integrates the
 * time-course ("progress curve") of substrate depletion d[S]/dt = -v([S]) with
 * the shared adaptive RK45 integrator, and provides the Lineweaver–Burk
 * double-reciprocal linearisation used to read Km and Vmax off assay data.
 *
 * Assumptions (standard steady-state / rapid-equilibrium MM):
 *   - Free enzyme ≪ substrate, so [S] is (approximately) unchanged on the
 *     timescale that the ES complex reaches quasi-steady state.
 *   - A single substrate, single catalytic site (Hill relaxes the last point to
 *     n cooperating sites via an empirical Hill coefficient).
 *   - Reversible inhibitors at rapid equilibrium; product inhibition ignored.
 *   - The progress curve additionally assumes v depends only on the current
 *     [S] (no enzyme inactivation, no back reaction), which yields the classic
 *     integrated MM relation  Vmax·t = (S0 − S) + Km·ln(S0/S).
 *
 * References:
 *   - Michaelis L, Menten ML (1913). Die Kinetik der Invertinwirkung.
 *   - Cornish-Bowden A. "Fundamentals of Enzyme Kinetics", 4th ed. (2012).
 *   - Segel IH. "Enzyme Kinetics" (1975) — inhibition rate laws.
 *   - Hill AV (1910). The possible effects of the aggregation of haemoglobin.
 */

import { z } from 'zod';
import { rk45 } from '../core/ode';
import { createRng } from '../core/prng';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

// ---------------------------------------------------------------------------
// Core rate laws (each is a pure scalar function of the substrate concentration)
// ---------------------------------------------------------------------------

/**
 * Michaelis–Menten initial velocity.
 *   v = Vmax·[S] / (Km + [S])
 * At [S] = Km the enzyme runs at exactly half Vmax (the defining property of Km).
 */
export function michaelisMenten(S: number, Vmax: number, Km: number): number {
  if (S <= 0) return 0;
  return (Vmax * S) / (Km + S);
}

/**
 * Competitive inhibition: the inhibitor competes for the free-enzyme active
 * site, inflating the apparent Km by the factor α = 1 + I/Ki while leaving Vmax
 * unchanged (infinite substrate still out-competes the inhibitor).
 *   v = Vmax·[S] / (α·Km + [S])
 */
export function competitive(S: number, Vmax: number, Km: number, I: number, Ki: number): number {
  const alpha = inhibitionFactor(I, Ki);
  return michaelisMenten(S, Vmax, Km * alpha);
}

/**
 * Pure noncompetitive inhibition: the inhibitor binds enzyme and ES complex
 * equally, scaling Vmax down by α = 1 + I/Ki while leaving Km unchanged.
 *   v = (Vmax/α)·[S] / (Km + [S])
 */
export function noncompetitive(S: number, Vmax: number, Km: number, I: number, Ki: number): number {
  const alpha = inhibitionFactor(I, Ki);
  return michaelisMenten(S, Vmax / alpha, Km);
}

/**
 * Uncompetitive inhibition: the inhibitor binds only the ES complex, scaling
 * BOTH Vmax and Km down by α = 1 + I/Ki. Equivalent closed form:
 *   v = Vmax·[S] / (Km + α·[S])
 */
export function uncompetitive(S: number, Vmax: number, Km: number, I: number, Ki: number): number {
  if (S <= 0) return 0;
  const alpha = inhibitionFactor(I, Ki);
  return (Vmax * S) / (Km + alpha * S);
}

/**
 * Hill equation for cooperative binding with n interacting sites and
 * half-saturation constant K (the [S] giving half Vmax).
 *   v = Vmax·[S]^n / (K^n + [S]^n)
 * With n = 1 this is algebraically identical to Michaelis–Menten with Km = K.
 */
export function hill(S: number, Vmax: number, K: number, n: number): number {
  if (S <= 0) return 0;
  const sn = S ** n;
  return (Vmax * sn) / (K ** n + sn);
}

/** Reversible-inhibition scaling factor α = 1 + I/Ki (α ≥ 1). */
function inhibitionFactor(I: number, Ki: number): number {
  if (I <= 0 || !Number.isFinite(Ki) || Ki <= 0) return 1;
  return 1 + I / Ki;
}

// ---------------------------------------------------------------------------
// Unified velocity model dispatched by mode
// ---------------------------------------------------------------------------

export type KineticsMode = 'mm' | 'competitive' | 'noncompetitive' | 'uncompetitive' | 'hill';

interface Model {
  vmax: number;
  km: number;
  mode: KineticsMode;
  inhibitor: number;
  ki: number;
  hillN: number;
}

/** Evaluate the model velocity at a substrate concentration (clamped at 0). */
export function velocity(S: number, m: Model): number {
  const s = Math.max(S, 0);
  switch (m.mode) {
    case 'competitive':
      return competitive(s, m.vmax, m.km, m.inhibitor, m.ki);
    case 'noncompetitive':
      return noncompetitive(s, m.vmax, m.km, m.inhibitor, m.ki);
    case 'uncompetitive':
      return uncompetitive(s, m.vmax, m.km, m.inhibitor, m.ki);
    case 'hill':
      return hill(s, m.vmax, m.km, m.hillN);
    default:
      return michaelisMenten(s, m.vmax, m.km);
  }
}

/**
 * Apparent (observed) Vmax — the velocity the model asymptotes to as [S] → ∞.
 * Competitive & Hill keep the true Vmax; noncompetitive & uncompetitive lose a
 * factor α to the inhibitor.
 */
export function apparentVmax(m: Model): number {
  const alpha = inhibitionFactor(m.inhibitor, m.ki);
  if (m.mode === 'noncompetitive' || m.mode === 'uncompetitive') return m.vmax / alpha;
  return m.vmax;
}

/**
 * Apparent half-saturation constant — the [S] at which v reaches half of the
 * apparent Vmax. This is what a competitive inhibitor pushes UP (harder to
 * half-saturate) and an uncompetitive inhibitor pushes DOWN.
 */
export function apparentKm(m: Model): number {
  const alpha = inhibitionFactor(m.inhibitor, m.ki);
  switch (m.mode) {
    case 'competitive':
      return m.km * alpha; // α·Km
    case 'uncompetitive':
      return m.km / alpha; // Km/α
    default:
      return m.km; // MM, noncompetitive, Hill (K)
  }
}

// ---------------------------------------------------------------------------
// Curves & transforms
// ---------------------------------------------------------------------------

export interface VelocityCurve {
  S: number[];
  v: number[];
}

/** Velocity-vs-substrate curve on an evenly spaced grid [0, sMax]. */
export function velocityVsSubstrate(m: Model, sMax: number, points: number): VelocityCurve {
  const S: number[] = [];
  const v: number[] = [];
  for (let i = 0; i <= points; i++) {
    const s = (sMax * i) / points;
    S.push(s);
    v.push(velocity(s, m));
  }
  return { S, v };
}

export interface ProgressCurve {
  t: number[];
  S: number[];
  v: number[];
}

/**
 * Progress curve: integrate substrate depletion d[S]/dt = -v([S]) from [S] = S0
 * with the shared adaptive RK45 (Dormand–Prince) integrator. `tEnd` defaults to
 * a horizon long enough to consume ~99.9% of the substrate.
 */
export function progressCurve(
  m: Model,
  S0: number,
  points: number,
  tEndOverride?: number,
): ProgressCurve {
  const vMax = apparentVmax(m);
  const kM = apparentKm(m);
  // Integrated-MM estimate of the time to deplete S0 → 0.1% of S0.
  const tEnd = tEndOverride ?? ((S0 + kM * Math.log(1000)) / vMax) * 1.1;
  const f = (_t: number, y: number[]): number[] => [-velocity(y[0], m)];
  const traj = rk45(f, [S0], 0, tEnd, { tol: 1e-9, outputPoints: points });
  const t = traj.t;
  const S = traj.y.map((row) => Math.max(row[0], 0));
  const v = S.map((s) => velocity(s, m));
  return { t, S, v };
}

export interface LineweaverBurk {
  invS: number[];
  invV: number[];
  /** Slope of the double-reciprocal line = Km/Vmax. */
  slope: number;
  /** y-intercept = 1/Vmax. */
  intercept: number;
  /** x-intercept = -1/Km. */
  xIntercept: number;
  /** Vmax recovered from the linear fit (= 1/intercept). */
  vmaxFit: number;
  /** Km recovered from the linear fit (= slope·Vmax). */
  kmFit: number;
}

/**
 * Lineweaver–Burk double-reciprocal transform with an ordinary-least-squares
 * fit. For ideal MM data the line is  1/v = (Km/Vmax)·(1/[S]) + 1/Vmax, so the
 * fit recovers Km and Vmax exactly.
 */
export function lineweaverBurk(S: number[], v: number[]): LineweaverBurk {
  const invS: number[] = [];
  const invV: number[] = [];
  for (let i = 0; i < S.length; i++) {
    if (S[i] > 0 && v[i] > 0) {
      invS.push(1 / S[i]);
      invV.push(1 / v[i]);
    }
  }
  const n = invS.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += invS[i];
    sy += invV[i];
    sxx += invS[i] * invS[i];
    sxy += invS[i] * invV[i];
  }
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  const vmaxFit = intercept !== 0 ? 1 / intercept : Number.POSITIVE_INFINITY;
  const kmFit = slope * vmaxFit;
  const xIntercept = slope !== 0 ? -intercept / slope : Number.NaN;
  return { invS, invV, slope, intercept, xIntercept, vmaxFit, kmFit };
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

export const enzymeKineticsParams = z.object({
  /** Maximum reaction velocity Vmax (concentration·time⁻¹). */
  vmax: z.number().positive(),
  /** Michaelis constant Km (concentration). */
  km: z.number().positive(),
  /** Upper end of the substrate grid; defaults to 20·Km. */
  sMax: z.number().positive().optional(),
  /** Inhibitor concentration I (0 = none). */
  inhibitor: z.number().min(0).default(0),
  /** Inhibition constant Ki. */
  ki: z.number().positive().default(1),
  /** Which rate law to use. */
  mode: z.enum(['mm', 'competitive', 'noncompetitive', 'uncompetitive', 'hill']).default('mm'),
  /** Hill coefficient (only used when mode = 'hill'; n = 1 ⇒ plain MM). */
  hillN: z.number().positive().default(1),
  /** Number of grid points for the velocity curve. */
  gridPoints: z.number().int().positive().default(100),
  /** Number of output points for the progress curve. */
  progressPoints: z.number().int().positive().default(120),
  /**
   * Optional simulated measurement noise (coefficient of variation) applied to a
   * synthetic assay dataset in `detail.assayData`. 0 ⇒ no noise. When > 0 the
   * noise is drawn deterministically from the seeded core RNG.
   */
  noiseCv: z.number().min(0).default(0),
  /** Seed for the (optional) measurement-noise RNG. */
  seed: z.union([z.number(), z.string()]).default('enzyme-kinetics'),
});

export type EnzymeKineticsParams = z.input<typeof enzymeKineticsParams>;

export interface EnzymeKineticsDetail {
  mode: KineticsMode;
  apparentVmax: number;
  apparentKm: number;
  progressCurve: ProgressCurve;
  lineweaverBurk: LineweaverBurk;
  /** Synthetic noisy assay data (present only when noiseCv > 0). */
  assayData?: { S: number[]; vMeasured: number[]; kmFit: number; vmaxFit: number };
}

const VERSION = '1.0.0';

function run(rawParams: EnzymeKineticsParams): SimResult<EnzymeKineticsDetail> {
  const p = enzymeKineticsParams.parse(rawParams);
  const model: Model = {
    vmax: p.vmax,
    km: p.km,
    mode: p.mode,
    inhibitor: p.inhibitor,
    ki: p.ki,
    hillN: p.hillN,
  };
  const sMax = p.sMax ?? 20 * p.km;

  // Velocity-vs-substrate curve.
  const curve = velocityVsSubstrate(model, sMax, p.gridPoints);

  // Lineweaver–Burk fit on the clean curve (drops [S] = 0).
  const lb = lineweaverBurk(curve.S, curve.v);

  // Progress curve via RK45.
  const progress = progressCurve(model, sMax, p.progressPoints);

  const vMaxApp = apparentVmax(model);
  const kMApp = apparentKm(model);
  // vAtKm is the *base* Michaelis–Menten velocity at [S] = Km, which is exactly
  // Vmax/2 by construction — a self-check on the Km definition.
  const vAtKm = michaelisMenten(p.km, p.vmax, p.km);

  const detail: EnzymeKineticsDetail = {
    mode: p.mode,
    apparentVmax: vMaxApp,
    apparentKm: kMApp,
    progressCurve: progress,
    lineweaverBurk: lb,
  };

  // Optional deterministic synthetic assay data with measurement noise.
  if (p.noiseCv > 0) {
    const rng = createRng(p.seed);
    // Log-spaced substrate points across the informative range.
    const nPts = 12;
    const S: number[] = [];
    const vMeasured: number[] = [];
    for (let i = 0; i < nPts; i++) {
      const s = 0.25 * kMApp * (sMax / (0.25 * kMApp) || 1) ** (i / (nPts - 1));
      const vClean = velocity(s, model);
      // Multiplicative Gaussian noise, clamped non-negative.
      const noisy = Math.max(0, vClean * (1 + rng.normal(0, p.noiseCv)));
      S.push(s);
      vMeasured.push(noisy);
    }
    const fit = lineweaverBurk(S, vMeasured);
    detail.assayData = { S, vMeasured, kmFit: fit.kmFit, vmaxFit: fit.vmaxFit };
  }

  const modeLabel = p.mode === 'mm' ? 'Michaelis–Menten' : p.mode;
  const summary =
    `${modeLabel}: Vmax=${p.vmax.toPrecision(3)}, Km=${p.km.toPrecision(3)} ` +
    `→ apparent Vmax=${vMaxApp.toPrecision(3)}, half-saturation at [S]=${kMApp.toPrecision(3)}.`;

  return {
    engine: 'enzyme-kinetics',
    summary,
    metrics: [
      { key: 'vmax', label: 'Vmax', value: p.vmax, note: 'Maximum velocity (catalytic)' },
      { key: 'km', label: 'Km', value: p.km, note: 'Michaelis constant' },
      {
        key: 'vAtKm',
        label: 'v at [S]=Km',
        value: vAtKm,
        note: 'Equals Vmax/2 by the definition of Km',
      },
      {
        key: 'halfSaturation',
        label: 'Half-saturation [S]',
        value: kMApp,
        note: 'Substrate needed to reach half the apparent Vmax',
      },
      {
        key: 'apparentVmax',
        label: 'Apparent Vmax',
        value: vMaxApp,
        note: 'Asymptotic velocity as [S] → ∞',
      },
    ],
    series: [
      {
        x: curve.S,
        y: { velocity: curve.v },
        xLabel: '[S]',
        yLabel: 'v',
      },
    ],
    detail,
    provenance: provenance('enzyme-kinetics', VERSION, { ...p, sMax }, p.seed),
  };
}

export const spec: EngineSpec<EnzymeKineticsParams, EnzymeKineticsDetail> = {
  slug: 'enzyme-kinetics',
  title: 'Enzyme Kinetics',
  domain: 'systems-biology',
  version: VERSION,
  description:
    'Single-substrate enzyme kinetics: Michaelis–Menten velocity, competitive / ' +
    'noncompetitive / uncompetitive reversible inhibition, the cooperative Hill ' +
    'equation, a velocity-vs-substrate curve, an RK45-integrated substrate ' +
    'progress curve (d[S]/dt = -v([S])), and the Lineweaver–Burk linearisation.',
  references: [
    'Michaelis L, Menten ML (1913). Biochem. Z. 49:333.',
    'Cornish-Bowden A. Fundamentals of Enzyme Kinetics, 4th ed. (2012).',
    'Segel IH. Enzyme Kinetics (1975).',
  ],
  paramsSchema: enzymeKineticsParams,
  run,
  example: {
    vmax: 10,
    km: 5,
    sMax: 200,
    inhibitor: 0,
    ki: 1,
    mode: 'mm',
    hillN: 1,
    gridPoints: 100,
    progressPoints: 120,
    noiseCv: 0,
    seed: 'enzyme-kinetics',
  },
  tags: ['enzyme', 'michaelis-menten', 'inhibition', 'hill', 'kinetics', 'systems-biology'],
};

export default spec;
