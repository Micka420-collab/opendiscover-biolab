/**
 * Discovery-mode engine: probe (limited feedback) and claim (full verdict +
 * reproducible hash + novelty check). Pure over a {@link Quest} and the
 * deterministic simulation registry.
 */
import { runEngine } from '../../sim';
import { canonicalHash } from '../../util/hash';
import type { ClaimVerdict, ProbeResult, Quest, Regime } from './types';

/** Build the full engine params for a set of tuned axis values. */
export function questParams(
  quest: Quest,
  axisValues: Record<string, number>,
): Record<string, number> {
  const params = { ...quest.fixedParams };
  for (const axis of quest.axes) {
    params[axis.key] = axisValues[axis.key] ?? axis.base;
  }
  return params;
}

const metricValue = (result: { metrics: { key: string; value: number }[] }, key: string): number =>
  result.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

/**
 * Spend one probe: run the engine but reveal only a continuous signal and a
 * coarse periodic/chaotic/marginal read — never the exact regime. The player
 * must reason about where the interesting pockets are and commit via a claim.
 */
export function probe(quest: Quest, axisValues: Record<string, number>): ProbeResult {
  const params = questParams(quest, axisValues);
  const result = runEngine(quest.engine, params);
  const { metric, label, lowThreshold, highThreshold } = quest.probeSignal;
  const value = metricValue(result, metric);
  const band: ProbeResult['band'] =
    value < lowThreshold ? 'low' : value > highThreshold ? 'high' : 'mid';
  return { params, signalKey: metric, signalLabel: label, signalValue: value, band };
}

/** Classify a set of axis values into its regime (runs the engine). */
export function regimeAt(quest: Quest, axisValues: Record<string, number>): Regime {
  return quest.classify(runEngine(quest.engine, questParams(quest, axisValues)));
}

/**
 * Commit to a discovery. Runs the engine, classifies the regime, computes the
 * canonical proof hash, and checks the regime against the quest's catalog:
 * a catalogued regime is a correct *identification* of a known phenomenon; an
 * uncatalogued one is a genuinely novel find. `probesUsed` rewards efficiency.
 */
export async function claim(
  quest: Quest,
  axisValues: Record<string, number>,
  probesUsed = 0,
): Promise<ClaimVerdict> {
  const params = questParams(quest, axisValues);
  const result = runEngine(quest.engine, params);
  const regime = quest.classify(result);
  const hash = await canonicalHash({ engine: quest.engine, params });
  const known = quest.knownCatalog.find((k) => k.id === regime.id) ?? null;
  const isNovel = known === null;

  // Rarity: catalogued regimes use their documented rarity; a novel regime is
  // treated as high-value (it is, by construction, off the beaten path).
  const rarity = known ? known.rarity : 0.85;

  // Efficiency bonus: more of the probe budget left when you commit ⇒ better.
  const budget = Math.max(1, quest.probeBudget);
  const efficiency = Math.max(0, (budget - probesUsed) / budget); // 0..1

  const base = isNovel ? 500 : 100;
  const rarityBonus = Math.round(rarity * 300);
  const efficiencyBonus = Math.round(efficiency * 150);
  const score = base + rarityBonus + efficiencyBonus;

  const isTarget = quest.targets.includes(regime.id);
  const message = isNovel
    ? `🌍 Novel find — "${regime.label}" is not in the catalogue. You are the first to document this regime (${regime.detail}).`
    : `Identified: ${known.name} (${regime.detail}). Documented in ${known.citation}.${
        isTarget ? ' A prized target for this quest.' : ''
      }`;

  return { regime, hash, known, isNovel, rarity, score, message };
}
