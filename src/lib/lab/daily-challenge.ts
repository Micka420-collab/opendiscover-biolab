/**
 * Daily deterministic challenge.
 *
 * Each calendar day the lab poses ONE puzzle — same for everyone on Earth —
 * derived purely from the `YYYY-MM-DD` string (no clock inside, no RNG, no
 * server). You tune a single parameter, run the deterministic engine, and try to
 * beat the bar; your attempt is a normal shareable `?x=` permalink so a streamer
 * can post today's best run and viewers reproduce it exactly.
 *
 * A challenge is intentionally tiny: fixed base parameters + one tunable "knob" +
 * a metric to push toward a goal. Because the engine itself is the judge (the
 * metric is read straight off its deterministic output), no answer key is stored.
 *
 * Pure module: `challengeForDate` is a total function of the date string.
 */

export interface ChallengeKnob {
  /** Which engine parameter the player tunes. */
  param: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export type ChallengeGoal = 'maximize' | 'minimize' | 'target';

export interface Challenge {
  /** Stable id (also used as the localStorage key prefix). */
  id: string;
  engine: string;
  title: string;
  /** What the player is trying to do, in one sentence. */
  brief: string;
  /** Fixed parameters merged under the tuned knob for every run. */
  baseParams: Record<string, unknown>;
  knob: ChallengeKnob;
  /** Metric key (from the engine's `SimResult.metrics`) that is scored. */
  metricKey: string;
  metricLabel: string;
  unit?: string;
  goal: ChallengeGoal;
  /** For `maximize`/`minimize`: the value that counts as "beaten". */
  par?: number;
  /** For `target`: the value to hit (within {@link TARGET_TOLERANCE}). */
  target?: number;
  hint: string;
}

/** A `target`-goal attempt counts as met within ±5% of the target. */
export const TARGET_TOLERANCE = 0.05;

/**
 * The curated pool. Every entry is validated in `daily-challenge.test.ts`, which
 * runs the real engine across the knob's range to prove the challenge is winnable
 * and the metric key exists — so a bad param/target can never ship silently.
 * Add engines here to lengthen the rotation.
 */
export const CHALLENGE_POOL: Challenge[] = [
  {
    id: 'chemostat-productivity',
    engine: 'bioreactor',
    title: 'Maximize chemostat productivity',
    brief:
      'Tune the dilution rate D of a continuous (chemostat) fermenter to squeeze out the highest steady-state biomass productivity D·X* before the culture washes out.',
    baseParams: {
      mode: 'chemostat',
      muMax: 0.9,
      ks: 0.2,
      yxs: 0.5,
      sin: 10,
      x0: 0.1,
      s0: 10,
      tEnd: 200,
    },
    knob: {
      param: 'd',
      label: 'Dilution rate D',
      min: 0.05,
      max: 0.86,
      step: 0.01,
      default: 0.3,
      unit: '1/h',
    },
    metricKey: 'productivity',
    metricLabel: 'Biomass productivity D·X*',
    unit: 'g/L/h',
    goal: 'maximize',
    par: 3.0,
    hint: 'Productivity climbs with D but collapses to zero at washout (D ≥ D_crit). The optimum sits just below the critical dilution rate.',
  },
  {
    id: 'epidemic-half',
    engine: 'compartmental',
    title: 'Land the attack rate on 50%',
    brief:
      'Tune the transmission rate β of an SIR epidemic so that the final epidemic size (the fraction of the population ever infected) comes out as close as possible to one half.',
    baseParams: {
      model: 'SIR',
      gamma: 0.1,
      population: 1_000_000,
      i0: 10,
      tMax: 200,
    },
    knob: {
      param: 'beta',
      label: 'Transmission rate β',
      min: 0.05,
      max: 0.6,
      step: 0.005,
      default: 0.2,
      unit: '1/day',
    },
    metricKey: 'finalSize',
    metricLabel: 'Final epidemic size (attack rate)',
    goal: 'target',
    target: 0.5,
    hint: 'R₀ = β/γ. Too low and the outbreak fizzles; too high and nearly everyone is infected. The sweet spot is a modest R₀ just below 1.4.',
  },
  {
    id: 'noncompetitive-half-vmax',
    engine: 'enzyme-kinetics',
    title: 'Halve the apparent Vmax',
    brief:
      'A non-competitive inhibitor lowers an enzyme’s apparent Vmax. Dial in the inhibitor concentration so the apparent Vmax drops to exactly half of the uninhibited Vmax (50 of 100).',
    baseParams: {
      vmax: 100,
      km: 10,
      mode: 'noncompetitive',
      ki: 5,
    },
    knob: {
      param: 'inhibitor',
      label: 'Inhibitor [I]',
      min: 0,
      max: 20,
      step: 0.1,
      default: 0,
      unit: 'µM',
    },
    metricKey: 'apparentVmax',
    metricLabel: 'Apparent Vmax',
    goal: 'target',
    target: 50,
    hint: 'For non-competitive inhibition apparent Vmax = Vmax / (1 + [I]/Ki). Half-max occurs when [I] equals Ki.',
  },
  {
    id: 'edge-of-chaos',
    engine: 'logistic-map',
    title: 'Balance on the edge of chaos',
    brief:
      'Tune the growth parameter r of the logistic map to sit right on the boundary between order and chaos — the razor’s edge where the Lyapunov exponent λ crosses zero.',
    baseParams: {
      x0: 0.4,
      transient: 1000,
      analysisIterations: 4000,
      rMin: 2.5,
      rMax: 4,
      rSteps: 40,
      bifSamples: 20,
    },
    knob: {
      param: 'r',
      label: 'Growth parameter r',
      min: 3.5,
      max: 3.6,
      step: 0.002,
      default: 3.5,
    },
    metricKey: 'lyapunovExponent',
    metricLabel: 'Lyapunov exponent λ',
    goal: 'target',
    target: 0,
    hint: 'Below the Feigenbaum point (~3.5699) the map is periodic and λ < 0; above it, chaotic with λ > 0. The edge of chaos is exactly where λ = 0.',
  },
  {
    id: 'firefly-sync',
    engine: 'kuramoto',
    title: 'Make the fireflies sync',
    brief:
      'Raise the coupling strength K between a swarm of oscillators until they lock into a common rhythm — push the steady-state coherence ⟨r⟩ as high as you can.',
    baseParams: {
      oscillators: 40,
      freqSpread: 1,
      tEnd: 30,
      steps: 800,
      outputPoints: 100,
      seed: 'firefly-daily',
    },
    knob: { param: 'coupling', label: 'Coupling K', min: 0, max: 8, step: 0.25, default: 0 },
    metricKey: 'meanOrderParameter',
    metricLabel: 'Steady-state coherence ⟨r⟩',
    goal: 'maximize',
    par: 0.8,
    hint: 'Below the critical coupling Kc ≈ 1.6·σ nothing happens; above it, coherence climbs toward 1. Crank K well past Kc.',
  },
  {
    id: 'sis-endemic-half',
    engine: 'sis',
    title: 'Set the endemic level to half',
    brief:
      'Adjust the transmission rate β of an SIS infection (no immunity — recovered become susceptible again) so its persistent endemic prevalence settles at exactly half the population.',
    baseParams: { gamma: 0.1, i0: 0.01, tEnd: 200 },
    knob: {
      param: 'beta',
      label: 'Transmission rate β',
      min: 0.05,
      max: 0.4,
      step: 0.005,
      default: 0.15,
      unit: '1/day',
    },
    metricKey: 'endemicPrevalence',
    metricLabel: 'Endemic prevalence i*',
    goal: 'target',
    target: 0.5,
    hint: 'Endemic prevalence i* = 1 − 1/R₀ with R₀ = β/γ. Half the population endemic means R₀ = 2, i.e. β = 2γ.',
  },
  {
    id: 'endemic-sir-target',
    engine: 'sir-endemic',
    title: 'Dial in a 5% endemic level',
    brief:
      'Tune the transmission rate β of an endemic SIR disease (with births and deaths, so it recurs like measles) so its long-run steady-state prevalence i* settles at 5% of the population.',
    baseParams: { gamma: 0.1, mu: 0.01, i0: 0.001, tEnd: 20 },
    knob: {
      param: 'beta',
      label: 'Transmission rate β',
      min: 0.15,
      max: 1,
      step: 0.005,
      default: 0.3,
      unit: '1/day',
    },
    metricKey: 'endemicPrevalence',
    metricLabel: 'Endemic prevalence i*',
    goal: 'target',
    target: 0.05,
    hint: 'i* = μ(R₀−1)/β with R₀ = β/(γ+μ). It climbs with β toward a ceiling of μ/(γ+μ) ≈ 0.09; aim for a modest R₀ around 2.2.',
  },
  {
    id: 'levins-tipping-point',
    engine: 'levins-metapopulation',
    title: 'Bulldoze to the brink',
    brief:
      'A species lives across a network of habitat patches. Clear as much habitat as you dare — push the equilibrium patch occupancy p* down to a razor-thin 5%, as close to regional collapse as you can get without tipping the whole metapopulation over the extinction cliff.',
    baseParams: { colonization: 0.5, extinction: 0.1, p0: 0.5, tEnd: 120 },
    knob: {
      param: 'destroyed',
      label: 'Habitat destroyed',
      min: 0,
      max: 0.79,
      step: 0.005,
      default: 0,
      unit: 'fraction',
    },
    metricKey: 'equilibriumOccupancy',
    metricLabel: 'Equilibrium occupancy p*',
    goal: 'target',
    target: 0.05,
    hint: 'p* = (1 − destroyed) − e/c. With c=0.5 and e=0.1 the extinction threshold sits at 80% destroyed; p*=0.05 lands at exactly 75%.',
  },
  {
    id: 'replicator-hawk-dove',
    engine: 'replicator-dynamics',
    title: 'Tune the Hawk–Dove balance',
    brief:
      'In a Hawk–Dove game, aggressive hawks and peaceful doves settle into a stable mix set by the payoffs. Raise the prize a hawk seizes from a dove until the evolutionarily stable population lands at exactly 60% hawks.',
    baseParams: { aa: -1, ba: 0, bb: 1, x0: 0.3, tEnd: 80 },
    knob: {
      param: 'ab',
      label: 'Hawk’s prize (Hawk vs Dove payoff)',
      min: 1.2,
      max: 6,
      step: 0.05,
      default: 2,
    },
    metricKey: 'essFractionA',
    metricLabel: 'Stable fraction of hawks',
    goal: 'target',
    target: 0.6,
    hint: 'With these payoffs the stable hawk share is x* = 1 − 1/ab. For 60% hawks you need ab = 2.5.',
  },
  {
    id: 'wilson-cowan-brain-rhythm',
    engine: 'wilson-cowan',
    title: 'Crank up the brain rhythm',
    brief:
      'Two coupled neural populations (excitatory + inhibitory) only fall into a rhythm for a narrow band of external drive. Tune the drive P to make the excitatory oscillation swing as wide as possible — without pushing the network so hard it saturates and falls silent.',
    baseParams: {
      cEE: 16,
      cEI: 12,
      cIE: 15,
      cII: 3,
      Q: 0,
      aE: 1.3,
      thetaE: 4,
      aI: 2,
      thetaI: 3.7,
      tauE: 1,
      tauI: 1,
      E0: 0.1,
      I0: 0.1,
      tEnd: 120,
    },
    knob: { param: 'P', label: 'External drive P', min: 0.8, max: 3.4, step: 0.05, default: 1 },
    metricKey: 'amplitudeE',
    metricLabel: 'Excitatory oscillation amplitude',
    goal: 'maximize',
    par: 0.6,
    hint: 'Below P≈1.2 the network is silent; above P≈3.2 it saturates and goes quiet again. The widest swing sits just under that upper edge, around P≈3.',
  },
  {
    id: 'pk-terminal-half-life',
    engine: 'pk-two-compartment',
    title: 'Design an 8-hour half-life',
    brief:
      'A drug hides in tissue: the larger the peripheral reservoir it distributes into, the longer it lingers before being cleared. Adjust the tissue volume V2 so the terminal half-life lands at 8 hours.',
    baseParams: { dose: 100, v1: 10, cl: 5, q: 10, tEnd: 48 },
    knob: {
      param: 'v2',
      label: 'Peripheral (tissue) volume V2',
      min: 10,
      max: 60,
      step: 0.5,
      default: 20,
      unit: 'L',
    },
    metricKey: 'terminalHalfLife',
    metricLabel: 'Terminal half-life t½β',
    unit: 'h',
    goal: 'target',
    target: 8,
    hint: 'A bigger tissue reservoir (V2) makes the drug linger longer, lengthening the terminal half-life. It reaches 8 h at about V2 = 34 L.',
  },
  {
    id: 'folding-max-stability',
    engine: 'two-state-folding',
    title: 'Engineer a protein stable at room temperature',
    brief:
      'A protein is most folded at 25°C not when its melting temperature is highest, but when its stability maximum sits right at 25°C. Tune the melting temperature Tm to maximise the fraction folded at 25°C — push it too high and cold denaturation creeps in; too low and it starts to melt.',
    baseParams: { deltaHm: 250, deltaCp: 8, tMinCelsius: -20, tMaxCelsius: 100 },
    knob: {
      param: 'tmCelsius',
      label: 'Melting temperature Tm',
      min: 30,
      max: 90,
      step: 0.5,
      default: 40,
      unit: '°C',
    },
    metricKey: 'fractionFolded25',
    metricLabel: 'Fraction folded at 25°C',
    goal: 'maximize',
    par: 0.985,
    hint: 'Fraction folded at 25°C peaks when the stability maximum T_maxstab lands on 25°C — near Tm ≈ 55°C for these ΔHm/ΔCp. Both a lower and a higher Tm reduce it.',
  },
];

/** 32-bit FNV-1a hash of a string — deterministic, no dependencies. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The challenge for a given ISO date. Only the `YYYY-MM-DD` prefix is used, so any
 * timestamp on the same UTC day maps to the same challenge on every machine.
 */
export function challengeForDate(dateISO: string): Challenge {
  const day = dateISO.slice(0, 10);
  const idx = fnv1a(day) % CHALLENGE_POOL.length;
  return CHALLENGE_POOL[idx] as Challenge;
}

/** Merge a knob value into the challenge's base params to get run parameters. */
export function challengeParams(c: Challenge, knobValue: number): Record<string, unknown> {
  return { ...c.baseParams, [c.knob.param]: knobValue };
}

/**
 * A single "higher is always better" score so the UI and a local best-list can
 * rank attempts uniformly regardless of the goal direction.
 */
export function challengeScore(c: Challenge, value: number): number {
  if (c.goal === 'maximize') return value;
  if (c.goal === 'minimize') return -value;
  const t = c.target ?? 0;
  const denom = Math.abs(t) > 1e-9 ? Math.abs(t) : 1;
  return 1 - Math.abs(value - t) / denom;
}

/** Does `value` clear the challenge bar (beaten / target hit within tolerance)? */
export function meetsBar(c: Challenge, value: number): boolean {
  if (c.goal === 'target') {
    const t = c.target ?? 0;
    const denom = Math.abs(t) > 1e-9 ? Math.abs(t) : 1;
    return Math.abs(value - t) / denom <= TARGET_TOLERANCE;
  }
  if (c.par == null) return false;
  return c.goal === 'maximize' ? value >= c.par : value <= c.par;
}
