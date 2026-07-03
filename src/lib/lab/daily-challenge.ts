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
  {
    id: 'reed-frost-vaccinate',
    engine: 'reed-frost',
    title: 'Vaccinate to the tipping point',
    brief:
      'An R₀=3 pathogen is about to sweep a town of 100,000. Vaccinate just enough people to hold the final outbreak to 5% of the population — cross the herd-immunity threshold and it collapses entirely, but you want to stop it right at the edge, not waste doses.',
    baseParams: { population: 100000, r0: 3, initialInfectives: 1, maxGenerations: 200 },
    knob: {
      param: 'initialImmune',
      label: 'People vaccinated',
      min: 0,
      max: 80000,
      step: 100,
      default: 30000,
      unit: 'people',
    },
    metricKey: 'attackRate',
    metricLabel: 'Attack rate (fraction infected)',
    goal: 'target',
    target: 0.05,
    hint: 'Herd immunity for R₀=3 needs 1−1/R₀ = 66.7% coverage. The attack rate falls steeply just below that — vaccinate about 64,000 of the 100,000 to hold it at 5%.',
  },
  {
    id: 'wlc-stretch-dna',
    engine: 'worm-like-chain',
    title: 'Stretch DNA to 10 piconewtons',
    brief:
      'Pull on a DNA molecule in an optical trap. As you stretch it toward its full contour length the entropic force diverges. Dial the extension in so the force at full stretch reads exactly 10 pN — just into the steep stiffening regime.',
    baseParams: { persistenceLength: 50, contourLength: 1000, temperatureCelsius: 25 },
    knob: {
      param: 'maxFraction',
      label: 'Fractional extension x = z/L',
      min: 0.5,
      max: 0.99,
      step: 0.001,
      default: 0.8,
    },
    metricKey: 'forceAtMaxExtension',
    metricLabel: 'Force at full stretch',
    unit: 'pN',
    goal: 'target',
    target: 10,
    hint: 'Force blows up as x → 1 via the 1/(1−x)² term. For Lp=50 nm it reaches ~10 pN at about 95.4% extension.',
  },
  {
    id: 'oxygen-transfer-aerate',
    engine: 'oxygen-transfer',
    title: 'Aerate the fermenter',
    brief:
      'Your cells are burning oxygen at 400 mg/L/h and the tank saturates at only 8 mg/L. Turn up the agitation/aeration — the mass-transfer coefficient kLa — until the steady-state dissolved O₂ settles at 4 mg/L (50% of saturation), the usual comfortable set-point.',
    baseParams: { saturationDO: 8, our: 400, criticalDO: 1, initialDO: 8 },
    knob: {
      param: 'kLa',
      label: 'Mass-transfer coefficient kLa',
      min: 60,
      max: 300,
      step: 1,
      default: 150,
      unit: '1/h',
    },
    metricKey: 'steadyStateDO',
    metricLabel: 'Steady-state dissolved O₂',
    unit: 'mg/L',
    goal: 'target',
    target: 4,
    hint: 'Steady-state DO = C* − OUR/kLa, with diminishing returns as you crank kLa. For C*=8 and OUR=400, hitting 4 mg/L needs kLa = 400/(8−4) = 100 /h.',
  },
  {
    id: 'beer-lambert-linear-range',
    engine: 'beer-lambert',
    title: 'Stay in the linear range',
    brief:
      'A spectrophotometer only obeys Beer’s law while the absorbance stays around 1 or below — push higher and stray light and detector saturation wreck the reading. Dilute your dye (set its concentration) so the peak absorbance lands at 0.8: strong signal, still bang in the linear range.',
    baseParams: {
      conc2: 0,
      eMax1: 0.02,
      peak1: 500,
      width1: 30,
      pathLength: 1,
      lambdaMin: 400,
      lambdaMax: 600,
    },
    knob: {
      param: 'conc1',
      label: 'Dye concentration',
      min: 5,
      max: 80,
      step: 0.5,
      default: 20,
    },
    metricKey: 'peakAbsorbance',
    metricLabel: 'Peak absorbance',
    goal: 'target',
    target: 0.8,
    hint: 'Beer’s law: A = ε·c·l. With ε=0.02 and l=1 cm, a peak absorbance of 0.8 needs a concentration of about 40.',
  },
  {
    id: 'buffer-blood-ph',
    engine: 'acid-base-titration',
    title: 'Design a buffer for blood pH',
    brief:
      'A buffer resists pH change best exactly at its pKa — the flat plateau at half-equivalence. Choose a weak acid (dial its pKa) so its buffer plateau sits at physiological pH 7.4, the value your bloodstream is held at.',
    baseParams: { acidConc: 0.1, acidVolume: 25, baseConc: 0.1 },
    knob: { param: 'pKa', label: 'Acid pKa', min: 3, max: 10, step: 0.05, default: 5 },
    metricKey: 'phAtHalfEquivalence',
    metricLabel: 'pH at half-equivalence',
    goal: 'target',
    target: 7.4,
    hint: 'A buffer works best at its pKa, and the half-equivalence pH ≈ pKa. So pick a weak acid with pKa ≈ 7.4 — like phosphate’s second pKa (7.2), the real blood buffer.',
  },
  {
    id: 'primer-melting-temp',
    engine: 'dna-melting',
    title: 'Tune a primer to melt at 60°C',
    brief:
      'A good PCR primer melts right around 60°C — hot enough to bind specifically, cool enough to work. Dial the duplex’s binding enthalpy ΔH° so its melting temperature Tm lands on the 60°C sweet spot. Stronger binding (more negative ΔH°) melts higher.',
    baseParams: { deltaS: -1, strandConc: 1e-5, selfComplementary: false },
    knob: {
      param: 'deltaH',
      label: 'Binding enthalpy ΔH° (kJ/mol)',
      min: -600,
      max: -150,
      step: 1,
      default: -250,
    },
    metricKey: 'meltingTemp',
    metricLabel: 'Melting temperature Tm',
    goal: 'target',
    target: 60,
    hint: 'Tm = ΔH° / (ΔS° + R·ln(C_T/4)). With ΔS°=−1 and C_T=1e−5 the denominator is ≈ −1.107, so Tm(°C) ≈ −ΔH°/1.107 − 273.15. Target 60°C ⇒ ΔH° ≈ −369 kJ/mol.',
  },
  {
    id: 'haldane-sweet-spot',
    engine: 'substrate-inhibition',
    title: 'Find the substrate sweet spot',
    brief:
      'On a substrate that turns toxic at high dose, growth peaks at a “just right” concentration S_opt = √(Ks·Ki). Dial the inhibition constant Ki so that this optimum lands at 15 g/L — too tolerant and the peak drifts high, too sensitive and it collapses toward zero.',
    baseParams: { muMax: 0.8, ks: 1 },
    knob: {
      param: 'ki',
      label: 'Inhibition constant Ki',
      min: 50,
      max: 500,
      step: 5,
      default: 100,
      unit: 'g/L',
    },
    metricKey: 'optimalSubstrate',
    metricLabel: 'Optimal substrate S_opt',
    unit: 'g/L',
    goal: 'target',
    target: 15,
    hint: 'S_opt = √(Ks·Ki). With Ks = 1 that is just √Ki, so a peak at 15 g/L needs Ki ≈ 225.',
  },
  {
    id: 'reach-herd-immunity',
    engine: 'vaccination',
    title: 'Reach herd immunity',
    brief:
      'An outbreak stops growing the moment each case infects fewer than one other person — when the effective reproduction number R_eff = R₀·(1 − εv) hits 1. Dial the vaccination coverage until you land exactly on that herd-immunity threshold.',
    baseParams: { r0: 4, efficacy: 0.9 },
    knob: {
      param: 'coverage',
      label: 'Vaccination coverage',
      min: 0,
      max: 1,
      step: 0.005,
      default: 0.3,
    },
    metricKey: 'effectiveR',
    metricLabel: 'Effective reproduction R_eff',
    goal: 'target',
    target: 1,
    hint: 'R_eff = R₀·(1 − εv). With R₀ = 4 and ε = 0.9 you need 1 − 0.9v = 1/4, i.e. coverage v ≈ 0.83 (the critical coverage v_c = (1 − 1/R₀)/ε).',
  },
  {
    id: 'fret-measure-distance',
    engine: 'fret',
    title: 'Read a molecular ruler',
    brief:
      'FRET efficiency reads exactly 50% when the two fluorophores sit one Förster radius apart. With R₀ = 5 nm, tune the donor–acceptor distance until the transfer efficiency lands on 50% — and you have just measured a 5-nanometre ruler.',
    baseParams: { forsterRadius: 5 },
    knob: {
      param: 'distance',
      label: 'Donor–acceptor distance',
      min: 1,
      max: 15,
      step: 0.05,
      default: 9,
      unit: 'nm',
    },
    metricKey: 'efficiency',
    metricLabel: 'Transfer efficiency E',
    goal: 'target',
    target: 0.5,
    hint: 'E = 1/(1 + (r/R₀)⁶) equals 0.5 exactly when r = R₀. So dial the distance to 5 nm.',
  },
  {
    id: 'size-a-nanoparticle',
    engine: 'diffusion',
    title: 'Size a nanoparticle',
    brief:
      'Dynamic light scattering watches how fast a particle jiggles and turns that diffusion coefficient into a size. Work it backwards: dial the hydrodynamic radius until the diffusion coefficient matches a measured 10 µm²/s — and you have sized the particle.',
    baseParams: { viscosity: 1, temperatureC: 20 },
    knob: {
      param: 'radius',
      label: 'Hydrodynamic radius',
      min: 1,
      max: 100,
      step: 0.5,
      default: 5,
      unit: 'nm',
    },
    metricKey: 'diffusionCoefficient',
    metricLabel: 'Diffusion coefficient D',
    unit: 'µm²/s',
    goal: 'target',
    target: 10,
    hint: 'D = kB·T/(6πηr) falls as 1/r. A measured D of 10 µm²/s in water at 20°C means a radius of about 21.5 nm.',
  },
  {
    id: 'isotonic-iv-drip',
    engine: 'osmotic-pressure',
    title: 'Mix a safe IV drip',
    brief:
      'An intravenous drip must match the osmolarity of blood, or the red cells it meets burst or shrivel. Dial the salt concentration of a saline drip until its tonicity ratio against blood plasma reads exactly 1.00 — isotonic, the only safe drip to run into a vein.',
    baseParams: { vantHoffFactor: 2, temperatureC: 37, referenceOsmolarity: 0.3 },
    knob: {
      param: 'molarity',
      label: 'Salt concentration',
      min: 0.05,
      max: 0.3,
      step: 0.005,
      default: 0.1,
      unit: 'mol/L',
    },
    metricKey: 'tonicityRatio',
    metricLabel: 'Tonicity ratio vs blood',
    goal: 'target',
    target: 1,
    hint: 'Tonicity ratio = i·M / reference. With table salt (i = 2, two ions per unit) against blood’s 0.30 Osm/L, you need M = 0.15 mol/L — exactly physiological (“normal”) saline, 0.9% w/v.',
  },
  {
    id: 'van-deemter-optimal-flow',
    engine: 'van-deemter',
    title: 'Find the chromatography sweet spot',
    brief:
      'Run a separation column too slow and diffusion smears the peaks; too fast and mass transfer does. Tune the mobile-phase velocity to the sweet spot that makes the peaks as sharp as physically possible — push the efficiency versus the optimum up to its ceiling of 1.0.',
    baseParams: { aTerm: 0.5, bTerm: 2, cTerm: 0.05, columnLength: 100 },
    knob: {
      param: 'velocity',
      label: 'Mobile-phase velocity u',
      min: 1,
      max: 12,
      step: 0.1,
      default: 2,
      unit: 'mm/s',
    },
    metricKey: 'efficiencyVsOptimum',
    metricLabel: 'Efficiency vs optimum',
    goal: 'maximize',
    par: 0.99,
    hint: 'Plate height H = A + B/u + C·u is lowest (efficiency = 1.0) at u_opt = √(B/C). With B = 2 and C = 0.05 that is √40 ≈ 6.3 mm/s.',
  },
  {
    id: 'right-shift-oxygen-delivery',
    engine: 'oxygen-hemoglobin',
    title: 'Right-shift for more oxygen',
    brief:
      'Hard-working muscle is warm and acidic, which right-shifts hemoglobin (raises its P₅₀) so it dumps more oxygen exactly where it is needed. Tune the half-saturation pressure P₅₀ to unload the largest possible fraction of oxygen between the lungs (100 mmHg) and the tissues (40 mmHg).',
    baseParams: { hillCoefficient: 2.7, arterialPO2: 100, venousPO2: 40 },
    knob: {
      param: 'p50',
      label: 'Half-saturation P₅₀',
      min: 20,
      max: 90,
      step: 0.5,
      default: 26,
      unit: 'mmHg',
    },
    metricKey: 'oxygenDelivered',
    metricLabel: 'O₂ unloaded to tissues',
    goal: 'maximize',
    par: 0.5,
    hint: 'Both lung and tissue saturation fall as P₅₀ rises, but tissue saturation falls faster at first — so delivery peaks at an intermediate P₅₀ around 60–65 mmHg before dropping off again.',
  },
  {
    id: 'poise-a-reaction',
    engine: 'gibbs-equilibrium',
    title: 'Poise a reaction for the cell',
    brief:
      'Metabolism runs on reactions that are favourable but not runaway. Tune the reaction entropy ΔS° so that at body temperature (37°C) the standard free energy ΔG° lands at −20 kJ/mol — downhill enough to proceed, gentle enough for the cell to control.',
    baseParams: { deltaH: -40, temperatureC: 37, reactionQuotient: 1 },
    knob: {
      param: 'deltaS',
      label: 'Reaction entropy ΔS°',
      min: -300,
      max: 0,
      step: 1,
      default: -100,
      unit: 'J/mol/K',
    },
    metricKey: 'deltaG0',
    metricLabel: 'Standard free energy ΔG°',
    unit: 'kJ/mol',
    goal: 'target',
    target: -20,
    hint: 'ΔG° = ΔH° − T·ΔS°. With ΔH° = −40 kJ/mol at 310 K, ΔG° = −20 needs T·ΔS° = −20 kJ/mol, i.e. ΔS° ≈ −64 J/mol/K.',
  },
  {
    id: 'design-high-affinity-binder',
    engine: 'saturation-binding',
    title: 'Design a high-affinity binder',
    brief:
      'A tighter-gripping drug works at a lower, safer dose. Tune the dissociation constant Kd of your candidate so that at a fixed 10 nM dose it fills 90% of its target receptors — grippy enough to work, without going overboard.',
    baseParams: { bmax: 100, ligand: 10 },
    knob: {
      param: 'kd',
      label: 'Dissociation constant Kd',
      min: 0.1,
      max: 20,
      step: 0.1,
      default: 5,
      unit: 'nM',
    },
    metricKey: 'occupancy',
    metricLabel: 'Fractional occupancy',
    goal: 'target',
    target: 0.9,
    hint: 'Occupancy = [L]/(Kd+[L]). At [L]=10 nM, reaching 90% filled needs a small Kd — about 1.1 nM. Smaller Kd = tighter binding = more filled at the same dose.',
  },
  {
    id: 'time-a-fermentation',
    engine: 'microbial-growth',
    title: 'Time a fermentation',
    brief:
      'Your batch of microbes has to be ready on schedule. Tune how fast they multiply so the culture reaches 90% of its carrying capacity in exactly 24 hours — not so slow it misses the deadline, not so fast it overshoots the best harvest window.',
    baseParams: { carryingCapacity: 2, initialPop: 0.01, tEnd: 48 },
    knob: {
      param: 'growthRate',
      label: 'Growth rate r',
      min: 0.1,
      max: 2,
      step: 0.01,
      default: 0.4,
      unit: '1/h',
    },
    metricKey: 'timeTo90Pct',
    metricLabel: 'Time to 90% of capacity',
    unit: 'h',
    goal: 'target',
    target: 24,
    hint: 'Time to 90% = ln(9·(K−P₀)/P₀) / r, so a faster growth rate reaches the plateau sooner. With this seed and capacity, hitting 90% at 24 h needs r ≈ 0.31 /h.',
  },
  {
    id: 'dim-the-glow',
    engine: 'stern-volmer',
    title: 'Dim the glow by half',
    brief:
      'A fluorescent molecule is glowing, and a quencher dims it by colliding with it. Dial in how much quencher you add so the glow drops to exactly half its brightness — the half-quenched point that reads out how accessible the fluorophore is.',
    baseParams: { ksv: 10, f0: 100 },
    knob: {
      param: 'quencher',
      label: 'Quencher [Q]',
      min: 0.01,
      max: 0.5,
      step: 0.005,
      default: 0.3,
      unit: 'mM',
    },
    metricKey: 'quenchingEfficiency',
    metricLabel: 'Quenching efficiency',
    goal: 'target',
    target: 0.5,
    hint: 'Efficiency = Ksv·[Q]/(1+Ksv·[Q]) hits 50% when Ksv·[Q]=1, i.e. [Q]=1/Ksv. With Ksv=10/mM that is [Q]=0.1 mM.',
  },
  {
    id: 'carbon-date-a-bone',
    engine: 'radioactive-decay',
    title: 'Carbon-date a bone',
    brief:
      'An old bone has a quarter of its carbon-14 left. Since carbon-14 fades at a known, steady pace, that leftover fraction is a clock. Slide the sample’s age until the fraction remaining matches the measured 25% — and you have dated it.',
    baseParams: { halfLife: 5730, initialAmount: 100 },
    knob: {
      param: 'time',
      label: 'Sample age',
      min: 0,
      max: 25000,
      step: 100,
      default: 5000,
      unit: 'years',
    },
    metricKey: 'fractionRemaining',
    metricLabel: 'Fraction of carbon-14 remaining',
    goal: 'target',
    target: 0.25,
    hint: 'Each 5730-year half-life halves the carbon-14 left. A quarter remaining is two halvings, so about 11,460 years.',
  },
  {
    id: 'enzyme-for-60c',
    engine: 'enzyme-thermal',
    title: 'Engineer an enzyme for 60°C',
    brief:
      'A hot industrial process runs at 60°C. Tune how much heat your enzyme can take (its melting temperature) so its bell-shaped activity peaks right at 60°C — pushing its relative activity there as high as it will go.',
    baseParams: { activationEnergy: 50, denaturationEnthalpy: 400, temperatureC: 60 },
    knob: {
      param: 'meltingTemp',
      label: 'Melting temperature Tm',
      min: 40,
      max: 90,
      step: 0.5,
      default: 55,
      unit: '°C',
    },
    metricKey: 'relativeActivityAtT',
    metricLabel: 'Relative activity at 60°C',
    goal: 'maximize',
    par: 0.98,
    hint: 'Relative activity at 60°C peaks when the enzyme’s optimum lands on 60°C. Too low a melting temperature and it is already unfolding at 60°C; too high and 60°C sits below its best. Raise Tm until the optimum reaches 60°C.',
  },
  {
    id: 'uncover-gene-distance',
    engine: 'recombination-map',
    title: 'Uncover the true gene distance',
    brief:
      'A breeding cross shows two genes shuffled apart 40% of the time. But crossovers between distant genes can cancel out, hiding the real distance. Slide the true map distance up until the model’s recombination rate matches the measured 40% — and you’ve mapped the gene.',
    baseParams: { mapFunction: 'haldane' },
    knob: {
      param: 'mapDistanceCm',
      label: 'True map distance',
      min: 0,
      max: 200,
      step: 1,
      default: 30,
      unit: 'cM',
    },
    metricKey: 'recombinationFrequency',
    metricLabel: 'Recombination frequency',
    goal: 'target',
    target: 0.4,
    hint: 'Crossovers between distant genes cancel, so observed recombination saturates below the true distance. Under Haldane r=½(1−e^(−2d)); r=40% means the true distance is about 80 cM — double the naive 40.',
  },
  {
    id: 'live-long-grow-big',
    engine: 'allometric-scaling',
    title: 'Live long by growing big',
    brief:
      'Across the animal kingdom, bigger bodies buy longer lives — but only slowly. Grow the body mass until the expected lifespan reaches three times that of a 1 kg creature.',
    baseParams: { scalingExponent: 0.75, normalization: 3.4 },
    knob: {
      param: 'bodyMass',
      label: 'Body mass',
      min: 1,
      max: 500,
      step: 1,
      default: 10,
      unit: 'kg',
    },
    metricKey: 'lifespanRelative',
    metricLabel: 'Lifespan vs a 1 kg animal',
    goal: 'target',
    target: 3,
    hint: 'Lifespan scales as mass^(1−b). With Kleiber’s b=0.75 that is mass^0.25 (the fourth root), so tripling lifespan needs 3⁴ = 81× the mass — about 81 kg.',
  },
  {
    id: 'carry-a-drug-across-a-membrane',
    engine: 'membrane-permeation',
    title: 'Carry a drug across a membrane',
    brief:
      'A drug only works if it can slip across the greasy membrane wrapping every cell, and how fast it crosses is set by its lipophilicity — how happily it dissolves into that oily layer. Tune the partition coefficient so the two sides half-equilibrate in exactly half a second: greasy enough to cross briskly, not so greasy it never lets go.',
    baseParams: {
      diffusionCoeff: 1e-6,
      thickness: 1e-6,
      area: 1,
      volume: 1,
      concOutside: 100,
      concInside: 0,
      tEnd: 5,
    },
    knob: {
      param: 'partitionCoeff',
      label: 'Partition coefficient K (lipophilicity)',
      min: 0.1,
      max: 5,
      step: 0.01,
      default: 1,
    },
    metricKey: 'halfEquilibrationTime',
    metricLabel: 'Half-equilibration time',
    unit: 's',
    goal: 'target',
    target: 0.5,
    hint: 'The two sides close half their gap every ln2/(2·P) seconds, and with these settings the permeability P equals K. A half-time of 0.5 s needs 2·K = ln2/0.5, i.e. K ≈ 0.69 — a moderately lipophilic drug.',
  },
  {
    id: 'reopen-a-narrowed-artery',
    engine: 'poiseuille-flow',
    title: 'Reopen a narrowed artery',
    brief:
      'A cholesterol plaque has narrowed an artery, and blood flow falls with the FOURTH power of the radius — so even a small narrowing chokes it dramatically. Widen the vessel (as a stent would) until the flow is restored to a healthy 10 mL/s.',
    baseParams: { length: 5, pressureDrop: 500, viscosity: 3.5e-3, density: 1060 },
    knob: {
      param: 'radius',
      label: 'Vessel radius',
      min: 0.5,
      max: 3,
      step: 0.01,
      default: 1,
      unit: 'mm',
    },
    metricKey: 'flowRate',
    metricLabel: 'Blood flow rate',
    unit: 'mL/s',
    goal: 'target',
    target: 10,
    hint: 'Flow rises as the fourth power of radius (Q ∝ r⁴), so a little widening buys a lot of flow. Reaching 10 mL/s needs a radius near 1.73 mm — a 16-fold flow swing hides inside a 2-fold change in radius.',
  },
  {
    id: 'how-aggressive-is-the-tumor',
    engine: 'gompertz-tumor',
    title: 'Gauge how aggressive a tumour is',
    brief:
      'A tumour grows by the Gompertz law — explosively fast while it is tiny, then slowing as it runs out of room and blood supply. Starting from a 1% seed, tune how aggressively it grows so that after 10 units of time it has filled exactly half of its maximum size.',
    baseParams: { initialSize: 0.01, carryingCapacity: 1, tEnd: 10 },
    knob: {
      param: 'growthRate',
      label: 'Growth aggressiveness b',
      min: 0.05,
      max: 0.6,
      step: 0.005,
      default: 0.2,
      unit: '1/time',
    },
    metricKey: 'fractionOfCapacity',
    metricLabel: 'Fraction of maximum size reached',
    goal: 'target',
    target: 0.5,
    hint: 'Gompertz growth decelerates as the tumour fills up, so the fraction reached climbs with the growth constant b but with diminishing returns. From a 1% seed, hitting half of capacity by t=10 needs b ≈ 0.19.',
  },
  {
    id: 'break-even-light-for-a-shade-plant',
    engine: 'photosynthesis-light',
    title: "Find a shade plant's break-even light",
    brief:
      'A plant fixes carbon in the light but burns it day and night by respiring. Below a certain brightness it loses more than it makes and slowly starves. Dial the light to the exact compensation point — where net photosynthesis is zero and the plant just breaks even.',
    baseParams: { maxRate: 20, halfSatLight: 200, respiration: 2, lightMax: 400 },
    knob: {
      param: 'light',
      label: 'Light intensity',
      min: 0,
      max: 200,
      step: 0.5,
      default: 100,
      unit: 'µmol/m²/s',
    },
    metricKey: 'netRateAtLight',
    metricLabel: 'Net photosynthesis',
    unit: 'µmol/m²/s',
    goal: 'target',
    target: 0,
    hint: 'Net photosynthesis rises steadily with light and crosses zero at the compensation point I = R_d·K_m/(P_max − R_d). With these values that is 2·200/(20−2) ≈ 22 µmol/m²/s.',
  },
  {
    id: 'signal-that-reaches-the-soma',
    engine: 'cable-length-constant',
    title: 'Build a dendrite that reaches the cell body',
    brief:
      'A synapse fires 500 µm out on a dendrite, but the voltage leaks away as it travels toward the cell body. Fatter fibres leak less and carry the signal further. Thicken the dendrite until exactly half of the original voltage still survives when it arrives.',
    baseParams: { membraneResistance: 10000, axialResistivity: 100, distance: 500 },
    knob: {
      param: 'diameter',
      label: 'Dendrite diameter',
      min: 0.2,
      max: 10,
      step: 0.05,
      default: 1,
      unit: 'µm',
    },
    metricKey: 'voltageFractionAtDistance',
    metricLabel: 'Voltage surviving at 500 µm',
    goal: 'target',
    target: 0.5,
    hint: 'The signal survives as e^(−x/λ) with λ=√(d·R_m/(4·R_i)), so a fatter fibre (bigger λ) delivers more. Half surviving at 500 µm needs λ ≈ 721 µm — a diameter of about 2.1 µm.',
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
