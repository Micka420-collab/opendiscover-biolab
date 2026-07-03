/**
 * Membrane permeation — how a molecule crosses a cell membrane (Fick's first law).
 *
 * A solute crosses a thin membrane at a rate set by Fick's law: the flux (amount per area
 * per time) is proportional to the concentration difference across it,
 *
 *     J = P · (C₁ − C₂),      permeability  P = D·K / L,
 *
 * where D is how fast the solute diffuses inside the membrane, K is the partition coefficient
 * (how happily it dissolves into the oily membrane versus water — its lipophilicity), and L is
 * the membrane thickness. For two well-mixed compartments of equal volume V sharing an area A,
 * the concentration difference relaxes exponentially, ΔC(t)=ΔC₀·e^(−k·t) with rate k=2·P·A/V,
 * until both sides reach the average. This engine reports the permeability, the initial flux,
 * the equilibration rate and half-time, the final inside concentration, and the two
 * concentration curves.
 *
 * Closed-form and deterministic; every field is bounded so the rate and flux stay finite.
 *
 * References:
 *   - Fick, A. (1855) Über Diffusion. Ann. Phys. 170:59-86.
 *   - Missner, A. & Pohl, P. (2009) 110 years of the Meyer–Overton rule: predicting membrane
 *     permeability. ChemPhysChem 10:1405-1414.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Diffusion coefficient D inside the membrane (cm²/s). */
    diffusionCoeff: z.number().min(1e-15).max(1).default(1e-6),
    /** Partition coefficient K (membrane/water) — the solute's lipophilicity. */
    partitionCoeff: z.number().min(1e-6).max(1e6).default(1),
    /** Membrane thickness L (cm); a lipid bilayer ≈ 1e-6 cm. */
    thickness: z.number().min(1e-9).max(1).default(1e-6),
    /** Membrane area A (cm²). */
    area: z.number().min(1e-9).max(1e6).default(1),
    /** Volume V of each compartment (cm³). */
    volume: z.number().min(1e-9).max(1e6).default(1),
    /** Initial concentration outside, C₁(0). */
    concOutside: z.number().min(0).max(1e9).default(100),
    /** Initial concentration inside, C₂(0). */
    concInside: z.number().min(0).max(1e9).default(0),
    /** Simulated time (s). */
    tEnd: z.number().min(1e-6).max(1e12).default(100),
    /** Points in the plotted concentration curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type MembranePermeationParams = z.infer<typeof paramsSchema>;

/** Permeability P = D·K / L (cm/s). */
export function permeability(d: number, k: number, l: number): number {
  return (d * k) / l;
}

export function run(rawParams: Partial<MembranePermeationParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const perm = permeability(p.diffusionCoeff, p.partitionCoeff, p.thickness);
  const deltaC0 = p.concOutside - p.concInside;
  const initialFlux = perm * deltaC0; // amount per area per time (across the membrane)
  const rateConstant = (2 * perm * p.area) / p.volume; // exponential relaxation rate k
  const halfTime = rateConstant > 0 ? Math.LN2 / rateConstant : Number.POSITIVE_INFINITY;
  const equilibriumConc = (p.concOutside + p.concInside) / 2;

  const inside = (t: number) => equilibriumConc - (deltaC0 / 2) * Math.exp(-rateConstant * t);
  const outside = (t: number) => equilibriumConc + (deltaC0 / 2) * Math.exp(-rateConstant * t);
  const insideAtEnd = inside(p.tEnd);

  const metrics: Metric[] = [
    { key: 'permeability', label: 'Permeability P', value: perm, unit: 'cm/s', note: 'D·K / L' },
    {
      key: 'initialFlux',
      label: 'Initial flux J₀',
      value: initialFlux,
      note: 'P·(C₁−C₂): amount per area per time',
    },
    {
      key: 'rateConstant',
      label: 'Equilibration rate k',
      value: rateConstant,
      unit: '1/s',
      note: '2·P·A / V',
    },
    {
      key: 'halfEquilibrationTime',
      label: 'Half-equilibration time',
      value: Number.isFinite(halfTime) ? halfTime : 0,
      unit: 's',
      note: 'ln2 / k (time to close half the gap)',
    },
    {
      key: 'equilibriumConc',
      label: 'Equilibrium concentration',
      value: equilibriumConc,
      note: 'both sides reach the average',
    },
    {
      key: 'insideConcAtEnd',
      label: `Inside concentration at ${p.tEnd} s`,
      value: insideAtEnd,
      note: 'C₂(tEnd)',
    },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.tEnd * i) / (n - 1));
  const series: Series[] = [
    {
      x: times,
      y: { outside: times.map(outside), inside: times.map(inside) },
      xLabel: 'time (s)',
      yLabel: 'concentration',
    },
  ];

  return {
    engine: 'membrane-permeation',
    summary: `Membrane permeation: P=${perm.toPrecision(3)} cm/s (D·K/L) → initial flux ${initialFlux.toPrecision(3)}; the two sides close half their gap every ${Number.isFinite(halfTime) ? halfTime.toPrecision(3) : '∞'} s, meeting at ${equilibriumConc}. At ${p.tEnd} s the inside sits at ${insideAtEnd.toPrecision(4)}.`,
    metrics,
    series,
    detail: { permeability: perm, initialFlux, halfEquilibrationTime: halfTime, equilibriumConc },
    provenance: provenance('membrane-permeation', '1.0.0', p),
  };
}

export const spec: EngineSpec<MembranePermeationParams> = {
  slug: 'membrane-permeation',
  title: "Membrane Permeation (Fick's Law)",
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    "How a molecule crosses a cell membrane, from Fick's first law: the flux J=P·(C₁−C₂) is proportional to the concentration difference, with permeability P=D·K/L set by how fast the solute diffuses inside the membrane (D), how readily it dissolves into the oily bilayer (the partition coefficient K, i.e. lipophilicity) and the membrane thickness L. For two equal-volume compartments the concentration difference relaxes exponentially, ΔC(t)=ΔC₀·e^(−kt) with k=2·P·A/V, until both sides meet at the average. Reports the permeability, initial flux, equilibration rate and half-time, the final inside concentration, and the two concentration-vs-time curves. Closed-form and deterministic.",
  references: [
    'Fick, A. (1855) Über Diffusion. Ann. Phys. 170:59-86.',
    'Missner, A. & Pohl, P. (2009) 110 years of the Meyer–Overton rule. ChemPhysChem 10:1405-1414.',
  ],
  paramsSchema: paramsSchema as z.ZodType<MembranePermeationParams>,
  run,
  example: paramsSchema.parse({ diffusionCoeff: 1e-6, partitionCoeff: 1, thickness: 1e-6 }),
  tags: ['biochemistry', 'membrane', 'permeability', 'fick', 'diffusion', 'transport'],
};

export default spec;
