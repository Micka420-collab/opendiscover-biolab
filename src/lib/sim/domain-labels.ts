/**
 * Human-facing, emoji-prefixed labels for engine domains — the single source of
 * truth shared by the Lab catalog, the gallery, and (mirrored) the generated docs,
 * so a domain's label can never drift between surfaces.
 */
export const DOMAIN_LABELS: Record<string, string> = {
  'molecular-biology': '🧫 Molecular biology',
  protein: '🧬 Protein biophysics',
  'systems-biology': '⚙️ Systems biology',
  'population-genetics': '🌱 Population genetics',
  bioprocess: '🏭 Bioprocess',
  epidemiology: '🦠 Epidemiology',
  'drug-discovery': '💊 Drug discovery',
  structural: '🔬 Structural',
  neuroscience: '🧠 Neuroscience',
  ecology: '🐺 Ecology',
  biochemistry: '🧪 Biochemistry',
};

/** Title-case a kebab/space domain key: 'quantum-biology' → 'Quantum Biology'. */
function titleCase(domain: string): string {
  return domain
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Display label for a domain. Falls back to a title-cased version of the raw key
 * (never blank) so a newly-added domain still renders sensibly before it gets a
 * curated emoji label here.
 */
export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? titleCase(domain);
}
