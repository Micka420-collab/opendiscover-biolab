/**
 * Discovery mode — a real exploration-and-novelty game on the deterministic
 * engines. Unlike AURORA (drag one dial to a pre-drawn target), a quest hides
 * the response, gives a limited probe budget, and rewards finding qualitatively
 * distinct *regimes* — then tells the player, via the engine's own science and a
 * curated catalog, whether what they found is a KNOWN phenomenon (with a
 * citation) or a genuinely novel regime not yet documented.
 *
 * Everything here is pure and deterministic: a claim carries a canonical hash of
 * `{engine, params}`, so a find is reproducible and — once a shared ledger is
 * wired up — globally attributable ("first to find").
 */
import type { SimResult } from '../../sim';

/** A qualitatively distinct outcome of an engine, identified from its output. */
export interface Regime {
  /** Canonical, stable id — the key both the catalog and novelty check use. */
  id: string;
  /** Human-facing name. */
  label: string;
  /** Short evidence string, e.g. "period 3, λ=-0.045". */
  detail: string;
}

/** A regime already documented in the literature (so, not a novel find). */
export interface KnownRegime {
  id: string;
  /** Documented name of the phenomenon. */
  name: string;
  /** Primary reference. */
  citation: string;
  /** 0..1 — how rare / prized this regime is (drives scoring). */
  rarity: number;
}

/** One tunable axis of a quest's parameter space (others are fixed). */
export interface QuestAxis {
  key: string;
  label: string;
  min: number;
  max: number;
  /** Starting value. */
  base: number;
  /** Suggested slider granularity. */
  step: number;
}

export interface Quest {
  slug: string;
  title: string;
  /** The engine this quest explores. */
  engine: string;
  /** The scientific question, in plain language. */
  brief: string;
  /** Parameters the player may tune. */
  axes: QuestAxis[];
  /** Parameters held fixed for every run in this quest. */
  fixedParams: Record<string, number>;
  /** How many probes the player gets before they should commit to a claim. */
  probeBudget: number;
  /** Map an engine result to its canonical regime. */
  classify: (result: SimResult) => Regime;
  /** The documented regimes for this quest (anything else is novel). */
  knownCatalog: KnownRegime[];
  /** Regime ids that are the prized objectives of the quest. */
  targets: string[];
}

/**
 * The serializable view of a quest — everything except the `classify` function,
 * which can't cross the Server→Client component boundary. This is what the game
 * UI receives; classification happens server-side in the discovery API.
 */
export type QuestView = Omit<Quest, 'classify'>;

/** The limited feedback one probe reveals — NOT the exact regime. */
export interface ProbeResult {
  params: Record<string, number>;
  /** A continuous signal the player can reason about (e.g. the Lyapunov exponent). */
  signalKey: string;
  signalLabel: string;
  signalValue: number;
  /** Coarse qualitative read: is the system periodic, chaotic, or on the edge? */
  hint: 'periodic' | 'chaotic' | 'marginal';
}

/** The verdict when a player commits to a discovery claim. */
export interface ClaimVerdict {
  regime: Regime;
  /** Canonical hash of `{engine, params}` — the reproducible proof-of-find. */
  hash: string;
  /** The documented match, or null if this regime is not in the catalog. */
  known: KnownRegime | null;
  /** True ⇒ the regime is not (yet) documented in this quest's catalog. */
  isNovel: boolean;
  /** 0..1 rarity used for scoring. */
  rarity: number;
  /** Points awarded (rarity + novelty + probe efficiency). */
  score: number;
  /** A player-facing message summarizing the verdict. */
  message: string;
}
