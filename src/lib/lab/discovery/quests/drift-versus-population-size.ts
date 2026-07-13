/**
 * GENERATED from the discovery quest-authoring workflow (verified against the
 * real "wright-fisher" engine). Regenerate via the workflow, not by hand.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const driftVersusPopulationSizeData: RuleQuestData = {
  engine: 'wright-fisher',
  slug: 'drift-versus-population-size',
  title: 'The Weight of Small Numbers',
  brief:
    'A single neutral gene variant, starting at exactly 50/50 odds, is set loose in populations of different sizes and left to drift for 200 generations. In tiny populations, chance alone rapidly drives the variant all the way to fixation or all the way to extinction — no selection required. In huge populations, drift is so slow that almost every population is still carrying both alleles when the clock runs out. Probe the population size N to sense how many populations have swept to fixation, then commit to a claim: have you found rapid drift-driven fixation/loss, persistent polymorphism, or the crossover zone in between where drift is only half-finished?',
  axes: [
    {
      key: 'popSize',
      label: 'Population size N',
      min: 2,
      max: 500,
      base: 60,
      step: 1,
    },
  ],
  fixedParams: {
    initFreq: 0.5,
    generations: 200,
    replicates: 400,
    seed: 7,
  },
  probeBudget: 12,
  probeSignal: {
    metric: 'fixationProbability',
    label: 'Fixation probability of A',
    lowThreshold: 0.1,
    highThreshold: 0.35,
  },
  detailMetrics: ['fixationProbability', 'lossProbability', 'meanFinalFreq', 'meanAbsorptionTime'],
  rules: [
    {
      regimeId: 'drift-fixation-loss',
      label: 'Drift-driven fixation or loss',
      conditions: [
        {
          metric: 'fixationProbability',
          op: 'gte',
          value: 0.35,
        },
        {
          metric: 'lossProbability',
          op: 'gte',
          value: 0.35,
        },
      ],
    },
    {
      regimeId: 'persistent-polymorphism',
      label: 'Persistent polymorphism',
      conditions: [
        {
          metric: 'fixationProbability',
          op: 'lt',
          value: 0.1,
        },
        {
          metric: 'lossProbability',
          op: 'lt',
          value: 0.1,
        },
      ],
    },
    {
      regimeId: 'drift-in-progress',
      label: 'Drift in progress (half-absorbed)',
      conditions: [],
    },
  ],
  knownCatalog: [
    {
      id: 'drift-fixation-loss',
      name: 'Fixation or loss by random genetic drift',
      citation: 'Wright, S. (1931) Evolution in Mendelian Populations. Genetics 16:97-159',
      rarity: 0.2,
    },
    {
      id: 'persistent-polymorphism',
      name: 'Slow drift / retained polymorphism (absorption time ~4N generations)',
      citation:
        'Kimura, M. & Ohta, T. (1969) The average number of generations until fixation of a mutant gene in a finite population. Genetics 61:763-771',
      rarity: 0.45,
    },
  ],
  targets: ['drift-in-progress', 'persistent-polymorphism'],
};

export const driftVersusPopulationSize = compileRuleQuest(driftVersusPopulationSizeData);

export const driftVersusPopulationSizeLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  {
    axisValues: {
      popSize: 5,
    },
    expectedRegimeId: 'drift-fixation-loss',
  },
  {
    axisValues: {
      popSize: 20,
    },
    expectedRegimeId: 'drift-fixation-loss',
  },
  {
    axisValues: {
      popSize: 45,
    },
    expectedRegimeId: 'drift-fixation-loss',
  },
  {
    axisValues: {
      popSize: 60,
    },
    expectedRegimeId: 'drift-fixation-loss',
  },
  {
    axisValues: {
      popSize: 90,
    },
    expectedRegimeId: 'drift-in-progress',
  },
  {
    axisValues: {
      popSize: 120,
    },
    expectedRegimeId: 'drift-in-progress',
  },
  {
    axisValues: {
      popSize: 160,
    },
    expectedRegimeId: 'drift-in-progress',
  },
  {
    axisValues: {
      popSize: 300,
    },
    expectedRegimeId: 'persistent-polymorphism',
  },
  {
    axisValues: {
      popSize: 500,
    },
    expectedRegimeId: 'persistent-polymorphism',
  },
];
