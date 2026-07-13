/**
 * Quest: "The Road to Chaos" on the logistic map x → r·x·(1−x).
 *
 * The player hunts the growth parameter r (0–4) for qualitatively distinct
 * regimes. The famous ones are catalogued with citations; the map's less-
 * documented odd-periodic windows (period-5, -6, -7, …) are deliberately left
 * off the catalogue, so landing in one is a genuinely novel find. Classification
 * uses the engine's own Lyapunov exponent and attractor-period metrics —
 * verified against textbook landmarks in the test suite (golden rule).
 */
import type { SimResult } from '../../../sim';
import type { KnownRegime, Quest, Regime } from '../types';

const LN2 = Math.log(2);
const metric = (r: SimResult, key: string): number =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const POWERS_OF_TWO = new Set([2, 4, 8, 16, 32, 64]);

export function classifyLogistic(result: SimResult): Regime {
  const period = metric(result, 'attractorPeriod'); // 0 ⇒ aperiodic/chaotic
  const lyap = metric(result, 'lyapunovExponent');
  const fixedPoint = metric(result, 'fixedPoint'); // x* = 1 − 1/r (negative when r < 1)
  const detail = `period ${period === 0 ? '∞ (aperiodic)' : period}, λ=${lyap.toFixed(3)}`;

  if (period === 1) {
    // For r < 1 the real attractor is 0 (x* is negative): the population dies out.
    if (fixedPoint <= 1e-9) return { id: 'extinction', label: 'Extinction', detail };
    return { id: 'fixed-point', label: 'Stable equilibrium', detail };
  }
  if (period === 0) {
    if (lyap >= LN2 - 0.03) return { id: 'full-chaos', label: 'Fully-developed chaos', detail };
    if (lyap > 0.005) return { id: 'chaos', label: 'Deterministic chaos', detail };
    return { id: 'edge-of-chaos', label: 'Edge of chaos', detail };
  }
  if (period === 3) return { id: 'period-3-window', label: 'Period-3 window', detail };
  if (POWERS_OF_TWO.has(period)) {
    return { id: `period-${period}`, label: `Period-${period} cycle`, detail };
  }
  return { id: `period-${period}-window`, label: `Period-${period} window`, detail };
}

/** Documented regimes. Anything the classifier returns that is NOT here is novel. */
const KNOWN_CATALOG: KnownRegime[] = [
  {
    id: 'extinction',
    name: 'Extinction',
    citation: 'May, R.M. (1976) Nature 261:459',
    rarity: 0.1,
  },
  {
    id: 'fixed-point',
    name: 'Stable equilibrium (x* = 1 − 1/r)',
    citation: 'May, R.M. (1976) Nature 261:459',
    rarity: 0.1,
  },
  {
    id: 'period-2',
    name: 'First period-doubling',
    citation: 'May, R.M. (1976) Nature 261:459',
    rarity: 0.25,
  },
  {
    id: 'period-4',
    name: 'Second period-doubling',
    citation: 'Feigenbaum, M.J. (1978) J. Stat. Phys. 19:25',
    rarity: 0.4,
  },
  {
    id: 'period-8',
    name: 'Third period-doubling',
    citation: 'Feigenbaum, M.J. (1978) J. Stat. Phys. 19:25',
    rarity: 0.55,
  },
  {
    id: 'period-3-window',
    name: 'Period-3 window ("period three implies chaos")',
    citation: 'Li, T-Y & Yorke, J.A. (1975) Amer. Math. Monthly 82:985',
    rarity: 0.75,
  },
  {
    id: 'chaos',
    name: 'Deterministic chaos',
    citation: 'May, R.M. (1976) Nature 261:459',
    rarity: 0.5,
  },
  {
    id: 'full-chaos',
    name: 'Fully-developed chaos (λ = ln 2 at r = 4)',
    citation: 'Ulam, S.M. & von Neumann, J. (1947) Bull. AMS 53:1120',
    rarity: 0.65,
  },
];

export const logisticRoadToChaos: Quest = {
  slug: 'road-to-chaos',
  title: 'The Road to Chaos',
  engine: 'logistic-map',
  brief:
    "Robert May's one-line population model x → r·x·(1−x) hides an entire zoo of behaviours as the growth rate r climbs from 0 to 4: extinction, a steady equilibrium, a period-doubling cascade, and full chaos — punctuated by narrow windows of order hidden inside the chaos. Probe r to sense whether the dynamics are calm or chaotic, then commit to a claim to identify exactly which regime you found. The famous landmarks are documented; the rarer periodic windows are not — find one and it is yours.",
  axes: [{ key: 'r', label: 'Growth rate r', min: 0, max: 4, base: 3.5, step: 0.001 }],
  fixedParams: { x0: 0.2, transient: 5000, analysisIterations: 8000 },
  probeBudget: 12,
  classify: classifyLogistic,
  knownCatalog: KNOWN_CATALOG,
  targets: ['period-3-window', 'period-8', 'full-chaos'],
};
