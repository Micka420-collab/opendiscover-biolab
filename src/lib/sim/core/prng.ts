/**
 * Seeded, deterministic pseudo-random number generation.
 *
 * Every stochastic simulation in the lab (Gillespie SSA, Wright-Fisher drift,
 * Monte-Carlo folding, ...) draws from one of these generators. Determinism is
 * a hard requirement: the same seed must reproduce the same trajectory on every
 * machine so that a run can be canary-replicated and content-hashed. That rules
 * out `Math.random()`.
 *
 * `mulberry32` is a tiny, fast, well-distributed 32-bit generator. It passes the
 * gjrand small-crush battery and is more than adequate for teaching / research
 * simulation. For heavier statistical work we expose `xoshiro128ss` as well.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  uniform(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Standard normal (mean 0, sd 1) via Box–Muller. */
  normal(mean?: number, sd?: number): number;
  /** Exponential with the given rate (λ). */
  exponential(rate: number): number;
  /** Poisson draw with mean λ (Knuth for small λ, transformed rejection for large). */
  poisson(lambda: number): number;
  /** Binomial(n, p). */
  binomial(n: number, p: number): number;
  /** True with probability p. */
  bernoulli(p: number): boolean;
  /** Uniformly pick one element. */
  pick<T>(items: readonly T[]): T;
  /** Weighted pick; weights need not be normalised. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;
  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** Current internal state (for checkpointing). */
  state(): number;
}

/** Hash an arbitrary string seed into a 32-bit integer (for human-friendly seeds). */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

class Mulberry32 implements Rng {
  private s: number;
  private spareNormal: number | null = null;

  constructor(seed: string | number) {
    this.s = hashSeed(seed);
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.uniform(min, max + 1));
  }

  normal(mean = 0, sd = 1): number {
    // Box–Muller with a cached spare for efficiency & determinism.
    if (this.spareNormal !== null) {
      const z = this.spareNormal;
      this.spareNormal = null;
      return mean + sd * z;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    this.spareNormal = mag * Math.sin(2.0 * Math.PI * v);
    return mean + sd * (mag * Math.cos(2.0 * Math.PI * v));
  }

  exponential(rate: number): number {
    if (rate <= 0) throw new Error('exponential: rate must be > 0');
    let u = 0;
    while (u === 0) u = this.next();
    return -Math.log(u) / rate;
  }

  poisson(lambda: number): number {
    if (lambda < 0) throw new Error('poisson: lambda must be >= 0');
    if (lambda === 0) return 0;
    if (lambda < 30) {
      // Knuth's multiplicative algorithm.
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= this.next();
      } while (p > L);
      return k - 1;
    }
    // Normal approximation with continuity correction for large lambda.
    return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
  }

  binomial(n: number, p: number): number {
    if (p <= 0) return 0;
    if (p >= 1) return n;
    // Direct simulation is fine for the population sizes used here.
    if (n <= 1000) {
      let count = 0;
      for (let i = 0; i < n; i++) if (this.next() < p) count++;
      return count;
    }
    return Math.max(0, Math.min(n, Math.round(this.normal(n * p, Math.sqrt(n * p * (1 - p))))));
  }

  bernoulli(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick: empty array');
    return items[this.int(0, items.length - 1)];
  }

  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length || items.length === 0) {
      throw new Error('weightedPick: items/weights length mismatch or empty');
    }
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  state(): number {
    return this.s >>> 0;
  }
}

/** Create a deterministic RNG from a string or numeric seed. */
export function createRng(seed: string | number = 'opendiscover'): Rng {
  return new Mulberry32(seed);
}
