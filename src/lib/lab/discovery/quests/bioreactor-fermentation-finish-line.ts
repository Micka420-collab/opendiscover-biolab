/**
 * GENERATED from the discovery quest-authoring workflow (verified against the
 * real "bioreactor" engine). Regenerate via the workflow, not by hand.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const bioreactorFermentationFinishLineData: RuleQuestData = {
  engine: 'bioreactor',
  slug: 'bioreactor-fermentation-finish-line',
  title: 'The Fermentation Finish Line',
  brief:
    'A closed batch fermenter is charged with 10 g/L of sugar and a pinch of cells, then left to run for 24 hours. The whole outcome hinges on one number: how fast the microbe can grow — its maximum specific growth rate μmax. Grow fast enough and the culture eats every last gram of substrate and coasts into a stationary-phase plateau; grow too slowly and you pull the tank while the cells are still dividing with sugar to spare — or the culture barely gets going at all. Probe μmax, watch the harvested biomass, then commit to what actually happened inside: a fermentation run to completion, a batch arrested mid-exponential with substrate still in the tank, or a culture that never took off. The two clean endpoints are textbook — the stalled non-starter is the one nobody bothers to name.',
  axes: [
    {
      key: 'muMax',
      label: 'Max specific growth rate μmax (1/h)',
      min: 0.05,
      max: 1,
      base: 0.15,
      step: 0.005,
    },
  ],
  fixedParams: {
    ks: 0.5,
    yxs: 0.5,
    x0: 0.1,
    s0: 10,
    alpha: 0.3,
    beta: 0,
    p0: 0,
    tEnd: 24,
    outputPoints: 400,
  },
  probeBudget: 10,
  probeSignal: {
    metric: 'finalBiomass',
    label: 'Harvested biomass X (g/L)',
    lowThreshold: 1.5,
    highThreshold: 5,
  },
  detailMetrics: ['finalSubstrate', 'finalBiomass', 'finalProduct', 'timeToSubstrateExhaustion'],
  rules: [
    {
      conditions: [
        {
          metric: 'finalSubstrate',
          op: 'lt',
          value: 0.1,
        },
      ],
      regimeId: 'complete-conversion',
      label: 'Complete conversion (stationary phase)',
    },
    {
      conditions: [
        {
          metric: 'finalSubstrate',
          op: 'gt',
          value: 8,
        },
      ],
      regimeId: 'stalled-growth',
      label: 'Stalled culture (negligible conversion)',
    },
    {
      conditions: [],
      regimeId: 'arrested-fermentation',
      label: 'Arrested fermentation (mid-exponential harvest)',
    },
  ],
  knownCatalog: [
    {
      id: 'complete-conversion',
      name: 'Complete conversion — substrate-limited stationary-phase plateau (X → X0 + Yxs·S0)',
      citation:
        'Monod, J. (1949) The growth of bacterial cultures. Annu. Rev. Microbiol. 3:371–394',
      rarity: 0.15,
    },
    {
      id: 'arrested-fermentation',
      name: 'Exponential-phase batch (culture still actively growing, substrate present at harvest)',
      citation:
        'Bailey, J.E. & Ollis, D.F. (1986) Biochemical Engineering Fundamentals, 2nd ed., McGraw-Hill, ch. 7',
      rarity: 0.45,
    },
  ],
  targets: ['stalled-growth', 'arrested-fermentation'],
};

export const bioreactorFermentationFinishLine = compileRuleQuest(
  bioreactorFermentationFinishLineData,
);

export const bioreactorFermentationFinishLineLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  {
    axisValues: {
      muMax: 0.05,
    },
    expectedRegimeId: 'stalled-growth',
  },
  {
    axisValues: {
      muMax: 0.08,
    },
    expectedRegimeId: 'stalled-growth',
  },
  {
    axisValues: {
      muMax: 0.1,
    },
    expectedRegimeId: 'stalled-growth',
  },
  {
    axisValues: {
      muMax: 0.12,
    },
    expectedRegimeId: 'arrested-fermentation',
  },
  {
    axisValues: {
      muMax: 0.15,
    },
    expectedRegimeId: 'arrested-fermentation',
  },
  {
    axisValues: {
      muMax: 0.17,
    },
    expectedRegimeId: 'arrested-fermentation',
  },
  {
    axisValues: {
      muMax: 0.18,
    },
    expectedRegimeId: 'arrested-fermentation',
  },
  {
    axisValues: {
      muMax: 0.19,
    },
    expectedRegimeId: 'complete-conversion',
  },
  {
    axisValues: {
      muMax: 0.25,
    },
    expectedRegimeId: 'complete-conversion',
  },
  {
    axisValues: {
      muMax: 0.5,
    },
    expectedRegimeId: 'complete-conversion',
  },
  {
    axisValues: {
      muMax: 1,
    },
    expectedRegimeId: 'complete-conversion',
  },
];
