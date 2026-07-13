/**
 * Discovery-mode quest registry. Add a quest here and it is playable everywhere
 * (the same registry drives the API and UI, as the engine registry does).
 */
import { generatedQuests } from './quests/all-generated';
import { logisticRoadToChaos } from './quests/logistic-road-to-chaos';
import type { Quest } from './types';

export const quests: Quest[] = [logisticRoadToChaos, ...generatedQuests];

const bySlug = new Map<string, Quest>(quests.map((q) => [q.slug, q]));

export function getQuest(slug: string): Quest | undefined {
  return bySlug.get(slug);
}

export function listQuests(): Quest[] {
  return quests;
}

export { claim, probe, questParams, regimeAt } from './core';
export { compileRuleQuest } from './rule-quest';
export type { ClassRule, CompareOp, RuleCondition, RuleQuestData } from './rule-quest';
export type {
  ClaimVerdict,
  KnownRegime,
  ProbeResult,
  Quest,
  QuestAxis,
  QuestView,
  Regime,
} from './types';
