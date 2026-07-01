/**
 * Tests for the Flux Balance Analysis engine.
 *
 * Every assertion checks against a KNOWN analytic optimum (hand-solved LP or
 * hand-solved FBA network), not merely "does not throw".
 */

import { describe, expect, it } from 'vitest';
import { type MetabolicModel, type Relation, exampleModel, simplex, solveFba, spec } from './fba';

// ---------------------------------------------------------------------------
// Plain textbook linear programs (validates the simplex kernel directly)
// ---------------------------------------------------------------------------

describe('simplex — textbook LPs', () => {
  it('solves a classic 2-variable maximisation with both constraints binding', () => {
    // maximise 40x + 30y  s.t.  x + y <= 12,  2x + y <= 16,  x,y >= 0
    // Vertices: (0,0)=0, (8,0)=320, (0,12)=360, (4,8)=400  -> optimum (4,8)=400.
    const res = simplex(
      [40, 30],
      [
        [1, 1],
        [2, 1],
      ],
      [12, 16],
      ['<=', '<='],
    );
    expect(res.status).toBe('optimal');
    expect(res.value).toBeCloseTo(400, 9);
    expect(res.x[0]).toBeCloseTo(4, 9);
    expect(res.x[1]).toBeCloseTo(8, 9);
  });

  it('handles >= constraints via two-phase (minimisation encoded as max of negation)', () => {
    // minimise 2x + 3y  s.t.  x + y >= 10,  x <= 8,  y <= 8,  x,y >= 0
    // Cheapest is to use x fully: x=8, y=2 -> cost 22.  Encoded as max -(2x+3y).
    const res = simplex(
      [-2, -3],
      [
        [1, 1],
        [1, 0],
        [0, 1],
      ],
      [10, 8, 8],
      ['>=', '<=', '<='],
    );
    expect(res.status).toBe('optimal');
    expect(-res.value).toBeCloseTo(22, 9); // minimum cost
    expect(res.x[0]).toBeCloseTo(8, 9);
    expect(res.x[1]).toBeCloseTo(2, 9);
  });

  it('reports infeasible when constraints cannot be simultaneously satisfied', () => {
    // x + y <= 1  and  x >= 3  is infeasible for x,y >= 0.
    const res = simplex(
      [1, 1],
      [
        [1, 1],
        [1, 0],
      ],
      [1, 3],
      ['<=', '>='],
    );
    expect(res.status).toBe('infeasible');
  });

  it('detects an unbounded objective', () => {
    // maximise x  s.t.  -x + y <= 1,  x,y >= 0  -> x can grow without bound.
    const res = simplex([1, 0], [[-1, 1]], [1], ['<=']);
    expect(res.status).toBe('unbounded');
  });

  it('solves a 3-variable LP with an equality constraint', () => {
    // maximise 2a + 3b + c
    //   a + b + c = 10
    //   b <= 4
    //   a,b,c >= 0
    // Objective coefficient on b is the largest, so push b to its cap (4),
    // then put the remaining 6 into a (coeff 2 > 1 on c): a=6,b=4,c=0 -> 24.
    const res = simplex(
      [2, 3, 1],
      [
        [1, 1, 1],
        [0, 1, 0],
      ],
      [10, 4],
      ['=', '<='],
    );
    expect(res.status).toBe('optimal');
    expect(res.value).toBeCloseTo(24, 9);
    expect(res.x[0]).toBeCloseTo(6, 9);
    expect(res.x[1]).toBeCloseTo(4, 9);
    expect(res.x[2]).toBeCloseTo(0, 9);
  });
});

// ---------------------------------------------------------------------------
// FBA on hand-built toy metabolic networks (known analytic optima)
// ---------------------------------------------------------------------------

/** Linear pathway: uptake -> glycolysis (2 pyruvate) -> biomass. Optimum = 2·uptake. */
function linearNetwork(uptakeBound: number): MetabolicModel {
  return {
    reactions: ['EX_glc', 'GLYC', 'BIOMASS'],
    metabolites: ['glc_c', 'pyr_c'],
    stoichiometry: [
      [1, -1, 0],
      [0, 2, -1],
    ],
    lb: [0, 0, 0],
    ub: [uptakeBound, 1000, 1000],
    objective: [0, 0, 1],
  };
}

describe('solveFba — toy networks with analytic optima', () => {
  it('returns the analytic optimum flux and objective for the linear pathway', () => {
    const sol = solveFba(linearNetwork(10));
    expect(sol.status).toBe('optimal');
    // BIOMASS = 2 * EX_glc = 2 * 10 = 20.
    expect(sol.objectiveValue).toBeCloseTo(20, 9);
    expect(sol.fluxMap.EX_glc).toBeCloseTo(10, 9);
    expect(sol.fluxMap.GLYC).toBeCloseTo(10, 9);
    expect(sol.fluxMap.BIOMASS).toBeCloseTo(20, 9);
    expect(sol.activeReactions).toBe(3);
  });

  it('lowers the objective proportionally as the uptake bound is tightened', () => {
    const full = solveFba(linearNetwork(10)).objectiveValue; // 20
    const half = solveFba(linearNetwork(5)).objectiveValue; // 10
    const fifth = solveFba(linearNetwork(2)).objectiveValue; // 4
    expect(full).toBeCloseTo(20, 9);
    expect(half).toBeCloseTo(10, 9);
    expect(fifth).toBeCloseTo(4, 9);
    // Strict proportionality: objective / uptake is constant (= 2).
    expect(full / 10).toBeCloseTo(2, 9);
    expect(half / 5).toBeCloseTo(2, 9);
    expect(fifth / 2).toBeCloseTo(2, 9);
  });

  it('picks the higher-yield pathway when the network offers a choice', () => {
    // Two routes from substrate S to precursor P:
    //   PATH_A: S -> P    (yield 1)
    //   PATH_B: S -> 2 P  (yield 2)   <- optimal
    // With EX_S <= 10, using PATH_B gives BIOMASS = 20 (vs 10 for PATH_A).
    const model: MetabolicModel = {
      reactions: ['EX_S', 'PATH_A', 'PATH_B', 'BIOMASS'],
      metabolites: ['S', 'P'],
      stoichiometry: [
        [1, -1, -1, 0], // S
        [0, 1, 2, -1], // P
      ],
      lb: [0, 0, 0, 0],
      ub: [10, 1000, 1000, 1000],
      objective: [0, 0, 0, 1],
    };
    const sol = solveFba(model);
    expect(sol.status).toBe('optimal');
    expect(sol.objectiveValue).toBeCloseTo(20, 9);
    expect(sol.fluxMap.EX_S).toBeCloseTo(10, 9);
    expect(sol.fluxMap.PATH_B).toBeCloseTo(10, 9);
    expect(sol.fluxMap.PATH_A).toBeCloseTo(0, 9); // low-yield route stays off
    expect(sol.fluxMap.BIOMASS).toBeCloseTo(20, 9);
  });

  it('supports reversible reactions carrying negative (reverse) flux', () => {
    // EX_B: -> B [0,10];  R: A <-> B (written A->B, lb=-1000);  SINK_A: A ->, objective.
    // Steady state forces R to run in reverse: R = -EX_B = -10, SINK_A = 10.
    const model: MetabolicModel = {
      reactions: ['EX_B', 'R', 'SINK_A'],
      metabolites: ['A', 'B'],
      stoichiometry: [
        [0, -1, -1], // A: consumed by forward R and by SINK_A
        [1, 1, 0], // B: from uptake and from forward R
      ],
      lb: [0, -1000, 0],
      ub: [10, 1000, 1000],
      objective: [0, 0, 1],
    };
    const sol = solveFba(model);
    expect(sol.status).toBe('optimal');
    expect(sol.objectiveValue).toBeCloseTo(10, 9);
    expect(sol.fluxMap.EX_B).toBeCloseTo(10, 9);
    expect(sol.fluxMap.R).toBeCloseTo(-10, 9); // reverse flux
    expect(sol.fluxMap.SINK_A).toBeCloseTo(10, 9);
  });

  it('returns objective 0 for a blocked network (missing precursor)', () => {
    // BIOMASS consumes C, but nothing produces C -> steady state forces BIOMASS = 0.
    const model: MetabolicModel = {
      reactions: ['EX_A', 'USE_A', 'BIOMASS'],
      metabolites: ['A', 'C'],
      stoichiometry: [
        [1, -1, 0], // A
        [0, 0, -1], // C (only consumed, never produced)
      ],
      lb: [0, 0, 0],
      ub: [10, 1000, 1000],
      objective: [0, 0, 1],
    };
    const sol = solveFba(model);
    expect(sol.objectiveValue).toBeCloseTo(0, 9);
    expect(sol.fluxMap.BIOMASS).toBeCloseTo(0, 9);
    expect(sol.activeReactions).toBe(0);
  });

  it('returns objective 0 for an infeasible network (unsatisfiable forced flux)', () => {
    // BIOMASS forced on (lb=1) but C has no producer -> LP is infeasible -> obj 0.
    const model: MetabolicModel = {
      reactions: ['EX_A', 'BIOMASS'],
      metabolites: ['A', 'C'],
      stoichiometry: [
        [1, 0], // A
        [0, -1], // C consumed, never produced
      ],
      lb: [0, 1], // biomass forced to carry >= 1
      ub: [10, 1000],
      objective: [0, 1],
    };
    const sol = solveFba(model);
    expect(sol.status).toBe('infeasible');
    expect(sol.objectiveValue).toBe(0);
  });

  it('conserves mass at the optimum (S·v = 0 for every metabolite)', () => {
    const sol = solveFba(exampleModel);
    // glc_c: EX_glc - GLYC = 0 ; pyr_c: 2·GLYC - BIOMASS = 0
    const glcBalance = sol.fluxMap.EX_glc! - sol.fluxMap.GLYC!;
    const pyrBalance = 2 * sol.fluxMap.GLYC! - sol.fluxMap.BIOMASS!;
    expect(glcBalance).toBeCloseTo(0, 9);
    expect(pyrBalance).toBeCloseTo(0, 9);
  });
});

// ---------------------------------------------------------------------------
// EngineSpec contract + determinism
// ---------------------------------------------------------------------------

describe('spec (EngineSpec contract)', () => {
  it('exposes correct metadata', () => {
    expect(spec.slug).toBe('fba');
    expect(spec.domain).toBe('systems-biology');
    expect(spec.version).toBe('1.0.0');
    expect(spec.paramsSchema.safeParse(spec.example).success).toBe(true);
  });

  it('run() on the default example returns the known optimum and a valid SimResult', () => {
    const result = spec.run(spec.example);
    expect(result.engine).toBe('fba');

    const obj = result.metrics.find((m) => m.key === 'objectiveValue');
    const active = result.metrics.find((m) => m.key === 'activeReactions');
    expect(obj?.value).toBeCloseTo(20, 9);
    expect(active?.value).toBe(3);

    // detail carries the flux map and the mass-balance residual (~0).
    expect(result.detail?.status).toBe('optimal');
    expect(result.detail?.fluxes.BIOMASS).toBeCloseTo(20, 9);
    for (const r of result.detail?.massBalanceResidual ?? []) {
      expect(Math.abs(r)).toBeLessThan(1e-9);
    }

    // provenance is well-formed.
    expect(result.provenance.engine).toBe('fba');
    expect(result.provenance.version).toBe('1.0.0');
  });

  it('is deterministic: identical params give byte-identical results', () => {
    const a = spec.run(spec.example);
    const b = spec.run(spec.example);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('run() with no model falls back to the example network', () => {
    const result = spec.run({});
    const obj = result.metrics.find((m) => m.key === 'objectiveValue');
    expect(obj?.value).toBeCloseTo(20, 9);
  });
});

// Keep the `Relation` type import meaningful (compile-time usage).
const _relationCheck: Relation[] = ['<=', '>=', '='];
void _relationCheck;
