/**
 * Lab-wide exploration "dex" + achievements.
 *
 * Turns running engines into a light collection game: the set of engines a
 * visitor has run is kept in localStorage (no account, no backend), and pure
 * functions here derive progress and unlocked badges from that set against the
 * live engine catalog. The pure part (`computeAchievements`) is unit-tested; the
 * localStorage helpers are guarded so the module is import-safe in Node too.
 */

export const EXPLORED_STORAGE_KEY = 'odb:explored-engines';
/** Fired on `window` whenever the explored set changes, so panels can refresh. */
export const EXPLORED_EVENT = 'odb:explored-changed';

export interface CatalogEntry {
  slug: string;
  domain: string;
}

export interface AchievementStatus {
  id: string;
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
  /** Progress toward the goal. */
  have: number;
  need: number;
}

export interface ExplorationSummary {
  exploredCount: number;
  total: number;
  domainsCovered: number;
  totalDomains: number;
  achievements: AchievementStatus[];
}

/** Everything an achievement's `have`/`need` may read about current progress. */
interface AchievementCtx {
  explored: number;
  domains: number;
  total: number;
  totalDomains: number;
  /** Engines explored in the single most-complete domain (for "go deep" badges). */
  bestDomainHave: number;
  /** Total engines in that same domain. */
  bestDomainNeed: number;
}

interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Current progress value for this achievement. */
  have: (ctx: AchievementCtx) => number;
  /** Goal value. */
  need: (ctx: AchievementCtx) => number;
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-run',
    icon: '🔬',
    name: 'First experiment',
    description: 'Run your first engine.',
    have: (c) => c.explored,
    need: () => 1,
  },
  {
    id: 'five-engines',
    icon: '🧪',
    name: 'Getting warmed up',
    description: 'Run 5 different engines.',
    have: (c) => c.explored,
    need: () => 5,
  },
  {
    id: 'fifteen-engines',
    icon: '⚗️',
    name: 'Lab regular',
    description: 'Run 15 different engines.',
    have: (c) => c.explored,
    need: () => 15,
  },
  {
    id: 'half-the-lab',
    icon: '🧭',
    name: 'Halfway explorer',
    description: 'Run half of all the engines in the lab.',
    have: (c) => c.explored,
    need: (c) => Math.ceil(c.total / 2),
  },
  {
    id: 'domain-sampler',
    icon: '🗺️',
    name: 'Cross-disciplinary',
    description: 'Run an engine in 5 different domains.',
    have: (c) => c.domains,
    need: () => 5,
  },
  {
    id: 'all-domains',
    icon: '🌍',
    name: 'Renaissance scientist',
    description: 'Run an engine in every domain.',
    have: (c) => c.domains,
    need: (c) => c.totalDomains,
  },
  {
    id: 'domain-specialist',
    icon: '🎓',
    name: 'Domain specialist',
    description: 'Run every engine in a single domain.',
    have: (c) => c.bestDomainHave,
    need: (c) => c.bestDomainNeed,
  },
  {
    id: 'completionist',
    icon: '🏆',
    name: 'Completionist',
    description: 'Run every engine in the lab.',
    have: (c) => c.explored,
    need: (c) => c.total,
  },
];

/** Derive exploration progress + achievement statuses from the explored set. */
export function computeAchievements(
  exploredSlugs: Iterable<string>,
  catalog: CatalogEntry[],
): ExplorationSummary {
  const bySlug = new Map(catalog.map((e) => [e.slug, e]));
  const explored = new Set<string>();
  for (const slug of exploredSlugs) if (bySlug.has(slug)) explored.add(slug);

  const domainsCovered = new Set<string>();
  for (const slug of explored) {
    const entry = bySlug.get(slug);
    if (entry) domainsCovered.add(entry.domain);
  }

  // Per-domain totals and explored counts, to reward finishing a whole domain.
  const domainTotals = new Map<string, number>();
  const domainExplored = new Map<string, number>();
  for (const entry of catalog) {
    domainTotals.set(entry.domain, (domainTotals.get(entry.domain) ?? 0) + 1);
  }
  for (const slug of explored) {
    const entry = bySlug.get(slug);
    if (entry) domainExplored.set(entry.domain, (domainExplored.get(entry.domain) ?? 0) + 1);
  }
  const totalDomains = domainTotals.size;

  // The "domain specialist" badge rewards finishing a *substantial* field, not a
  // one-engine domain, so only domains with at least this many engines qualify.
  const MIN_SPECIALIST_DOMAIN = 3;
  const sortedDomains = [...domainTotals].sort((a, b) => a[0].localeCompare(b[0]));
  const substantial = sortedDomains.filter(([, need]) => need >= MIN_SPECIALIST_DOMAIN);
  // Among substantial domains, track the one closest to completion (ties broken by
  // more engines already run). If none are substantial (tiny catalog), fall back to
  // the largest domain so the target is still meaningful. Deterministic throughout.
  const candidates = substantial.length > 0 ? substantial : sortedDomains;
  let bestDomainHave = 0;
  let bestDomainNeed = 1;
  let bestRatio = -1;
  let bestNeed = 0;
  for (const [domain, need] of candidates) {
    const have = domainExplored.get(domain) ?? 0;
    const ratio = have / need;
    const better =
      substantial.length > 0
        ? ratio > bestRatio || (ratio === bestRatio && have > bestDomainHave)
        : need > bestNeed; // fallback: pick the single largest domain
    if (better) {
      bestRatio = ratio;
      bestNeed = need;
      bestDomainHave = have;
      bestDomainNeed = need;
    }
  }

  const ctx: AchievementCtx = {
    explored: explored.size,
    domains: domainsCovered.size,
    total: catalog.length,
    totalDomains,
    bestDomainHave,
    bestDomainNeed,
  };

  const achievements: AchievementStatus[] = ACHIEVEMENTS.map((a) => {
    const need = a.need(ctx);
    const have = Math.min(a.have(ctx), need);
    return {
      id: a.id,
      icon: a.icon,
      name: a.name,
      description: a.description,
      unlocked: have >= need,
      have,
      need,
    };
  });

  return {
    exploredCount: explored.size,
    total: catalog.length,
    domainsCovered: domainsCovered.size,
    totalDomains,
    achievements,
  };
}

// --- browser-only helpers (guarded so the module imports cleanly in Node) ---

/** The set of engine slugs this browser has run. */
export function getExploredEngines(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EXPLORED_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Record that an engine was run; returns true if it was newly added. */
export function recordEngineRun(slug: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getExploredEngines();
  if (current.includes(slug)) return false;
  const next = [...current, slug];
  try {
    window.localStorage.setItem(EXPLORED_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EXPLORED_EVENT, { detail: { slug } }));
  } catch {
    return false;
  }
  return true;
}
