/**
 * A TWO-AXIS quest: the FitzHugh–Nagumo neuron's excitability map in the
 * (applied current I, recovery parameter a) plane. The repetitive-spiking region
 * is a genuine 2D island — its boundary depends on BOTH dials, so the hunt can't
 * be collapsed to a single slider.
 *
 * Regimes (classified from the engine's own metrics):
 *   - repetitive-spiking: a stable limit cycle (spiking = 1).
 *   - resting: quiescent, sub-threshold (spiking = 0, low fixed-point voltage).
 *   - depolarization-block: quiescent because the current is TOO strong — the
 *     neuron is pinned depolarised (spiking = 0, high fixed-point voltage). This
 *     third regime is left off the catalogue: finding it is the novel prize.
 *
 * Hand-authored; every landmark below was verified against the real engine
 * (see the co-located test) before it was written down.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const fitzhughNagumoExcitabilityMapData: RuleQuestData = {
  engine: 'fitzhugh-nagumo',
  slug: 'fitzhugh-nagumo-excitability-map',
  title: 'The Excitability Map',
  brief:
    'A FitzHugh–Nagumo neuron sits under two dials at once: the current I you inject, and a, which sets how sluggishly it recovers. Somewhere in that plane is a diagonal island where the neuron fires over and over — but push the current too hard and it falls silent again, pinned in a depolarised block the intro courses rarely mention. Sweep the map, sense where it is quiet, and claim your spots: is a silent point a neuron at rest, or one stunned by too much current?',
  axes: [
    { key: 'current', label: 'Injected current I', min: 0, max: 2, base: 0.7, step: 0.02 },
    { key: 'a', label: 'Recovery parameter a', min: 0.3, max: 1.4, base: 0.7, step: 0.02 },
  ],
  fixedParams: { b: 0.8, epsilon: 0.08 },
  probeBudget: 16,
  probeSignal: {
    metric: 'firingRate',
    label: 'Firing rate',
    lowThreshold: 0.005, // ~0 ⇒ quiet (rest or block)
    highThreshold: 0.01, // > 0 ⇒ repetitive spiking
  },
  detailMetrics: ['spiking', 'firingRate', 'fixedPointV', 'oscillationAmplitude'],
  rules: [
    {
      conditions: [{ metric: 'spiking', op: 'gte', value: 1 }],
      regimeId: 'repetitive-spiking',
      label: 'Repetitive spiking (limit cycle)',
    },
    {
      conditions: [{ metric: 'fixedPointV', op: 'gte', value: 0.5 }],
      regimeId: 'depolarization-block',
      label: 'Depolarization block (silenced by over-drive)',
    },
    { conditions: [], regimeId: 'resting', label: 'Excitable rest (sub-threshold)' },
  ],
  knownCatalog: [
    {
      id: 'resting',
      name: 'Excitable rest (stable sub-threshold fixed point)',
      citation:
        'FitzHugh R (1961). Impulses and physiological states in theoretical models of nerve membrane. Biophys. J. 1:445-466.',
      rarity: 0.2,
    },
    {
      id: 'repetitive-spiking',
      name: 'Repetitive spiking (Hopf limit cycle)',
      citation:
        'Nagumo J, Arimoto S, Yoshizawa S (1962). An active pulse transmission line simulating nerve axon. Proc. IRE 50:2061-2070.',
      rarity: 0.4,
    },
  ],
  targets: ['depolarization-block', 'repetitive-spiking'],
};

export const fitzhughNagumoExcitabilityMap = compileRuleQuest(fitzhughNagumoExcitabilityMapData);

export const fitzhughNagumoExcitabilityMapLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  { axisValues: { current: 0, a: 0.7 }, expectedRegimeId: 'resting' },
  { axisValues: { current: 0.3, a: 0.7 }, expectedRegimeId: 'resting' },
  { axisValues: { current: 0.5, a: 0.7 }, expectedRegimeId: 'repetitive-spiking' },
  { axisValues: { current: 1, a: 0.7 }, expectedRegimeId: 'repetitive-spiking' },
  { axisValues: { current: 1.6, a: 0.7 }, expectedRegimeId: 'depolarization-block' },
  { axisValues: { current: 2, a: 0.7 }, expectedRegimeId: 'depolarization-block' },
  { axisValues: { current: 0, a: 0.4 }, expectedRegimeId: 'repetitive-spiking' },
  { axisValues: { current: 1.3, a: 0.4 }, expectedRegimeId: 'depolarization-block' },
  { axisValues: { current: 2, a: 0.4 }, expectedRegimeId: 'depolarization-block' },
  { axisValues: { current: 0.7, a: 1 }, expectedRegimeId: 'repetitive-spiking' },
  { axisValues: { current: 0.9, a: 1 }, expectedRegimeId: 'repetitive-spiking' },
  { axisValues: { current: 2, a: 1 }, expectedRegimeId: 'depolarization-block' },
  { axisValues: { current: 0, a: 1.3 }, expectedRegimeId: 'resting' },
  { axisValues: { current: 2, a: 1.3 }, expectedRegimeId: 'repetitive-spiking' },
];
