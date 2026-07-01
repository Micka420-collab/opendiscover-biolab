/**
 * Kinetic metabolic pathway simulator — the time-dependent complement to FBA.
 *
 * FBA (`sim/systems/fba.ts`) answers "what is the optimal steady-state flux
 * distribution?" via linear programming, with no notion of time or transient
 * dynamics. This engine answers a different question: given explicit
 * Michaelis-Menten rate laws for each step of a LINEAR enzymatic pathway,
 * how do intermediate metabolite concentrations evolve over time, and what
 * steady state (if any) do they settle into?
 *
 *   S0 --(E1: Vmax1,Km1)--> S1 --(E2: Vmax2,Km2)--> S2 --> ... --> Sn
 *
 * S0 (the pathway's upstream substrate) is held at a fixed concentration —
 * modeling an abundant reservoir metabolite, a common simplifying assumption
 * for the first step of a pathway fed by central metabolism. Sn (the final
 * product) has no consumption term and simply accumulates. Integrated with
 * the shared adaptive RK45 solver.
 *
 * Two facts are used directly as verifiable invariants, both true by
 * elementary conservation/algebra rather than needing an external reference:
 *
 *   1. **Flux uniformity at steady state.** In an unbranched chain, whatever
 *      flows into an intermediate must flow out once d[S_i]/dt = 0 — so at
 *      steady state every step carries the SAME flux J (the pathway-wide
 *      throughput). This is exactly Kirchhoff's current law for a chain of
 *      resistors, applied to reaction flux instead of current.
 *   2. **A closed-form two-step steady state.** For a 2-intermediate chain
 *      with S0 fixed, J = MM(S0; Vmax1,Km1) is known in closed form, and
 *      solving J = MM(S1*; Vmax2,Km2) algebraically for S1* gives
 *      S1* = J·Km2 / (Vmax2 − J) (valid while Vmax2 > J). This is derived
 *      and verified numerically against a direct RK4 integration in the test
 *      file before being trusted as a test anchor.
 *
 * Determinism: purely a deterministic ODE system, no randomness.
 *
 * References:
 *   - Heinrich R, Schuster S. The Regulation of Cellular Systems (1996) —
 *     metabolic control analysis; flux uniformity in unbranched chains.
 *   - Fell D. Understanding the Control of Metabolism (1997).
 */

import { z } from 'zod';
import { rk45 } from '../core/ode';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

/** Michaelis-Menten rate law: v = Vmax·S / (Km + S), clamped at S<=0. */
export function mmRate(S: number, vmax: number, km: number): number {
  if (S <= 0) return 0;
  return (vmax * S) / (km + S);
}

const stepSchema = z.object({
  vmax: z.number().positive(),
  km: z.number().positive(),
});

export const metabolicPathwayParams = z.object({
  /** Fixed upstream substrate concentration feeding the first step. */
  sourceConcentration: z.number().positive().default(10),
  /** One entry per enzymatic step (step i converts S_{i-1} -> S_i). */
  steps: z.array(stepSchema).min(1).max(10),
  /** Initial concentrations of S1..Sn (defaults to all zero). */
  initialIntermediates: z.array(z.number().min(0)).optional(),
  /** Simulation horizon. */
  tEnd: z.number().positive().default(200),
  /** Output samples. */
  outputPoints: z.number().int().positive().max(5000).default(300),
  /** RK45 tolerance. */
  tol: z.number().positive().default(1e-8),
});

export type MetabolicPathwayParams = z.input<typeof metabolicPathwayParams>;

export interface MetabolicPathwayDetail {
  fluxByStep: number[]; // flux through each step at the final time point
  fluxUniformityError: number; // max pairwise difference among non-terminal step fluxes
  bottleneckStepIndex: number; // step with the smallest Vmax (the capacity ceiling)
  finalConcentrations: number[];
}

function pathwayDerivative(sourceConcentration: number, steps: { vmax: number; km: number }[]) {
  return (_t: number, y: number[]): number[] => {
    const n = steps.length;
    const dydt = new Array(n).fill(0);
    // v[i] = flux INTO intermediate i (i.e. through step i, consuming S_{i-1}).
    const v: number[] = [];
    for (let i = 0; i < n; i++) {
      const upstream = i === 0 ? sourceConcentration : y[i - 1];
      v.push(mmRate(upstream, steps[i].vmax, steps[i].km));
    }
    for (let i = 0; i < n; i++) {
      const consumption = i < n - 1 ? v[i + 1] : 0; // last intermediate simply accumulates
      dydt[i] = v[i] - consumption;
    }
    return dydt;
  };
}

function run(rawParams: MetabolicPathwayParams): SimResult<MetabolicPathwayDetail> {
  const p = metabolicPathwayParams.parse(rawParams);
  const n = p.steps.length;
  const y0 = p.initialIntermediates ?? new Array(n).fill(0);
  if (y0.length !== n) {
    throw new Error(`initialIntermediates must have length ${n} (one per step)`);
  }

  const traj = rk45(pathwayDerivative(p.sourceConcentration, p.steps), y0, 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });

  const finalConcentrations = traj.y[traj.y.length - 1];
  const fluxByStep: number[] = [];
  for (let i = 0; i < n; i++) {
    const upstream = i === 0 ? p.sourceConcentration : finalConcentrations[i - 1];
    fluxByStep.push(mmRate(upstream, p.steps[i].vmax, p.steps[i].km));
  }

  // Flux uniformity is only expected among the NON-terminal steps (step n has
  // no downstream consumer, so its flux need not match the others once the
  // final product is simply accumulating).
  const nonTerminalFluxes = fluxByStep.slice(0, n - 1);
  let fluxUniformityError = 0;
  for (let i = 1; i < nonTerminalFluxes.length; i++) {
    fluxUniformityError = Math.max(
      fluxUniformityError,
      Math.abs(nonTerminalFluxes[i] - nonTerminalFluxes[0]),
    );
  }

  let bottleneckStepIndex = 0;
  for (let i = 1; i < n; i++) {
    if (p.steps[i].vmax < p.steps[bottleneckStepIndex].vmax) bottleneckStepIndex = i;
  }

  const series = {
    x: traj.t,
    y: Object.fromEntries(traj.y[0].map((_, i) => [`S${i + 1}`, traj.y.map((row) => row[i])])),
    xLabel: 'time',
    yLabel: 'concentration',
  };

  return {
    engine: 'metabolic-pathway',
    summary: `${n}-step pathway: steady-state flux ≈ ${fluxByStep[0]?.toFixed(4) ?? '0'}, bottleneck at step ${bottleneckStepIndex + 1} (Vmax=${p.steps[bottleneckStepIndex].vmax}), final product S${n} = ${finalConcentrations[n - 1].toFixed(3)}.`,
    metrics: [
      { key: 'steadyStateFlux', label: 'Steady-state flux (step 1)', value: fluxByStep[0] ?? 0 },
      {
        key: 'fluxUniformityError',
        label: 'Flux non-uniformity (max deviation)',
        value: fluxUniformityError,
        note: 'should be ~0 among non-terminal steps at steady state',
      },
      {
        key: 'bottleneckStepIndex',
        label: 'Bottleneck step (1-indexed)',
        value: bottleneckStepIndex + 1,
      },
      { key: 'finalProduct', label: `Final product (S${n})`, value: finalConcentrations[n - 1] },
    ],
    series: [series],
    detail: { fluxByStep, fluxUniformityError, bottleneckStepIndex, finalConcentrations },
    provenance: provenance('metabolic-pathway', '1.0.0', p),
  };
}

export const spec: EngineSpec<MetabolicPathwayParams, MetabolicPathwayDetail> = {
  slug: 'metabolic-pathway',
  title: 'Kinetic Metabolic Pathway',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'Simulates the time-dependent dynamics of a linear enzymatic pathway (S0 -> S1 -> ... -> Sn), ' +
    'each step following Michaelis-Menten kinetics, integrated with adaptive RK45. The upstream ' +
    "substrate S0 is held at a fixed reservoir concentration. The complement to fba.ts's steady-" +
    'state optimization: this reports the actual transient approach to steady state, the uniform ' +
    'pathway-wide flux once there, and which step is rate-limiting (the lowest Vmax).',
  references: [
    'Heinrich R, Schuster S. The Regulation of Cellular Systems (1996) — flux uniformity.',
    'Fell D. Understanding the Control of Metabolism (1997).',
  ],
  tags: ['metabolic-pathway', 'kinetics', 'michaelis-menten', 'flux', 'ode'],
  paramsSchema: metabolicPathwayParams,
  example: {
    sourceConcentration: 10,
    steps: [
      { vmax: 5, km: 2 },
      { vmax: 6, km: 3 },
      { vmax: 8, km: 1.5 },
    ],
    tEnd: 200,
  },
  run,
};
