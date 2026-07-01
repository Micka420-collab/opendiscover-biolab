/**
 * Hodgkin–Huxley neuron model — the biophysical action-potential model that won
 * Hodgkin and Huxley the 1963 Nobel Prize in Physiology or Medicine.
 *
 * Four coupled ODEs describe the squid giant axon membrane: the potential V and
 * three voltage-gated ion-channel gating variables (n, m, h) for delayed-rectifier
 * K⁺ and fast Na⁺ conductances:
 *
 *   C_m dV/dt = I_ext − g_Na·m³h·(V−E_Na) − g_K·n⁴·(V−E_K) − g_L·(V−E_L)
 *   dn/dt = α_n(V)(1−n) − β_n(V)n
 *   dm/dt = α_m(V)(1−m) − β_m(V)m
 *   dh/dt = α_h(V)(1−h) − β_h(V)h
 *
 * Parameters below are the canonical set from Hodgkin & Huxley (1952), as
 * reproduced in essentially every neuroscience textbook (e.g. Dayan & Abbott,
 * "Theoretical Neuroscience", ch. 5): C_m=1 µF/cm², g_Na=120, g_K=36, g_L=0.3
 * mS/cm², E_Na=+50, E_K=−77, E_L=−54.4 mV, resting potential −65 mV.
 *
 * Integrated with the shared adaptive RK45 solver. Deterministic — no
 * randomness anywhere in the model.
 *
 * References:
 *   - Hodgkin AL, Huxley AF (1952). "A quantitative description of membrane
 *     current and its application to conduction and excitation in nerve."
 *     J. Physiol. 117:500–544.
 *   - Dayan P, Abbott LF. Theoretical Neuroscience (2001), ch. 5.
 */

import { z } from 'zod';
import { rk45 } from '../core/ode';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

export const hodgkinHuxleyParams = z.object({
  /** External stimulus current amplitude (µA/cm²). */
  iExt: z.number().default(10),
  /** Stimulus onset (ms). */
  stimStart: z.number().min(0).default(5),
  /** Stimulus duration (ms). */
  stimDuration: z.number().positive().default(1),
  /** Simulation horizon (ms). */
  tEnd: z.number().positive().default(50),
  /** Output samples for the trace. */
  outputPoints: z.number().int().positive().max(5000).default(500),
  /** Membrane capacitance (µF/cm²). */
  cm: z.number().positive().default(1),
  /** Maximal Na⁺ conductance (mS/cm²). */
  gNa: z.number().positive().default(120),
  /** Maximal K⁺ conductance (mS/cm²). */
  gK: z.number().positive().default(36),
  /** Leak conductance (mS/cm²). */
  gL: z.number().positive().default(0.3),
  /** Na⁺ reversal potential (mV). */
  eNa: z.number().default(50),
  /** K⁺ reversal potential (mV). */
  eK: z.number().default(-77),
  /** Leak reversal potential (mV). */
  eL: z.number().default(-54.4),
  /** Initial (resting) membrane potential (mV). */
  vRest: z.number().default(-65),
  /** RK45 relative/absolute tolerance. */
  tol: z.number().positive().default(1e-5),
});

export type HodgkinHuxleyParams = z.input<typeof hodgkinHuxleyParams>;

export interface HodgkinHuxleyDetail {
  spikeCount: number;
  spikeTimes: number[];
  peakPotential: number;
  restingCheck: { initial: number; afterQuietPeriod: number };
}

// ---------------------------------------------------------------------------
// Rate functions — numerically stable at the two removable singularities
// (V = −55 mV for n, V = −40 mV for m) via the analytic limit of x/(1−e^(−x/b)) → b.
// ---------------------------------------------------------------------------

/** x / (1 − exp(−x/b)), continuously extended through x = 0 (limit = b). */
function linearOverExpm1(x: number, b: number): number {
  if (Math.abs(x) < 1e-6) return b - x / 2; // first-order correction near the singularity
  return x / (1 - Math.exp(-x / b));
}

export function alphaN(V: number): number {
  return 0.01 * linearOverExpm1(V + 55, 10);
}
export function betaN(V: number): number {
  return 0.125 * Math.exp(-(V + 65) / 80);
}
export function alphaM(V: number): number {
  return 0.1 * linearOverExpm1(V + 40, 10);
}
export function betaM(V: number): number {
  return 4 * Math.exp(-(V + 65) / 18);
}
export function alphaH(V: number): number {
  return 0.07 * Math.exp(-(V + 65) / 20);
}
export function betaH(V: number): number {
  return 1 / (1 + Math.exp(-(V + 35) / 10));
}

/** Steady-state gate value x∞(V) = α/(α+β). */
export function gateInf(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

interface HHConst {
  cm: number;
  gNa: number;
  gK: number;
  gL: number;
  eNa: number;
  eK: number;
  eL: number;
  iExt: number;
  stimStart: number;
  stimEnd: number;
}

function stimulusAt(t: number, c: HHConst): number {
  return t >= c.stimStart && t <= c.stimEnd ? c.iExt : 0;
}

/** The Hodgkin–Huxley derivative for state [V, n, m, h]. */
export function hhDerivative(c: HHConst) {
  return (t: number, y: number[]): number[] => {
    const [V, n, m, h] = y;
    const iNa = c.gNa * m ** 3 * h * (V - c.eNa);
    const iK = c.gK * n ** 4 * (V - c.eK);
    const iL = c.gL * (V - c.eL);
    const dV = (stimulusAt(t, c) - iNa - iK - iL) / c.cm;
    const dn = alphaN(V) * (1 - n) - betaN(V) * n;
    const dm = alphaM(V) * (1 - m) - betaM(V) * m;
    const dh = alphaH(V) * (1 - h) - betaH(V) * h;
    return [dV, dn, dm, dh];
  };
}

/** Count local maxima of V that cross above `threshold` mV (spike detection). */
export function countSpikes(
  t: number[],
  V: number[],
  threshold = 0,
): { count: number; times: number[] } {
  const times: number[] = [];
  for (let i = 1; i < V.length - 1; i++) {
    if (V[i] > threshold && V[i] >= V[i - 1] && V[i] > V[i + 1]) {
      times.push(t[i]);
    }
  }
  return { count: times.length, times };
}

/**
 * Integrate across the step-current's on/off boundaries by restarting the
 * solver at each discontinuity, rather than asking adaptive RK45 to integrate
 * through a hard jump in one call.
 *
 * This matters: a discontinuous forcing term violates the smoothness RK45's
 * error estimator assumes *within* a step. Straddling the jump makes the
 * embedded 4th/5th-order error estimate spuriously huge, so the step-size
 * controller keeps halving `h` while approaching the boundary and can stall
 * asymptotically just short of it (observed: integration silently truncated
 * at t≈1.99 ms approaching a stimulus onset at t=2 ms, never reaching tEnd).
 * Splitting the domain at each boundary — standard practice for event-driven
 * ODEs — avoids ever asking the integrator to smooth through a jump.
 */
function integrateAcrossDiscontinuities(
  deriv: ReturnType<typeof hhDerivative>,
  y0: number[],
  boundaries: number[],
  totalOutputPoints: number,
  tol: number,
): { t: number[]; y: number[][] } {
  const bounds = [...new Set(boundaries)].sort((a, b) => a - b);
  const segments: [number, number][] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    if (bounds[i + 1] > bounds[i]) segments.push([bounds[i], bounds[i + 1]]);
  }
  const totalDuration = bounds[bounds.length - 1] - bounds[0] || 1;

  const t: number[] = [];
  const y: number[][] = [];
  let state = y0;
  for (const [segStart, segEnd] of segments) {
    const fraction = (segEnd - segStart) / totalDuration;
    const points = Math.max(2, Math.round(totalOutputPoints * fraction));
    const traj = rk45(deriv, state, segStart, segEnd, { tol, outputPoints: points });
    const startIdx = t.length > 0 ? 1 : 0; // drop the duplicate boundary point
    for (let i = startIdx; i < traj.t.length; i++) {
      t.push(traj.t[i]);
      y.push(traj.y[i]);
    }
    state = traj.y[traj.y.length - 1];
  }
  return { t, y };
}

function run(rawParams: HodgkinHuxleyParams): SimResult<HodgkinHuxleyDetail> {
  const p = hodgkinHuxleyParams.parse(rawParams);
  const stimEnd = Math.min(p.stimStart + p.stimDuration, p.tEnd);
  const c: HHConst = {
    cm: p.cm,
    gNa: p.gNa,
    gK: p.gK,
    gL: p.gL,
    eNa: p.eNa,
    eK: p.eK,
    eL: p.eL,
    iExt: p.iExt,
    stimStart: p.stimStart,
    stimEnd,
  };

  // Start from the true steady state at the resting potential (self-consistent
  // initial condition: with no stimulus, a system started here stays at rest).
  const n0 = gateInf(alphaN(p.vRest), betaN(p.vRest));
  const m0 = gateInf(alphaM(p.vRest), betaM(p.vRest));
  const h0 = gateInf(alphaH(p.vRest), betaH(p.vRest));

  const boundaries = [0, Math.min(p.stimStart, p.tEnd), stimEnd, p.tEnd];
  const traj = integrateAcrossDiscontinuities(
    hhDerivative(c),
    [p.vRest, n0, m0, h0],
    boundaries,
    p.outputPoints,
    p.tol,
  );

  const V = traj.y.map((row) => row[0]);
  const { count, times } = countSpikes(traj.t, V);
  const peakPotential = Math.max(...V);

  const firingRateHz =
    count >= 2
      ? ((count - 1) / (times[times.length - 1] - times[0])) * 1000
      : count === 1
        ? null
        : 0;

  return {
    engine: 'hodgkin-huxley',
    summary:
      count > 0
        ? `${count} action potential${count > 1 ? 's' : ''} fired (peak ${peakPotential.toFixed(1)} mV)${firingRateHz ? `, ~${firingRateHz.toFixed(0)} Hz` : ''}.`
        : `No action potential — subthreshold response (peak ${peakPotential.toFixed(1)} mV, resting ${p.vRest} mV).`,
    metrics: [
      { key: 'spikeCount', label: 'Action potentials', value: count },
      { key: 'peakPotential', label: 'Peak membrane potential', value: peakPotential, unit: 'mV' },
      { key: 'restingPotential', label: 'Resting potential', value: p.vRest, unit: 'mV' },
      ...(firingRateHz !== null
        ? [{ key: 'firingRate', label: 'Firing rate', value: firingRateHz, unit: 'Hz' }]
        : []),
    ],
    series: [
      { x: traj.t, y: { V }, xLabel: 'time (ms)', yLabel: 'membrane potential (mV)' },
      {
        x: traj.t,
        y: { n: traj.y.map((r) => r[1]), m: traj.y.map((r) => r[2]), h: traj.y.map((r) => r[3]) },
        xLabel: 'time (ms)',
        yLabel: 'gating variable',
      },
    ],
    detail: {
      spikeCount: count,
      spikeTimes: times,
      peakPotential,
      restingCheck: { initial: p.vRest, afterQuietPeriod: V[Math.floor(V.length * 0.05)] },
    },
    provenance: provenance('hodgkin-huxley', '1.0.0', p),
  };
}

export const spec: EngineSpec<HodgkinHuxleyParams, HodgkinHuxleyDetail> = {
  slug: 'hodgkin-huxley',
  title: 'Hodgkin–Huxley Neuron',
  domain: 'neuroscience',
  version: '1.0.0',
  description:
    'The classic biophysical model of the neuronal action potential (Nobel Prize, 1963): four ' +
    'coupled ODEs for membrane potential and voltage-gated Na⁺/K⁺ channel gating variables, ' +
    'integrated with adaptive RK45. Reproduces the hallmark all-or-none spike threshold and ' +
    'repetitive firing under sustained current injection, using the original 1952 squid giant ' +
    'axon parameters.',
  references: [
    'Hodgkin AL, Huxley AF (1952). J. Physiol. 117:500–544.',
    'Dayan P, Abbott LF. Theoretical Neuroscience (2001), ch. 5.',
  ],
  tags: ['neuroscience', 'action-potential', 'ion-channel', 'ode', 'nobel-prize'],
  paramsSchema: hodgkinHuxleyParams,
  example: {
    iExt: 10,
    stimStart: 5,
    stimDuration: 1,
    tEnd: 50,
  },
  run,
};
