/**
 * GENERATED from the discovery quest-authoring workflow (verified against the
 * real "rosenzweig-macarthur" engine). Regenerate via the workflow, not by hand.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const rosenzweigMacarthurEnrichmentCascadeData: RuleQuestData = {
  engine: 'rosenzweig-macarthur',
  slug: 'rosenzweig-macarthur-enrichment-cascade',
  title: 'Paradox of Enrichment: The Boom-Bust Cascade',
  brief:
    'A logistic prey and a hungry, saturating predator share one dial: the prey\'s carrying capacity K — how "rich" you make the environment. Common sense says a richer world is a safer world, but this model famously disagrees. Turn K up and you march through a cascade: too poor and the predator starves out, a comfortable middle where both settle into a calm coexistence, then a Hopf tipping point past which the whole system breaks into boom-bust cycles. Push enrichment even harder and watch for something the textbooks mention less: cycles so violent the prey crashes to a razor\'s edge above zero. Find the regimes, name the famous ones, and hunt the near-extinction relaxation swing hiding at the top of the dial.',
  targets: ['deep-boom-bust', 'paradox-enrichment'],
  axes: [
    {
      key: 'k',
      label: 'Carrying capacity K (enrichment)',
      min: 0.3,
      max: 20,
      base: 6,
      step: 0.1,
    },
  ],
  fixedParams: {
    r: 1,
    a: 1,
    h: 0.5,
    e: 0.5,
    m: 0.2,
    n0: 1,
    p0: 1,
    tEnd: 300,
  },
  probeSignal: {
    metric: 'oscillationAmplitude',
    label: 'Steady-state prey swing (peak-to-peak)',
    lowThreshold: 0.5,
    highThreshold: 6,
  },
  probeBudget: 12,
  detailMetrics: [
    'preyEquilibrium',
    'predatorEquilibrium',
    'enrichmentThreshold',
    'oscillationAmplitude',
    'limitCycle',
    'carryingCapacity',
  ],
  rules: [
    {
      conditions: [{ metric: 'carryingCapacity', op: 'lt', value: 0.55 }],
      regimeId: 'predator-extinction',
      label: 'Predator extinction — enrichment too low to sustain the predator',
    },
    {
      conditions: [
        { metric: 'limitCycle', op: 'gte', value: 1 },
        { metric: 'oscillationAmplitude', op: 'gte', value: 6 },
      ],
      regimeId: 'deep-boom-bust',
      label: 'Deep boom-bust — cycles so violent the prey nearly crashes',
    },
    {
      conditions: [{ metric: 'limitCycle', op: 'gte', value: 1 }],
      regimeId: 'paradox-enrichment',
      label: 'Paradox of enrichment — Hopf limit cycle',
    },
    { conditions: [], regimeId: 'stable-coexistence', label: 'Stable coexistence equilibrium' },
  ],
  knownCatalog: [
    {
      id: 'predator-extinction',
      name: 'Predator extinction (predator cannot persist)',
      citation:
        'Rosenzweig, M.L. & MacArthur, R.H. (1963) Graphical representation and stability conditions of predator-prey interactions. American Naturalist 97:209-223.',
      rarity: 0.5,
    },
    {
      id: 'stable-coexistence',
      name: 'Stable coexistence equilibrium',
      citation:
        'Rosenzweig, M.L. & MacArthur, R.H. (1963) Graphical representation and stability conditions of predator-prey interactions. American Naturalist 97:209-223.',
      rarity: 0.25,
    },
    {
      id: 'paradox-enrichment',
      name: 'Paradox of enrichment (Hopf limit cycle)',
      citation:
        'Rosenzweig, M.L. (1971) Paradox of enrichment: destabilization of exploitation ecosystems in ecological time. Science 171:385-387.',
      rarity: 0.4,
    },
  ],
};

export const rosenzweigMacarthurEnrichmentCascade = compileRuleQuest(
  rosenzweigMacarthurEnrichmentCascadeData,
);

export const rosenzweigMacarthurEnrichmentCascadeLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  {
    axisValues: {
      k: 0.4,
    },
    expectedRegimeId: 'predator-extinction',
  },
  {
    axisValues: {
      k: 0.5,
    },
    expectedRegimeId: 'predator-extinction',
  },
  {
    axisValues: {
      k: 1,
    },
    expectedRegimeId: 'stable-coexistence',
  },
  {
    axisValues: {
      k: 2,
    },
    expectedRegimeId: 'stable-coexistence',
  },
  {
    axisValues: {
      k: 2.9,
    },
    expectedRegimeId: 'stable-coexistence',
  },
  {
    axisValues: {
      k: 3.1,
    },
    expectedRegimeId: 'paradox-enrichment',
  },
  {
    axisValues: {
      k: 4,
    },
    expectedRegimeId: 'paradox-enrichment',
  },
  {
    axisValues: {
      k: 6,
    },
    expectedRegimeId: 'paradox-enrichment',
  },
  {
    axisValues: {
      k: 8,
    },
    expectedRegimeId: 'deep-boom-bust',
  },
  {
    axisValues: {
      k: 10,
    },
    expectedRegimeId: 'deep-boom-bust',
  },
  {
    axisValues: {
      k: 20,
    },
    expectedRegimeId: 'deep-boom-bust',
  },
];
