/**
 * Flux Balance Analysis (FBA)
 * ===========================
 *
 * FBA is the workhorse of constraint-based metabolic modelling. A metabolic
 * network is encoded by a stoichiometric matrix `S` (rows = metabolites,
 * columns = reactions). At metabolic steady state the concentration of every
 * internal metabolite is constant, which means production balances consumption:
 *
 *        S · v = 0                    (mass-balance / steady state)
 *        lb <= v <= ub                (thermodynamic & capacity bounds)
 *
 * `v` is the vector of reaction fluxes. Because the system is under-determined
 * (many more reactions than metabolites) FBA selects the flux distribution that
 * maximises a linear objective `c · v` — typically the biomass / growth
 * reaction. That is exactly a linear program (LP):
 *
 *        maximise   cᵀ v
 *        subject to S v = 0 ,  lb <= v <= ub
 *
 * This module implements a self-contained **two-phase primal simplex** solver
 * (with Bland's anti-cycling rule for determinism on the highly-degenerate LPs
 * that FBA produces) and wraps it in the OpenDiscover `EngineSpec` contract.
 *
 * Assumptions & scope
 * -------------------
 *  - Only the core FBA problem is solved (no FVA, no parsimonious FBA, no MILP).
 *  - Bounds must be finite; non-finite bounds are clamped to ±`DEFAULT_BOUND`
 *    (1000), matching the common COBRA convention for "unbounded" reactions.
 *  - The solver is exact up to floating-point *provided it converges within the
 *    pivot cap*; on rational/integer toy networks it returns the analytic
 *    optimum to machine precision. Bland's rule guarantees the pivot sequence
 *    is finite and cycle-free, but — contrary to an earlier version of this
 *    comment — it does **not** bound how large that finite count is. If the
 *    cap is exhausted before reaching a verified optimum, `status` reports
 *    `'iteration_limit'` rather than a false `'optimal'` (see `maxIter`).
 *
 * References
 *  - Orth, Thiele & Palsson, "What is flux balance analysis?", Nature
 *    Biotechnology 28, 245–248 (2010).
 *  - Palsson, "Systems Biology: Constraint-based Reconstruction and Analysis"
 *    (Cambridge University Press, 2015), Ch. 9–11.
 *  - Dantzig, "Linear Programming and Extensions" (two-phase simplex).
 */

import { z } from 'zod';
import { dot, matVec } from '../core/linalg';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Generic linear-programming (two-phase simplex) solver
// ---------------------------------------------------------------------------

/** Constraint relation for a single LP row. */
export type Relation = '<=' | '>=' | '=';

export interface LPResult {
  /**
   * `'iteration_limit'` means the pivot cap (`maxIter`) was exhausted before a
   * genuine optimality/unboundedness condition was reached: the returned
   * `x`/`value` are the last tableau state, NOT a verified optimum, and must
   * not be treated as the analytic answer.
   */
  status: 'optimal' | 'infeasible' | 'unbounded' | 'iteration_limit';
  /** Values of the structural (original) variables, length = c.length. */
  x: number[];
  /** Objective value cᵀx at the optimum (for a maximisation). */
  value: number;
  /** Simplex pivots performed across both phases (diagnostic). */
  iterations: number;
}

interface SimplexOpts {
  /** Numerical zero tolerance for pivots / reduced costs. */
  eps?: number;
  /**
   * Safety cap on pivots. Bland's rule guarantees the pivot sequence is finite
   * and cycle-free, but it does NOT bound how large that finite count is, so
   * this cap can in principle be hit on large/highly-degenerate networks. When
   * it is, `simplex()` reports `status: 'iteration_limit'` instead of
   * silently claiming `'optimal'`.
   */
  maxIter?: number;
}

/**
 * Solve `maximise cᵀx` subject to `A x (relations) b`, `x >= 0`.
 *
 * The routine converts the problem to standard form by adding slack/surplus and
 * artificial variables, then runs a classic two-phase simplex:
 *   Phase 1 drives the sum of artificial variables to zero (feasibility).
 *   Phase 2 optimises the true objective over the feasible region.
 *
 * Bland's rule (smallest-index entering + smallest basis-index leaving on ties)
 * makes the pivot sequence deterministic and cycle-free, which matters because
 * FBA LPs are massively degenerate.
 */
export function simplex(
  c: number[],
  A: number[][],
  b: number[],
  relations: Relation[],
  opts: SimplexOpts = {},
): LPResult {
  const eps = opts.eps ?? 1e-9;
  const maxIter = opts.maxIter ?? 20000;
  const m = A.length;
  const n = c.length;

  // --- Normalise every row so the right-hand side is non-negative. ---------
  // Flipping a row's sign also flips its relation (<= <-> >=; = unchanged).
  const coef: number[][] = [];
  const rel: Relation[] = [];
  const rhs0: number[] = [];
  for (let i = 0; i < m; i++) {
    let row = (A[i] ?? []).slice();
    let r = relations[i] ?? '=';
    let rv = b[i] ?? 0;
    if (rv < 0) {
      row = row.map((v) => -v);
      rv = -rv;
      r = r === '<=' ? '>=' : r === '>=' ? '<=' : '=';
    }
    coef.push(row);
    rel.push(r);
    rhs0.push(rv);
  }

  // --- Count the extra columns (slack/surplus + artificials). --------------
  let numExtra = 0;
  for (const r of rel) numExtra += r === '>=' ? 2 : 1; // '<=' & '=' add 1, '>=' adds 2
  const N = n + numExtra;

  // Tableau `T` (m x N) plus a separate right-hand-side vector.
  const T: number[][] = Array.from({ length: m }, () => new Array<number>(N).fill(0));
  const rhs = rhs0.slice();
  const basis = new Array<number>(m).fill(-1);
  const isArtificial = new Array<boolean>(N).fill(false);

  let col = n;
  for (let i = 0; i < m; i++) {
    const row = coef[i]!;
    const Ti = T[i]!;
    for (let j = 0; j < n; j++) Ti[j] = row[j] ?? 0;
    const r = rel[i]!;
    if (r === '<=') {
      Ti[col] = 1; // slack, immediately basic
      basis[i] = col;
      col++;
    } else if (r === '>=') {
      Ti[col] = -1; // surplus
      col++;
      Ti[col] = 1; // artificial, basic
      isArtificial[col] = true;
      basis[i] = col;
      col++;
    } else {
      Ti[col] = 1; // artificial, basic
      isArtificial[col] = true;
      basis[i] = col;
      col++;
    }
  }

  // Pivot on (row, col): Gauss–Jordan the column into a unit vector and update basis.
  const doPivot = (pr: number, pc: number): void => {
    const prow = T[pr]!;
    const pv = prow[pc]!;
    for (let j = 0; j < N; j++) prow[j]! /= pv;
    rhs[pr]! /= pv;
    for (let i = 0; i < m; i++) {
      if (i === pr) continue;
      const Ti = T[i]!;
      const f = Ti[pc]!;
      if (f === 0) continue;
      for (let j = 0; j < N; j++) Ti[j]! -= f * prow[j]!;
      rhs[i]! -= f * rhs[pr]!;
    }
    basis[pr] = pc;
  };

  // --- Core pivoting loop, shared by both phases. --------------------------
  // Returns both the outcome and the number of pivots actually performed, so
  // callers can (a) accumulate a true pivot count and (b) tell a genuine
  // optimum/unboundedness apart from a maxIter cutoff.
  const runCore = (
    cost: number[],
    forbidden: boolean[] | null,
  ): { status: 'optimal' | 'unbounded' | 'iteration_limit'; iter: number } => {
    let iter = 0;
    while (iter < maxIter) {
      // Entering column: Bland's rule -> first index with positive reduced cost.
      let entering = -1;
      for (let j = 0; j < N; j++) {
        if (forbidden?.[j]) continue;
        let z = 0;
        for (let i = 0; i < m; i++) z += cost[basis[i]!]! * T[i]?.[j]!;
        if (cost[j]! - z > eps) {
          entering = j;
          break;
        }
      }
      if (entering === -1) return { status: 'optimal', iter };

      // Leaving row: minimum ratio test, ties broken by smallest basis index.
      let leaving = -1;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < m; i++) {
        const a = T[i]?.[entering]!;
        if (a > eps) {
          const ratio = rhs[i]! / a;
          if (leaving === -1 || ratio < best - eps) {
            best = ratio;
            leaving = i;
          } else if (ratio <= best + eps && basis[i]! < basis[leaving]!) {
            leaving = i;
          }
        }
      }
      if (leaving === -1) return { status: 'unbounded', iter }; // objective improves without bound

      doPivot(leaving, entering);
      iter++;
    }
    // Pivot cap exhausted without reaching a verified optimal/unbounded state:
    // do NOT claim 'optimal' — the caller must be able to tell this apart from
    // a real convergence (see the SimplexOpts.maxIter doc comment).
    return { status: 'iteration_limit', iter };
  };

  const zeros = (): number[] => new Array<number>(n).fill(0);

  // --- Phase 1: minimise the sum of artificials (maximise its negation). ----
  const hasArtificial = isArtificial.some(Boolean);
  let iterations = 0;
  if (hasArtificial) {
    const cost1 = isArtificial.map((a) => (a ? -1 : 0));
    const phase1 = runCore(cost1, null);
    iterations += phase1.iter;
    if (phase1.status === 'iteration_limit') {
      return { status: 'iteration_limit', x: zeros(), value: 0, iterations };
    }
    // Feasibility check: any artificial still carrying positive value => infeasible.
    // The threshold is derived from `eps` (rather than an independent magic
    // constant) so the one exposed tolerance knob has a single, consistent
    // meaning throughout the solve; the 1e2 factor is a safety margin over the
    // per-pivot tolerance to absorb summed rounding error across rows.
    let artSum = 0;
    for (let i = 0; i < m; i++) if (isArtificial[basis[i]!]) artSum += rhs[i]!;
    const infeasTol = eps * 1e2;
    if (artSum > infeasTol) {
      return { status: 'infeasible', x: zeros(), value: 0, iterations };
    }
    // Drive any artificial still basic (necessarily at value 0) out of the basis.
    // This is essential: a basic artificial left in place could grow during phase 2
    // and silently violate its equality/>= constraint. If a row has no non-artificial
    // pivot the constraint is redundant and the artificial harmlessly stays at 0
    // (its row is all-zero over the allowed columns, so no pivot can move it).
    for (let i = 0; i < m; i++) {
      if (!isArtificial[basis[i]!]) continue;
      for (let j = 0; j < N; j++) {
        if (!isArtificial[j] && Math.abs(T[i]?.[j]!) > eps) {
          doPivot(i, j);
          iterations++;
          break;
        }
      }
    }
  }

  // --- Phase 2: optimise the real objective; artificials may never re-enter.
  const cost2 = new Array<number>(N).fill(0);
  for (let j = 0; j < n; j++) cost2[j] = c[j] ?? 0;
  const phase2 = runCore(cost2, isArtificial);
  iterations += phase2.iter;
  if (phase2.status === 'unbounded') {
    return { status: 'unbounded', x: zeros(), value: 0, iterations };
  }
  if (phase2.status === 'iteration_limit') {
    return { status: 'iteration_limit', x: zeros(), value: 0, iterations };
  }

  // Read the structural variables out of the final basis.
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < m; i++) {
    const bi = basis[i]!;
    if (bi < n) x[bi] = rhs[i]!;
  }
  return { status: 'optimal', x, value: dot(c, x), iterations };
}

// ---------------------------------------------------------------------------
// Metabolic model + FBA solve
// ---------------------------------------------------------------------------

/** Non-finite bounds are clamped to this magnitude (COBRA convention). */
export const DEFAULT_BOUND = 1000;

/** A constraint-based metabolic model. */
export interface MetabolicModel {
  /** Reaction identifiers, length nR. */
  reactions: string[];
  /** Metabolite identifiers, length nM. */
  metabolites: string[];
  /** Stoichiometric matrix S, shape nM x nR (rows metabolites, cols reactions). */
  stoichiometry: number[][];
  /** Lower flux bounds, length nR (negative => reversible). */
  lb: number[];
  /** Upper flux bounds, length nR. */
  ub: number[];
  /** Objective coefficients c, length nR (usually 1 on the biomass reaction). */
  objective: number[];
}

export interface FbaSolution {
  /**
   * `'iteration_limit'` means the underlying simplex pivot cap was exhausted
   * before a verified optimum was found; `objectiveValue`/`fluxes` below are
   * NOT a trustworthy analytic answer in that case (see `simplex`'s
   * `SimplexOpts.maxIter`). In practice every reaction gets an explicit
   * `x_j <= ub_j - lb_j` row (bounds are clamped to finite values before the
   * LP is built), so the feasible region is always a bounded polytope and
   * `'unbounded'` cannot occur through this function; it remains part of the
   * type because `simplex()` itself is also exported and used directly.
   */
  status: 'optimal' | 'infeasible' | 'unbounded' | 'iteration_limit';
  /** Optimal objective value cᵀv (growth / biomass flux). */
  objectiveValue: number;
  /** Optimal flux vector v, length nR. */
  fluxes: number[];
  /** Flux vector keyed by reaction id. */
  fluxMap: Record<string, number>;
  /** Number of reactions carrying non-negligible flux. */
  activeReactions: number;
}

interface SolveFbaOpts {
  /** Solver numerical tolerance. */
  eps?: number;
  /** Below this magnitude a flux is reported as exactly zero / inactive. */
  fluxTol?: number;
}

function clampBound(v: number): number {
  if (!Number.isFinite(v)) return v > 0 ? DEFAULT_BOUND : -DEFAULT_BOUND;
  return v;
}

/**
 * Solve the FBA linear program for a metabolic model.
 *
 * The problem `max cᵀv s.t. S v = 0, lb <= v <= ub` is mapped onto the
 * non-negative-variable simplex above via the substitution `x = v - lb`:
 *
 *    v = x + lb ,  x >= 0
 *    S v = 0            ->   S x = -S lb        (equality rows)
 *    v <= ub            ->   x_j <= ub_j - lb_j (one <= row per reaction)
 *
 * An infeasible or fully blocked network yields objective 0 with a zero flux
 * vector, matching standard FBA semantics. A genuinely `'unbounded'` LP (in
 * real FBA, typically a thermodynamically-infeasible energy-generating loop;
 * see Schellenberger, Lewis & Palsson 2011, Biophys J 100:544-553) is a
 * different failure mode from infeasibility — growth is not "zero", it is
 * unconstrained — but every reaction here is bound by an explicit
 * `x_j <= ub_j - lb_j` row, so the LP built by this function is always a
 * bounded polytope and `'unbounded'` cannot actually be returned by it.
 */
export function solveFba(model: MetabolicModel, opts: SolveFbaOpts = {}): FbaSolution {
  const eps = opts.eps ?? 1e-9;
  const fluxTol = opts.fluxTol ?? 1e-7;
  const nR = model.reactions.length;
  const nM = model.metabolites.length;

  // --- Dimensional sanity checks. -----------------------------------------
  if (model.stoichiometry.length !== nM) {
    throw new Error(
      `stoichiometry has ${model.stoichiometry.length} rows, expected ${nM} metabolites`,
    );
  }
  for (let i = 0; i < nM; i++) {
    if ((model.stoichiometry[i] ?? []).length !== nR) {
      throw new Error(`stoichiometry row ${i} has wrong length, expected ${nR} reactions`);
    }
  }
  if (model.lb.length !== nR || model.ub.length !== nR || model.objective.length !== nR) {
    throw new Error('lb, ub and objective must each have length equal to the number of reactions');
  }

  const lb = model.lb.map(clampBound);
  const ub = model.ub.map(clampBound);

  // --- Assemble the LP in the (x >= 0) shifted variables. ------------------
  const A: number[][] = [];
  const b: number[] = [];
  const rel: Relation[] = [];

  // Steady-state equalities: S x = -S lb.
  for (let i = 0; i < nM; i++) {
    const srow = model.stoichiometry[i]!;
    A.push(srow.slice());
    b.push(-dot(srow, lb));
    rel.push('=');
  }
  // Upper bounds: x_j <= ub_j - lb_j (lower bound x_j >= 0 is implicit).
  for (let j = 0; j < nR; j++) {
    const row = new Array<number>(nR).fill(0);
    row[j] = 1;
    A.push(row);
    b.push(ub[j]! - lb[j]!);
    rel.push('<=');
  }

  const lp = simplex(model.objective, A, b, rel, { eps });

  const zeroFlux = new Array<number>(nR).fill(0);
  if (lp.status !== 'optimal') {
    return {
      status: lp.status,
      objectiveValue: 0,
      fluxes: zeroFlux,
      fluxMap: Object.fromEntries(model.reactions.map((r) => [r, 0])),
      activeReactions: 0,
    };
  }

  // Recover fluxes v = x + lb and clean numerical dust.
  const fluxes = lp.x.map((xj, j) => {
    const v = xj + lb[j]!;
    return Math.abs(v) < fluxTol ? 0 : v;
  });
  const objectiveValue = dot(model.objective, fluxes);
  const activeReactions = fluxes.reduce((k, v) => (Math.abs(v) > fluxTol ? k + 1 : k), 0);
  const fluxMap: Record<string, number> = {};
  for (let j = 0; j < nR; j++) fluxMap[model.reactions[j]!] = fluxes[j]!;

  return { status: 'optimal', objectiveValue, fluxes, fluxMap, activeReactions };
}

// ---------------------------------------------------------------------------
// Default / example metabolic network
// ---------------------------------------------------------------------------

/**
 * A minimal textbook carbon-core network:
 *
 *   EX_glc :        -> glc_c            (glucose uptake, capped at 10)
 *   GLYC   :  glc_c -> 2 pyr_c          (lumped glycolysis, 2 pyruvate / glucose)
 *   BIOMASS:  pyr_c ->                  (biomass formation, the objective)
 *
 * At steady state GLYC = EX_glc and BIOMASS = 2·GLYC, so the analytic optimum is
 * BIOMASS = 2 × 10 = 20 with EX_glc = GLYC = 10. Halving the uptake bound halves
 * the growth — the canonical linear substrate-limitation result.
 */
export const exampleModel: MetabolicModel = {
  reactions: ['EX_glc', 'GLYC', 'BIOMASS'],
  metabolites: ['glc_c', 'pyr_c'],
  stoichiometry: [
    //  EX_glc  GLYC  BIOMASS
    [1, -1, 0], // glc_c: produced by uptake, consumed by glycolysis
    [0, 2, -1], // pyr_c: 2 produced by glycolysis, 1 consumed by biomass
  ],
  lb: [0, 0, 0],
  ub: [10, 1000, 1000],
  objective: [0, 0, 1], // maximise BIOMASS
};

// ---------------------------------------------------------------------------
// EngineSpec wrapper
// ---------------------------------------------------------------------------

const metabolicModelSchema = z.object({
  reactions: z.array(z.string()).min(1),
  metabolites: z.array(z.string()),
  stoichiometry: z.array(z.array(z.number())),
  lb: z.array(z.number()),
  ub: z.array(z.number()),
  objective: z.array(z.number()),
});

const paramsSchema = z.object({
  /** The metabolic model to optimise; defaults to the textbook example. */
  model: metabolicModelSchema.optional(),
  /** Optional solver tolerance override. */
  tolerance: z.number().positive().optional(),
});

export type FbaParams = z.infer<typeof paramsSchema>;

export interface StoichiometryEdge {
  metabolite: string;
  reaction: string;
  /** Stoichiometric coefficient: negative = consumed (substrate), positive = produced. */
  coefficient: number;
}

export interface FbaDetail {
  status: FbaSolution['status'];
  /** Flux value keyed by reaction id. */
  fluxes: Record<string, number>;
  /** Raw flux vector aligned to `reactions`. */
  fluxVector: number[];
  reactions: string[];
  /** Steady-state residual S·v (should be ~0 for every metabolite). */
  massBalanceResidual: number[];
  metabolites: string[];
  /** The bipartite metabolite<->reaction participation graph (for visualization). */
  stoichiometryEdges: StoichiometryEdge[];
}

/** Flatten a model's stoichiometric matrix into a named (metabolite, reaction) edge list. */
export function stoichiometryEdgeList(model: MetabolicModel): StoichiometryEdge[] {
  const edges: StoichiometryEdge[] = [];
  model.metabolites.forEach((metabolite, i) => {
    const row = model.stoichiometry[i] ?? [];
    model.reactions.forEach((reaction, j) => {
      const coefficient = row[j] ?? 0;
      if (coefficient !== 0) edges.push({ metabolite, reaction, coefficient });
    });
  });
  return edges;
}

export const spec: EngineSpec<FbaParams, FbaDetail> = {
  slug: 'fba',
  title: 'Flux Balance Analysis',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'Constraint-based optimisation of a metabolic network at steady state. Given a stoichiometric ' +
    'matrix S, flux bounds and a linear objective, an internal two-phase simplex maximises cᵀv ' +
    'subject to S·v = 0 and lb ≤ v ≤ ub, returning the optimal growth/biomass flux and the full ' +
    'flux distribution. Infeasible or blocked networks return a growth of zero.',
  references: [
    'Orth, Thiele & Palsson (2010) "What is flux balance analysis?" Nat Biotechnol 28:245-248.',
    'Palsson (2015) "Systems Biology: Constraint-based Reconstruction and Analysis", CUP.',
  ],
  paramsSchema,
  example: { model: exampleModel },
  tags: ['metabolism', 'linear-programming', 'simplex', 'steady-state', 'systems-biology', 'COBRA'],
  run(params: FbaParams): SimResult<FbaDetail> {
    const parsed = paramsSchema.parse(params ?? {});
    const model = (parsed.model as MetabolicModel | undefined) ?? exampleModel;
    const sol = solveFba(model, parsed.tolerance ? { eps: parsed.tolerance } : {});

    // Verify mass balance for provenance/plausibility (S·v across metabolites).
    const residual = model.metabolites.length > 0 ? matVec(model.stoichiometry, sol.fluxes) : [];

    // 'unbounded' is a different failure mode from infeasible/blocked (growth
    // is unconstrained, not absent — see the `FbaSolution` doc comment), and
    // 'iteration_limit' means the result is not a verified optimum at all;
    // neither should be described as "no feasible growth (objective 0)".
    const summary =
      sol.status === 'optimal'
        ? `Optimal objective flux ${sol.objectiveValue.toFixed(3)} with ${sol.activeReactions} of ${model.reactions.length} reactions active.`
        : sol.status === 'unbounded'
          ? 'Network unbounded — objective grows without bound (check for an energy-generating / ' +
            'thermodynamically-infeasible cycle; Schellenberger et al. 2011, Biophys J 100:544-553).'
          : sol.status === 'iteration_limit'
            ? 'Solver did not converge within the pivot limit — result is not a verified optimum.'
            : `Network ${sol.status} — no feasible growth (objective 0).`;

    return {
      engine: spec.slug,
      summary,
      metrics: [
        {
          key: 'objectiveValue',
          label: 'Objective (growth) flux',
          value: sol.objectiveValue,
          unit: 'flux',
          note: 'Maximum of cᵀv at steady state.',
        },
        {
          key: 'activeReactions',
          label: 'Active reactions',
          value: sol.activeReactions,
          note: 'Reactions carrying non-negligible flux.',
        },
      ],
      series: [
        {
          x: model.reactions.map((_, i) => i),
          y: { flux: sol.fluxes },
          xLabel: 'reaction index',
          yLabel: 'flux',
        },
      ],
      detail: {
        status: sol.status,
        fluxes: sol.fluxMap,
        fluxVector: sol.fluxes,
        reactions: model.reactions,
        massBalanceResidual: residual,
        metabolites: model.metabolites,
        stoichiometryEdges: stoichiometryEdgeList(model),
      },
      provenance: provenance(spec.slug, spec.version, parsed as Record<string, unknown>),
    };
  },
};

export default spec;
