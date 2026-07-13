/**
 * GENERATED from the discovery quest-authoring workflow (verified against the
 * real "compartmental" engine). Regenerate via the workflow, not by hand.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const compartmentalEpidemicThresholdData: RuleQuestData = {
  engine: 'compartmental',
  slug: 'compartmental-epidemic-threshold',
  title: 'Crossing the Epidemic Threshold',
  brief:
    "A single infectious seed lands in a susceptible city of a million people. You control only one dial — the transmission rate beta — while the recovery rate stays fixed. Tune it and watch the final attack rate, then claim the regime you think you've found: does the spark fizzle out, smoulder into a slow burn, ignite a major epidemic, or overshoot into near-total infection? Three of these are textbook. One is waiting to be discovered.",
  targets: ['overshoot', 'disease-free'],
  axes: [
    {
      key: 'beta',
      label: 'Transmission rate β (per day)',
      min: 0.05,
      max: 1.2,
      base: 0.5,
      step: 0.005,
    },
  ],
  fixedParams: {
    gamma: 0.2,
    population: 1000000,
    i0: 100,
    tMax: 400,
    outputPoints: 1200,
  },
  probeSignal: {
    metric: 'finalSize',
    label: 'Final epidemic size (fraction ever infected)',
    lowThreshold: 0.05,
    highThreshold: 0.97,
  },
  probeBudget: 12,
  detailMetrics: ['r0', 'herdImmunityThreshold', 'peakInfected', 'peakDay'],
  rules: [
    {
      regimeId: 'disease-free',
      label: 'Below threshold — outbreak dies out',
      conditions: [
        {
          metric: 'finalSize',
          op: 'lt',
          value: 0.05,
        },
      ],
    },
    {
      regimeId: 'self-limiting',
      label: 'Self-limiting epidemic — slow, partial spread',
      conditions: [
        {
          metric: 'finalSize',
          op: 'lt',
          value: 0.75,
        },
      ],
    },
    {
      regimeId: 'major-epidemic',
      label: 'Major epidemic — most of the population infected',
      conditions: [
        {
          metric: 'finalSize',
          op: 'lt',
          value: 0.97,
        },
      ],
    },
    {
      regimeId: 'overshoot',
      label: 'Overshoot — near-universal infection',
      conditions: [],
    },
  ],
  knownCatalog: [
    {
      id: 'disease-free',
      name: 'Sub-threshold burnout (R₀ < 1)',
      citation:
        'Kermack WO, McKendrick AG (1927). A contribution to the mathematical theory of epidemics. Proc. R. Soc. Lond. A 115:700–721.',
      rarity: 0.25,
    },
    {
      id: 'self-limiting',
      name: 'Self-limiting epidemic (final-size relation)',
      citation:
        'Diekmann O, Heesterbeek JAP (2000). Mathematical Epidemiology of Infectious Diseases. Wiley.',
      rarity: 0.4,
    },
    {
      id: 'major-epidemic',
      name: 'Major epidemic above the herd-immunity threshold',
      citation:
        'Hethcote HW (2000). The mathematics of infectious diseases. SIAM Review 42:599–653.',
      rarity: 0.35,
    },
  ],
};

export const compartmentalEpidemicThreshold = compileRuleQuest(compartmentalEpidemicThresholdData);

export const compartmentalEpidemicThresholdLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  {
    axisValues: {
      beta: 0.1,
    },
    expectedRegimeId: 'disease-free',
  },
  {
    axisValues: {
      beta: 0.18,
    },
    expectedRegimeId: 'disease-free',
  },
  {
    axisValues: {
      beta: 0.2,
    },
    expectedRegimeId: 'disease-free',
  },
  {
    axisValues: {
      beta: 0.22,
    },
    expectedRegimeId: 'self-limiting',
  },
  {
    axisValues: {
      beta: 0.3,
    },
    expectedRegimeId: 'self-limiting',
  },
  {
    axisValues: {
      beta: 0.35,
    },
    expectedRegimeId: 'self-limiting',
  },
  {
    axisValues: {
      beta: 0.4,
    },
    expectedRegimeId: 'major-epidemic',
  },
  {
    axisValues: {
      beta: 0.5,
    },
    expectedRegimeId: 'major-epidemic',
  },
  {
    axisValues: {
      beta: 0.6,
    },
    expectedRegimeId: 'major-epidemic',
  },
  {
    axisValues: {
      beta: 0.75,
    },
    expectedRegimeId: 'overshoot',
  },
  {
    axisValues: {
      beta: 1,
    },
    expectedRegimeId: 'overshoot',
  },
  {
    axisValues: {
      beta: 1.2,
    },
    expectedRegimeId: 'overshoot',
  },
];
