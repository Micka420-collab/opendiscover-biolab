/**
 * Izhikevich spiking neuron.
 *
 * A two-variable model (Izhikevich 2003) that is as cheap as integrate-and-fire yet,
 * by tuning just four numbers (a, b, c, d), reproduces the whole zoo of cortical
 * firing patterns — regular spiking, fast spiking, chattering, intrinsic bursting:
 *
 *     v' = 0.04 v² + 5 v + 140 − u + I      (membrane potential, mV)
 *     u' = a (b v − u)                       (recovery variable)
 *     if v ≥ 30 mV:  v ← c,  u ← u + d       (spike reset)
 *
 * where v is the membrane potential, u a recovery current, and I the input. Spikes
 * are the reset events; the model reports their count, rate, and inter-spike-interval
 * statistics rather than treating the train as a smooth oscillation.
 *
 * Deterministic: integrated with the fixed-step scheme from Izhikevich's reference
 * code (the v-update split into two half-steps for stability), so results are exact
 * and reproducible. The reset also fires on any non-finite v, so a large step or
 * current can never leak Inf/NaN into the output.
 *
 * References:
 *   - Izhikevich, E.M. (2003) Simple model of spiking neurons. IEEE Transactions on
 *     Neural Networks 14(6):1569-1572.
 *   - Izhikevich, E.M. (2007) Dynamical Systems in Neuroscience. MIT Press.
 */

import { z } from 'zod';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

const SPIKE_PEAK = 30; // mV — the cutoff at which a spike is registered and v is reset

export const paramsSchema = z
  .object({
    /** Recovery time scale a (larger = faster recovery). */
    a: z.number().min(0).max(1).default(0.02),
    /** Recovery sensitivity b to the membrane potential. */
    b: z.number().min(-1).max(1).default(0.2),
    /** Post-spike reset value of v (mV). */
    c: z.number().min(-90).max(0).default(-65),
    /** Post-spike increment of the recovery variable u. */
    d: z.number().min(0).max(20).default(8),
    /** Injected current I. */
    current: z.number().min(-50).max(100).default(10),
    /** Initial membrane potential (mV). */
    v0: z.number().min(-90).max(30).default(-65),
    /** Simulated duration (ms). */
    tEnd: z.number().positive().max(2000).default(300),
    /** Integration step (ms). */
    dt: z.number().min(0.02).max(1).default(0.25),
    /** Points kept for the plotted trace. */
    outputPoints: z.number().int().min(2).max(4000).default(600),
  })
  .strict()
  .refine((p) => p.tEnd / p.dt <= 200_000, {
    message: 'tEnd/dt exceeds 200000 integration steps',
  });

export type IzhikevichParams = z.infer<typeof paramsSchema>;

export interface SpikeTrain {
  /** Times (ms) at which the neuron spiked (reset events). */
  spikeTimes: number[];
  /** Membrane-potential trace, with spikes capped at the peak for a clean plot. */
  t: number[];
  v: number[];
}

/** Simulate the neuron and return the spike times + the (peak-capped) v trace. */
export function simulate(p: IzhikevichParams): SpikeTrain {
  const steps = Math.round(p.tEnd / p.dt);
  let v = p.v0;
  let u = p.b * p.v0;
  const t: number[] = [0];
  const vTrace: number[] = [v];
  const spikeTimes: number[] = [];

  const dv = (vv: number, uu: number) => 0.04 * vv * vv + 5 * vv + 140 - uu + p.current;

  for (let i = 1; i <= steps; i++) {
    const time = i * p.dt;
    // Two half-steps on v (Izhikevich's stability trick), then one step on u.
    v += 0.5 * p.dt * dv(v, u);
    v += 0.5 * p.dt * dv(v, u);
    u += p.dt * p.a * (p.b * v - u);

    let spiked = false;
    // Reset on threshold OR any non-finite value (guards overflow → no Inf/NaN leaks).
    if (v >= SPIKE_PEAK || !Number.isFinite(v)) {
      spikeTimes.push(time);
      v = p.c;
      u += p.d;
      spiked = true;
    }
    t.push(time);
    vTrace.push(spiked ? SPIKE_PEAK : v);
  }

  return { spikeTimes, t, v: vTrace };
}

export interface SpikeStats {
  count: number;
  rateHz: number;
  meanISI: number;
  cvISI: number;
  firstSpikeLatency: number;
}

/** Spike-train statistics, guarded for the 0- and 1-spike cases. */
export function spikeStats(spikeTimes: number[], tEndMs: number): SpikeStats {
  const count = spikeTimes.length;
  const rateHz = tEndMs > 0 ? count / (tEndMs / 1000) : 0;
  if (count < 2) {
    return {
      count,
      rateHz,
      meanISI: 0,
      cvISI: 0,
      firstSpikeLatency: count > 0 ? (spikeTimes[0] as number) : 0,
    };
  }
  const isi: number[] = [];
  for (let i = 1; i < count; i++)
    isi.push((spikeTimes[i] as number) - (spikeTimes[i - 1] as number));
  const meanISI = isi.reduce((s, x) => s + x, 0) / isi.length;
  let cvISI = 0;
  if (isi.length >= 2 && meanISI > 0) {
    const variance = isi.reduce((s, x) => s + (x - meanISI) ** 2, 0) / isi.length;
    cvISI = Math.sqrt(variance) / meanISI;
  }
  return { count, rateHz, meanISI, cvISI, firstSpikeLatency: spikeTimes[0] as number };
}

export function run(rawParams: Partial<IzhikevichParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const train = simulate(p);
  const stats = spikeStats(train.spikeTimes, p.tEnd);

  const regime =
    stats.count === 0
      ? 'quiescent (no spikes)'
      : stats.cvISI < 0.05
        ? 'regular (tonic) spiking'
        : 'irregular / bursting';

  const metrics: Metric[] = [
    { key: 'spikeCount', label: 'Spike count', value: stats.count },
    { key: 'firingRateHz', label: 'Firing rate', value: stats.rateHz, unit: 'Hz' },
    {
      key: 'meanISI',
      label: 'Mean inter-spike interval',
      value: stats.meanISI,
      unit: 'ms',
      note: stats.count < 2 ? 'n/a (< 2 spikes)' : undefined,
    },
    {
      key: 'cvISI',
      label: 'ISI coefficient of variation',
      value: stats.cvISI,
      note: 'regularity: 0 = perfectly periodic',
    },
    {
      key: 'firstSpikeLatency',
      label: 'First-spike latency',
      value: stats.firstSpikeLatency,
      unit: 'ms',
      note: stats.count === 0 ? 'no spike within the horizon' : undefined,
    },
  ];

  const idx = downsampleIndices(train.t.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((k) => train.t[k] ?? 0),
      y: { v: idx.map((k) => train.v[k] ?? 0) },
      xLabel: 'time (ms)',
      yLabel: 'membrane potential v (mV)',
    },
  ];

  return {
    engine: 'izhikevich',
    summary:
      stats.count === 0
        ? `Izhikevich neuron: ${regime} at I=${p.current}.`
        : `Izhikevich neuron: ${stats.count} spikes, ${stats.rateHz.toFixed(1)} Hz — ${regime}.`,
    metrics,
    series,
    detail: {
      regime,
      spikeCount: stats.count,
      rateHz: stats.rateHz,
      meanISI: stats.meanISI,
      cvISI: stats.cvISI,
    },
    provenance: provenance('izhikevich', '1.0.0', p),
  };
}

export const spec: EngineSpec<IzhikevichParams> = {
  slug: 'izhikevich',
  title: 'Izhikevich Spiking Neuron',
  domain: 'neuroscience',
  version: '1.0.0',
  description:
    "Izhikevich's 2003 two-variable spiking-neuron model: v' = 0.04v² + 5v + 140 − u + I, u' = a(bv − u), with a reset v←c, u←u+d whenever v reaches 30 mV. Four parameters (a, b, c, d) recreate the full range of cortical firing — regular spiking, fast spiking, chattering, bursting. Reports spike count, firing rate, and inter-spike-interval statistics (mean and CV of regularity). Deterministic fixed-step integration; the reset also fires on any non-finite v so overflow can never leak into the output.",
  references: [
    'Izhikevich, E.M. (2003) Simple model of spiking neurons. IEEE Transactions on Neural Networks 14(6):1569-1572.',
    'Izhikevich, E.M. (2007) Dynamical Systems in Neuroscience. MIT Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<IzhikevichParams>,
  run,
  // Regular-spiking (RS) cortical cell driven above threshold.
  example: paramsSchema.parse({ a: 0.02, b: 0.2, c: -65, d: 8, current: 10, tEnd: 300 }),
  tags: ['neuroscience', 'spiking-neuron', 'firing-patterns', 'izhikevich', 'action-potential'],
};

export default spec;
