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

interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  /** Current progress value for this achievement. */
  have: (ctx: { explored: number; domains: number; total: number; totalDomains: number }) => number;
  /** Goal value. */
  need: (ctx: { total: number; totalDomains: number }) => number;
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
  const totalDomains = new Set(catalog.map((e) => e.domain)).size;

  const ctx = {
    explored: explored.size,
    domains: domainsCovered.size,
    total: catalog.length,
    totalDomains,
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
