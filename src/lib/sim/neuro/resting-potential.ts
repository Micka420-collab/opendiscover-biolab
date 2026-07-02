/**
 * Resting membrane potential — Nernst equilibria and the Goldman–Hodgkin–Katz voltage.
 *
 * A cell membrane holds a voltage because ion gradients push each species toward its own
 * equilibrium (Nernst) potential, and the membrane's relative permeabilities decide the
 * tug-of-war. For one ion of charge z,
 *
 *     E_ion = (RT/zF)·ln([ion]_out / [ion]_in),
 *
 * and the steady resting potential across a membrane permeable to K⁺, Na⁺ and Cl⁻ is the
 * Goldman–Hodgkin–Katz voltage (note the anion Cl⁻ inverts inside/outside),
 *
 *     V_m = (RT/F)·ln( (P_K[K]o + P_Na[Na]o + P_Cl[Cl]i) / (P_K[K]i + P_Na[Na]i + P_Cl[Cl]o) ).
 *
 * V_m always sits between the Nernst potentials of the permeant ions, pulled toward the one
 * with the highest permeability — at rest that is K⁺, which is why neurons sit near E_K.
 * The engine also plots the classic [K]o sweep: raising external potassium depolarizes the
 * cell (the electrophysiology behind dangerous hyperkalemia).
 *
 * Unlike `hodgkin-huxley` — which takes the reversal potentials as GIVEN and integrates
 * spike dynamics — this derives the resting/reversal potentials from the ion concentrations
 * and permeabilities in closed form. Deterministic; every ln argument is a ratio of strictly
 * positive concentrations.
 *
 * References:
 *   - Goldman, D.E. (1943) Potential, impedance, and rectification in membranes. J. Gen.
 *     Physiol. 27:37-60.
 *   - Hodgkin, A.L. & Katz, B. (1949) The effect of sodium ions on the electrical activity
 *     of the giant axon of the squid. J. Physiol. 108:37-77.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Gas constant (J/mol/K) and Faraday constant (C/mol). */
const R = 8.314462618;
const F = 96485.33212;

export const paramsSchema = z
  .object({
    /** Temperature (°C). */
    temperatureC: z.number().min(-20).max(60).default(37),
    /** Extracellular K⁺ (mM). */
    ko: z.number().min(1e-9).max(1000).default(5),
    /** Intracellular K⁺ (mM). */
    ki: z.number().min(1e-9).max(1000).default(140),
    /** Extracellular Na⁺ (mM). */
    nao: z.number().min(1e-9).max(1000).default(145),
    /** Intracellular Na⁺ (mM). */
    nai: z.number().min(1e-9).max(1000).default(15),
    /** Extracellular Cl⁻ (mM). */
    clo: z.number().min(1e-9).max(1000).default(110),
    /** Intracellular Cl⁻ (mM). */
    cli: z.number().min(1e-9).max(1000).default(10),
    /** Relative K⁺ permeability P_K. */
    pK: z.number().min(0).max(1000).default(1),
    /** Relative Na⁺ permeability P_Na. */
    pNa: z.number().min(0).max(1000).default(0.04),
    /** Relative Cl⁻ permeability P_Cl. */
    pCl: z.number().min(0).max(1000).default(0.45),
    /** Points in the [K]o depolarization sweep. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict()
  .refine((p) => p.pK + p.pNa + p.pCl > 0, {
    message: 'at least one permeability must be positive',
  });

export type RestingPotentialParams = z.infer<typeof paramsSchema>;

/** Thermal voltage RT/F in millivolts at temperature tC (°C). */
export function thermalVoltageMv(tC: number): number {
  return (R * (tC + 273.15) * 1000) / F;
}

/** Nernst equilibrium potential (mV): E = (RT/zF)·ln(out/in). */
export function nernst(concOut: number, concIn: number, z: number, rtOverF: number): number {
  return (rtOverF / z) * Math.log(concOut / concIn);
}

/** GHK resting potential (mV). Cl⁻ (anion) uses inside on top, outside on the bottom. */
export function ghkVoltage(p: RestingPotentialParams, rtOverF: number): number {
  const num = p.pK * p.ko + p.pNa * p.nao + p.pCl * p.cli;
  const den = p.pK * p.ki + p.pNa * p.nai + p.pCl * p.clo;
  return rtOverF * Math.log(num / den);
}

export function run(rawParams: Partial<RestingPotentialParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const rtOverF = thermalVoltageMv(p.temperatureC);

  const eK = nernst(p.ko, p.ki, 1, rtOverF);
  const eNa = nernst(p.nao, p.nai, 1, rtOverF);
  const eCl = nernst(p.clo, p.cli, -1, rtOverF); // z = −1 for the chloride anion
  const vm = ghkVoltage(p, rtOverF);

  const perms: Array<[string, number]> = [
    ['K⁺', p.pK],
    ['Na⁺', p.pNa],
    ['Cl⁻', p.pCl],
  ];
  const dominant = perms.reduce((best, cur) => (cur[1] > best[1] ? cur : best));

  const metrics: Metric[] = [
    {
      key: 'restingPotential',
      label: 'Resting potential V_m (GHK)',
      value: vm,
      unit: 'mV',
      note: `pulled toward the most permeant ion (${dominant[0]})`,
    },
    { key: 'eK', label: 'K⁺ equilibrium potential E_K', value: eK, unit: 'mV' },
    { key: 'eNa', label: 'Na⁺ equilibrium potential E_Na', value: eNa, unit: 'mV' },
    { key: 'eCl', label: 'Cl⁻ equilibrium potential E_Cl', value: eCl, unit: 'mV' },
    {
      key: 'thermalVoltage',
      label: 'Thermal voltage RT/F',
      value: rtOverF,
      unit: 'mV',
      note: '≈ 26.7 mV at body temperature',
    },
    {
      key: 'drivingForceK',
      label: 'K⁺ driving force at rest',
      value: vm - eK,
      unit: 'mV',
      note: 'V_m − E_K (small: K⁺ near equilibrium at rest)',
    },
    {
      key: 'drivingForceNa',
      label: 'Na⁺ driving force at rest',
      value: vm - eNa,
      unit: 'mV',
      note: 'V_m − E_Na (large inward drive)',
    },
  ];

  // Classic sweep: how V_m depolarizes as extracellular K⁺ rises (hyperkalemia).
  const n = p.outputPoints;
  const koMax = Math.max(100, 2 * p.ko);
  const koGrid = Array.from({ length: n }, (_, i) => 0.5 + ((koMax - 0.5) * i) / (n - 1));
  const series: Series[] = [
    {
      x: koGrid,
      y: {
        restingPotential: koGrid.map((ko) => ghkVoltage({ ...p, ko }, rtOverF)),
        nernstK: koGrid.map((ko) => nernst(ko, p.ki, 1, rtOverF)),
      },
      xLabel: 'extracellular [K⁺]₀ (mM)',
      yLabel: 'potential (mV)',
    },
  ];

  return {
    engine: 'resting-potential',
    summary: `Resting potential V_m=${vm.toFixed(1)} mV (GHK) at ${p.temperatureC}°C: E_K=${eK.toFixed(1)}, E_Na=${eNa.toFixed(1)}, E_Cl=${eCl.toFixed(1)} mV — sits near E_${dominant[0]} because ${dominant[0]} is most permeant.`,
    metrics,
    series,
    detail: { restingPotential: vm, eK, eNa, eCl, thermalVoltage: rtOverF },
    provenance: provenance('resting-potential', '1.0.0', p),
  };
}

export const spec: EngineSpec<RestingPotentialParams> = {
  slug: 'resting-potential',
  title: 'Resting Membrane Potential (Nernst / Goldman–Hodgkin–Katz)',
  domain: 'neuroscience',
  version: '1.0.0',
  description:
    "The steady resting voltage of a cell membrane from ion gradients and permeabilities. Each ion's Nernst equilibrium potential is E=(RT/zF)·ln([out]/[in]), and the resting potential is the Goldman–Hodgkin–Katz weighted average V_m=(RT/F)·ln((P_K[K]o+P_Na[Na]o+P_Cl[Cl]i)/(P_K[K]i+P_Na[Na]i+P_Cl[Cl]o)) — with the chloride anion inverted. Reports E_K, E_Na, E_Cl, V_m, the thermal voltage RT/F, and the K⁺/Na⁺ driving forces, plus a [K]o sweep showing the depolarization behind hyperkalemia. Closed-form and deterministic; distinct from hodgkin-huxley (which takes reversal potentials as inputs and integrates spikes) — this derives them.",
  references: [
    'Goldman, D.E. (1943) Potential, impedance, and rectification in membranes. J. Gen. Physiol. 27:37-60.',
    'Hodgkin, A.L. & Katz, B. (1949) The effect of sodium ions on the electrical activity of the giant axon of the squid. J. Physiol. 108:37-77.',
  ],
  paramsSchema: paramsSchema as z.ZodType<RestingPotentialParams>,
  run,
  example: paramsSchema.parse({}),
  tags: ['neuroscience', 'membrane-potential', 'nernst', 'goldman', 'ghk', 'electrophysiology'],
};

export default spec;
