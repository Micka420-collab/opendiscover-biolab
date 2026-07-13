/**
 * GENERATED from the discovery quest-authoring workflow (verified against the
 * real "kuramoto" engine). Regenerate via the workflow, not by hand.
 */
import { compileRuleQuest } from '../rule-quest';
import type { RuleQuestData } from '../rule-quest';

export const kuramotoSynchronizationTransitionData: RuleQuestData = {
  engine: 'kuramoto',
  slug: 'kuramoto-synchronization-transition',
  title: 'Kuramoto: The Edge of Synchrony',
  brief:
    'A population of coupled oscillators — fireflies, pacemaker cells, applauding hands — drifts in noisy disorder until the global coupling K crosses a critical value, and a shared rhythm suddenly nucleates. Tune K and read the steady-state coherence ⟨r⟩ to map the incoherent, partially locked, and fully synchronized states. The prize is the razor-thin onset band right at the critical coupling, where coherence first lifts off zero — the textbooks name the states on either side but rarely this fragile threshold itself.',
  probeBudget: 14,
  axes: [
    {
      key: 'coupling',
      label: 'Coupling strength K',
      min: 0,
      max: 10,
      base: 2,
      step: 0.1,
    },
  ],
  fixedParams: {
    oscillators: 200,
    freqSpread: 1,
    tEnd: 60,
    steps: 3000,
    outputPoints: 400,
    seed: 7,
  },
  probeSignal: {
    metric: 'meanOrderParameter',
    label: 'Steady-state coherence ⟨r⟩',
    lowThreshold: 0.3,
    highThreshold: 0.9,
  },
  detailMetrics: ['meanOrderParameter', 'finalOrderParameter', 'criticalCoupling', 'synchronized'],
  rules: [
    {
      regimeId: 'incoherent',
      label: 'Incoherent drift',
      conditions: [
        {
          metric: 'meanOrderParameter',
          op: 'lt',
          value: 0.3,
        },
      ],
    },
    {
      regimeId: 'critical-onset',
      label: 'Critical onset band',
      conditions: [
        {
          metric: 'meanOrderParameter',
          op: 'lt',
          value: 0.55,
        },
      ],
    },
    {
      regimeId: 'partial-sync',
      label: 'Partial synchronization',
      conditions: [
        {
          metric: 'meanOrderParameter',
          op: 'lt',
          value: 0.9,
        },
      ],
    },
    {
      regimeId: 'full-sync',
      label: 'Full synchronization',
      conditions: [],
    },
  ],
  targets: ['critical-onset', 'full-sync'],
  knownCatalog: [
    {
      id: 'incoherent',
      name: 'Incoherent drift (r ≈ 0)',
      citation:
        'Kuramoto, Y. (1975) Self-entrainment of a population of coupled non-linear oscillators. Lecture Notes in Physics 39:420-422.',
      rarity: 0.2,
    },
    {
      id: 'partial-sync',
      name: 'Partially synchronized cluster',
      citation: 'Strogatz, S.H. (2000) From Kuramoto to Crawford. Physica D 143:1-20.',
      rarity: 0.4,
    },
    {
      id: 'full-sync',
      name: 'Full phase locking (r → 1)',
      citation: 'Acebrón, J.A. et al. (2005) The Kuramoto model. Rev. Mod. Phys. 77:137-185.',
      rarity: 0.3,
    },
  ],
};

export const kuramotoSynchronizationTransition = compileRuleQuest(
  kuramotoSynchronizationTransitionData,
);

export const kuramotoSynchronizationTransitionLandmarks: {
  axisValues: Record<string, number>;
  expectedRegimeId: string;
}[] = [
  {
    axisValues: {
      coupling: 0,
    },
    expectedRegimeId: 'incoherent',
  },
  {
    axisValues: {
      coupling: 0.8,
    },
    expectedRegimeId: 'incoherent',
  },
  {
    axisValues: {
      coupling: 1.4,
    },
    expectedRegimeId: 'incoherent',
  },
  {
    axisValues: {
      coupling: 1.596,
    },
    expectedRegimeId: 'critical-onset',
  },
  {
    axisValues: {
      coupling: 1.7,
    },
    expectedRegimeId: 'critical-onset',
  },
  {
    axisValues: {
      coupling: 1.9,
    },
    expectedRegimeId: 'partial-sync',
  },
  {
    axisValues: {
      coupling: 2.4,
    },
    expectedRegimeId: 'partial-sync',
  },
  {
    axisValues: {
      coupling: 2.8,
    },
    expectedRegimeId: 'full-sync',
  },
  {
    axisValues: {
      coupling: 4,
    },
    expectedRegimeId: 'full-sync',
  },
  {
    axisValues: {
      coupling: 8,
    },
    expectedRegimeId: 'full-sync',
  },
];
