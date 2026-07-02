/**
 * The living Earth AURORA lights, one beacon per pooled technique.
 *
 * Each challenge id maps to a real place on the globe and the real-world reason the
 * technique matters ("why Earth needs it"). Confirming a specimen ignites its aurora
 * band; the AURORA index is simply lit/total over CHALLENGE_POOL — an honest,
 * serverless, auto-growing goal. The collective layer is a `?lit=` base36 bitmask
 * relay: a shared link pre-illuminates the recipient's Earth cosmetically, but every
 * band is only ever truly lit by a live `meetsBar` pass.
 *
 * Pure and deterministic; no DOM, safe in Node and the browser.
 */

import { CHALLENGE_POOL } from '@/lib/lab/daily-challenge';

export interface PlanetSpot {
  lat: number;
  lon: number;
  region: string;
  /** One line a cold viewer can read: why this technique helps the Earth. */
  whyEarthNeedsIt: string;
  /** Hue for the beacon + aurora band, so the globe reads colourfully. */
  hue: number;
}

/** Curated beacons for the current pool. Unknown ids fall back deterministically. */
const CURATED: Record<string, PlanetSpot> = {
  'chemostat-productivity': {
    lat: 64.1,
    lon: -21.9,
    region: 'Reykjavík',
    whyEarthNeedsIt: 'Continuous fermenters brew fuel, food and medicine without ever stopping.',
    hue: 142,
  },
  'epidemic-half': {
    lat: 46.2,
    lon: 6.1,
    region: 'Geneva',
    whyEarthNeedsIt: 'Reading an outbreak’s final size tells public health how hard to push back.',
    hue: 0,
  },
  'noncompetitive-half-vmax': {
    lat: 47.6,
    lon: 7.6,
    region: 'Basel',
    whyEarthNeedsIt: 'Tuning how an inhibitor throttles an enzyme is how most drugs are dosed.',
    hue: 275,
  },
  'edge-of-chaos': {
    lat: -3.5,
    lon: -62.2,
    region: 'Amazonia',
    whyEarthNeedsIt:
      'The line between stable and chaotic populations decides which species persist.',
    hue: 110,
  },
  'firefly-sync': {
    lat: 3.3,
    lon: 101.3,
    region: 'Selangor',
    whyEarthNeedsIt:
      'Spontaneous synchrony — fireflies, heart cells, power grids — from simple coupling.',
    hue: 55,
  },
  'sis-endemic-half': {
    lat: 28.6,
    lon: 77.2,
    region: 'Delhi',
    whyEarthNeedsIt:
      'Diseases with no immunity settle at a level we can only hold down, not erase.',
    hue: 12,
  },
  'endemic-sir-target': {
    lat: -1.3,
    lon: 36.8,
    region: 'Nairobi',
    whyEarthNeedsIt:
      'Births refill the susceptible pool, so measles-like diseases keep coming back.',
    hue: 25,
  },
  'levins-tipping-point': {
    lat: 0.9,
    lon: 114.0,
    region: 'Borneo',
    whyEarthNeedsIt:
      'Clear too many habitat patches and a whole metapopulation tips into collapse.',
    hue: 130,
  },
  'replicator-hawk-dove': {
    lat: -2.3,
    lon: 34.8,
    region: 'Serengeti',
    whyEarthNeedsIt:
      'Payoffs, not preachers, set the stable mix of aggression and peace in a population.',
    hue: 45,
  },
  'wilson-cowan-brain-rhythm': {
    lat: 42.4,
    lon: -71.1,
    region: 'Boston',
    whyEarthNeedsIt:
      'Excitation and inhibition in balance are what let a brain oscillate instead of seize.',
    hue: 290,
  },
  'pk-terminal-half-life': {
    lat: 51.5,
    lon: -0.1,
    region: 'London',
    whyEarthNeedsIt: 'How long a drug lingers in tissue sets how often a patient must take it.',
    hue: 200,
  },
  'folding-max-stability': {
    lat: 37.4,
    lon: -122.1,
    region: 'Stanford',
    whyEarthNeedsIt:
      'A protein engineered to stay folded at room temperature ships without a cold chain.',
    hue: 260,
  },
  'reed-frost-vaccinate': {
    lat: 40.4,
    lon: -3.7,
    region: 'Madrid',
    whyEarthNeedsIt: 'Vaccinate just past the herd-immunity threshold and an outbreak collapses.',
    hue: 160,
  },
  'wlc-stretch-dna': {
    lat: 52.2,
    lon: 0.1,
    region: 'Cambridge',
    whyEarthNeedsIt:
      'Pulling a single DNA molecule reveals the mechanics that pack a genome into a cell.',
    hue: 210,
  },
  'oxygen-transfer-aerate': {
    lat: 52.4,
    lon: 4.9,
    region: 'Amsterdam',
    whyEarthNeedsIt:
      'Getting oxygen into the tank is what lets microbes clean a city’s wastewater.',
    hue: 190,
  },
  'beer-lambert-linear-range': {
    lat: -15.6,
    lon: -56.1,
    region: 'Pantanal',
    whyEarthNeedsIt:
      'A calibrated absorbance reading is how we measure a pollutant in river water.',
    hue: 175,
  },
  'buffer-blood-ph': {
    lat: 48.9,
    lon: 2.4,
    region: 'Paris',
    whyEarthNeedsIt: 'A buffer poised at pH 7.4 is what holds your bloodstream safe every second.',
    hue: 340,
  },
  'primer-melting-temp': {
    lat: 1.35,
    lon: 103.8,
    region: 'Singapore',
    whyEarthNeedsIt:
      'A primer that melts at the right temperature makes a diagnostic PCR actually work.',
    hue: 220,
  },
  'haldane-sweet-spot': {
    lat: 55.75,
    lon: 37.6,
    region: 'Volga basin',
    whyEarthNeedsIt:
      'On a substrate that turns toxic, microbes clean fastest at a "just right" dose.',
    hue: 90,
  },
  'reach-herd-immunity': {
    lat: 6.5,
    lon: 3.4,
    region: 'Lagos',
    whyEarthNeedsIt:
      'Cross the coverage threshold and each case infects fewer than one — the outbreak dies.',
    hue: 150,
  },
  'fret-measure-distance': {
    lat: 49.0,
    lon: 8.4,
    region: 'Karlsruhe',
    whyEarthNeedsIt:
      'FRET is a nanometre ruler that watches two molecules meet inside a living cell.',
    hue: 300,
  },
  'size-a-nanoparticle': {
    lat: 35.7,
    lon: 139.7,
    region: 'Tokyo',
    whyEarthNeedsIt:
      'Sizing a nanoparticle from its jiggle is how we quality-check a drug carrier.',
    hue: 240,
  },
  'isotonic-iv-drip': {
    lat: 19.4,
    lon: -99.1,
    region: 'Mexico City',
    whyEarthNeedsIt: 'An isotonic drip is the only saline safe to run straight into a vein.',
    hue: 340,
  },
  'van-deemter-optimal-flow': {
    lat: 50.1,
    lon: 8.7,
    region: 'Frankfurt',
    whyEarthNeedsIt:
      'The right column flow gives the sharp peaks that purify a vaccine or read a blood panel.',
    hue: 185,
  },
  'right-shift-oxygen-delivery': {
    lat: -13.5,
    lon: -71.9,
    region: 'Andes',
    whyEarthNeedsIt:
      'Shifting hemoglobin’s curve is how blood hands more oxygen to hard-working muscle.',
    hue: 355,
  },
  'poise-a-reaction': {
    lat: 51.4,
    lon: 6.9,
    region: 'Ruhr',
    whyEarthNeedsIt:
      'Balancing free energy is the thermodynamics behind the fertilizer that feeds billions.',
    hue: 100,
  },
};

/** 32-bit FNV-1a for the deterministic fallback placement. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A beacon for any challenge id — curated, or a deterministic fallback so the pool can grow safely. */
export function planetFor(id: string): PlanetSpot {
  const curated = CURATED[id];
  if (curated) return curated;
  const h = fnv1a(id);
  return {
    lat: ((h % 1500) / 1500) * 140 - 70,
    lon: (((h >>> 8) % 3600) / 3600) * 360 - 180,
    region: 'Uncharted',
    whyEarthNeedsIt: 'A deterministic technique waiting to be confirmed.',
    hue: (h >>> 4) % 360,
  };
}

/** Total beacons = every technique in the pool (auto-grows, never hardcoded). */
export const TOTAL_BEACONS = CHALLENGE_POOL.length;

/** The AURORA index: fraction of the pool confirmed. */
export function auroraIndex(litCount: number): number {
  if (TOTAL_BEACONS === 0) return 0;
  return Math.max(0, Math.min(1, litCount / TOTAL_BEACONS));
}

export interface Milestone {
  at: number;
  label: string;
}

export const MILESTONES: Milestone[] = [
  { at: 0.2, label: 'First light' },
  { at: 0.4, label: 'Dawn breaks' },
  { at: 0.6, label: 'Half the Earth aglow' },
  { at: 0.8, label: 'Continents alight' },
  { at: 1.0, label: 'Planetary dawn' },
];

/** The next milestone above the current index (or null once fully lit). */
export function nextMilestone(index: number): Milestone | null {
  for (const m of MILESTONES) if (index < m.at) return m;
  return null;
}

// --- ?lit= relay: a compact base36 bitmask over the pool's index order ----------

const BIT = new Map<string, number>(CHALLENGE_POOL.map((c, i) => [c.id, i]));

/** Pack a set of cleared challenge ids into a base36 bitmask token. */
export function encodeLit(ids: Iterable<string>): string {
  let mask = 0n;
  for (const id of ids) {
    const b = BIT.get(id);
    if (b !== undefined) mask |= 1n << BigInt(b);
  }
  return mask.toString(36);
}

function parseBase36(token: string): bigint {
  let m = 0n;
  for (const ch of token.toLowerCase()) {
    const d = Number.parseInt(ch, 36);
    if (Number.isNaN(d)) continue;
    m = m * 36n + BigInt(d);
  }
  return m;
}

/** Decode a base36 bitmask token back into the set of challenge ids it lit. */
export function decodeLit(token: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!token) return out;
  const mask = parseBase36(token);
  for (const [id, b] of BIT) {
    if ((mask >> BigInt(b)) & 1n) out.add(id);
  }
  return out;
}
