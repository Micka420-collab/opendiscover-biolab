/**
 * Data-driven quests. Most engines classify a regime from simple threshold rules
 * on their metrics (e.g. R₀ < 1 ⇒ no outbreak, order parameter > 0.9 ⇒
 * synchronized). `RuleQuestData` captures such a quest as pure data — no code —
 * so quests can be authored, verified against the real engine, and registered
 * uniformly. `compileRuleQuest` turns the data into a {@link Quest} by building
 * its `classify` from the rules (first fully-matching rule wins).
 *
 * A regime a rule can emit but that is deliberately left OUT of `knownCatalog`
 * is a genuinely novel find (the same mechanism as the logistic map's
 * undocumented periodic windows).
 */
import type { SimResult } from '../../sim';
import type { Quest, Regime } from './types';

export type CompareOp = 'lt' | 'lte' | 'gt' | 'gte' | 'between' | 'eq' | 'ne';

export interface RuleCondition {
  metric: string;
  op: CompareOp;
  value: number;
  /** Upper bound for `between` (inclusive). */
  value2?: number;
}

export interface ClassRule {
  /** ALL conditions must hold. An empty list is an unconditional catch-all. */
  conditions: RuleCondition[];
  regimeId: string;
  label: string;
}

export interface RuleQuestData {
  slug: string;
  title: string;
  engine: string;
  brief: string;
  axes: Quest['axes'];
  fixedParams: Record<string, number>;
  probeBudget: number;
  probeSignal: Quest['probeSignal'];
  /** Metric keys summarized in a regime's `detail` string. */
  detailMetrics: string[];
  /** Ordered; first rule whose conditions all hold classifies the result. */
  rules: ClassRule[];
  knownCatalog: Quest['knownCatalog'];
  targets: string[];
}

const EPS = 1e-9;

function metricOf(result: SimResult, key: string): number {
  return result.metrics.find((m) => m.key === key)?.value ?? Number.NaN;
}

function conditionHolds(result: SimResult, cond: RuleCondition): boolean {
  const v = metricOf(result, cond.metric);
  if (Number.isNaN(v)) return false;
  switch (cond.op) {
    case 'lt':
      return v < cond.value;
    case 'lte':
      return v <= cond.value;
    case 'gt':
      return v > cond.value;
    case 'gte':
      return v >= cond.value;
    case 'eq':
      return Math.abs(v - cond.value) <= EPS;
    case 'ne':
      return Math.abs(v - cond.value) > EPS;
    case 'between':
      return v >= cond.value && v <= (cond.value2 ?? cond.value);
  }
}

export function compileRuleQuest(data: RuleQuestData): Quest {
  const classify = (result: SimResult): Regime => {
    const detail = data.detailMetrics
      .map((m) => `${m}=${metricOf(result, m).toFixed(3)}`)
      .join(', ');
    for (const rule of data.rules) {
      if (rule.conditions.every((c) => conditionHolds(result, c))) {
        return { id: rule.regimeId, label: rule.label, detail };
      }
    }
    return { id: 'unclassified', label: 'Unclassified regime', detail };
  };

  return {
    slug: data.slug,
    title: data.title,
    engine: data.engine,
    brief: data.brief,
    axes: data.axes,
    fixedParams: data.fixedParams,
    probeBudget: data.probeBudget,
    probeSignal: data.probeSignal,
    classify,
    knownCatalog: data.knownCatalog,
    targets: data.targets,
  };
}
