import type { Quest } from '../types';
import {
  bioreactorFermentationFinishLine,
  bioreactorFermentationFinishLineLandmarks,
} from './bioreactor-fermentation-finish-line';
import {
  branchingGrowthCloneSurvival,
  branchingGrowthCloneSurvivalLandmarks,
} from './branching-growth-clone-survival';
import {
  compartmentalEpidemicThreshold,
  compartmentalEpidemicThresholdLandmarks,
} from './compartmental-epidemic-threshold';
import {
  driftVersusPopulationSize,
  driftVersusPopulationSizeLandmarks,
} from './drift-versus-population-size';
// GENERATED — all workflow-authored quests.
import {
  kuramotoSynchronizationTransition,
  kuramotoSynchronizationTransitionLandmarks,
} from './kuramoto-synchronization-transition';
import {
  rosenzweigMacarthurEnrichmentCascade,
  rosenzweigMacarthurEnrichmentCascadeLandmarks,
} from './rosenzweig-macarthur-enrichment-cascade';

export const generatedQuests: Quest[] = [
  kuramotoSynchronizationTransition,
  compartmentalEpidemicThreshold,
  branchingGrowthCloneSurvival,
  rosenzweigMacarthurEnrichmentCascade,
  driftVersusPopulationSize,
  bioreactorFermentationFinishLine,
];

export const generatedLandmarks: {
  quest: Quest;
  landmarks: { axisValues: Record<string, number>; expectedRegimeId: string }[];
}[] = [
  {
    quest: kuramotoSynchronizationTransition,
    landmarks: kuramotoSynchronizationTransitionLandmarks,
  },
  { quest: compartmentalEpidemicThreshold, landmarks: compartmentalEpidemicThresholdLandmarks },
  { quest: branchingGrowthCloneSurvival, landmarks: branchingGrowthCloneSurvivalLandmarks },
  {
    quest: rosenzweigMacarthurEnrichmentCascade,
    landmarks: rosenzweigMacarthurEnrichmentCascadeLandmarks,
  },
  { quest: driftVersusPopulationSize, landmarks: driftVersusPopulationSizeLandmarks },
  { quest: bioreactorFermentationFinishLine, landmarks: bioreactorFermentationFinishLineLandmarks },
];
