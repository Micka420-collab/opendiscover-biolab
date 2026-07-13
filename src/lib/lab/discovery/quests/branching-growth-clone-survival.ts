/**
 * GENERATED from the discovery quest-authoring workflow (verified against the
 * real "branching-growth" engine). Regenerate via the workflow, not by hand.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const branchingGrowthCloneSurvivalData: RuleQuestData = {
  engine: 'branching-growth',
  slug: 'branching-growth-clone-survival',
  title: 'Clone Survival: The Fate of a Branching Cell Lineage',
  brief:
    'A single dividing cell founds a lineage: each generation every cell independently dies, sits quiet, or splits in two. Tune how eagerly cells divide and watch a sharp transition emerge between clones doomed to vanish and clones that take off. Somewhere just past the tipping point lies a treacherous middle ground — lineages that grow on average yet usually still die out. Probe the extinction odds, then claim the regimes.',
  targets: ['precarious-growth', 'robust-growth'],
  axes: [
    {
      key: 'divideProb',
      label: 'Division probability per cell (b)',
      min: 0.05,
      max: 0.68,
      base: 0.4,
      step: 0.01,
    },
  ],
  fixedParams: {
    initialCells: 20,
    deathProb: 0.3,
    generations: 30,
    replicates: 400,
    maxPopulationCap: 200000,
    seed: 12345,
  },
  probeSignal: {
    metric: 'extinctionProbabilityTheory',
    label: 'Extinction probability (exact theory)',
    lowThreshold: 0.62,
    highThreshold: 0.95,
  },
  probeBudget: 12,
  detailMetrics: [
    'meanOffspring',
    'extinctionProbabilityTheory',
    'extinctionProbabilityEmpirical',
    'finalMeanPopulation',
  ],
  rules: [
    {
      regimeId: 'robust-growth',
      label: 'Robust supercritical growth',
      conditions: [
        {
          metric: 'extinctionProbabilityTheory',
          op: 'lt',
          value: 0.62,
        },
      ],
    },
    {
      regimeId: 'precarious-growth',
      label: 'Precarious (weakly supercritical) growth',
      conditions: [
        {
          metric: 'meanOffspring',
          op: 'gt',
          value: 1.005,
        },
      ],
    },
    {
      regimeId: 'critical-branching',
      label: 'Critical branching',
      conditions: [
        {
          metric: 'meanOffspring',
          op: 'between',
          value: 0.995,
          value2: 1.005,
        },
      ],
    },
    {
      regimeId: 'subcritical-extinction',
      label: 'Subcritical extinction',
      conditions: [],
    },
  ],
  knownCatalog: [
    {
      id: 'subcritical-extinction',
      name: 'Subcritical extinction (m < 1)',
      citation:
        'Galton F, Watson HW (1875). On the probability of the extinction of families. J. Anthropol. Inst. Great Britain and Ireland 4:138-144.',
      rarity: 0.39,
    },
    {
      id: 'critical-branching',
      name: 'Critical branching (m = 1)',
      citation: 'Harris TE (1963). The Theory of Branching Processes. Springer-Verlag, Berlin.',
      rarity: 0.02,
    },
    {
      id: 'robust-growth',
      name: 'Supercritical survival (m > 1, q < 1)',
      citation:
        'Athreya KB, Ney PE (1972). Branching Processes. Springer-Verlag, Berlin - extinction-probability theorem.',
      rarity: 0.29,
    },
  ],
};

export const branchingGrowthCloneSurvival = compileRuleQuest(branchingGrowthCloneSurvivalData);

export const branchingGrowthCloneSurvivalLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  {
    axisValues: {
      divideProb: 0.1,
    },
    expectedRegimeId: 'subcritical-extinction',
  },
  {
    axisValues: {
      divideProb: 0.2,
    },
    expectedRegimeId: 'subcritical-extinction',
  },
  {
    axisValues: {
      divideProb: 0.29,
    },
    expectedRegimeId: 'subcritical-extinction',
  },
  {
    axisValues: {
      divideProb: 0.3,
    },
    expectedRegimeId: 'critical-branching',
  },
  {
    axisValues: {
      divideProb: 0.31,
    },
    expectedRegimeId: 'precarious-growth',
  },
  {
    axisValues: {
      divideProb: 0.4,
    },
    expectedRegimeId: 'precarious-growth',
  },
  {
    axisValues: {
      divideProb: 0.47,
    },
    expectedRegimeId: 'precarious-growth',
  },
  {
    axisValues: {
      divideProb: 0.48,
    },
    expectedRegimeId: 'precarious-growth',
  },
  {
    axisValues: {
      divideProb: 0.5,
    },
    expectedRegimeId: 'robust-growth',
  },
  {
    axisValues: {
      divideProb: 0.6,
    },
    expectedRegimeId: 'robust-growth',
  },
  {
    axisValues: {
      divideProb: 0.68,
    },
    expectedRegimeId: 'robust-growth',
  },
];
