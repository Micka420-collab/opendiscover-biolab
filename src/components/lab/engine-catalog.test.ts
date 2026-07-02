import { describe, expect, it } from 'vitest';
import { type EngineCard, filterEngines } from './engine-catalog';

const engines: EngineCard[] = [
  {
    slug: 'logistic-map',
    title: 'Logistic Map',
    description: 'deterministic chaos',
    domain: 'ecology',
    version: '1.0.0',
    tags: ['chaos', 'bifurcation'],
  },
  {
    slug: 'hp-folding',
    title: 'HP Folding',
    description: 'protein lattice fold',
    domain: 'protein',
    version: '1.0.0',
    tags: ['folding'],
  },
  {
    slug: 'sis',
    title: 'SIS Endemic',
    description: 'epidemic spread',
    domain: 'epidemiology',
    version: '1.0.0',
    tags: ['ode', 'endemic'],
  },
];

const labels = {
  protein: '🧬 Protein biophysics',
  ecology: '🐺 Ecology',
  epidemiology: '🦠 Epidemiology',
};

const slugs = (r: EngineCard[]) => r.map((e) => e.slug);

describe('filterEngines', () => {
  it('returns everything for an empty/whitespace query', () => {
    expect(filterEngines(engines, '', labels)).toHaveLength(3);
    expect(filterEngines(engines, '   ', labels)).toHaveLength(3);
  });

  it('matches on tags', () => {
    expect(slugs(filterEngines(engines, 'chaos', labels))).toEqual(['logistic-map']);
    expect(slugs(filterEngines(engines, 'ode', labels))).toEqual(['sis']);
  });

  it('matches on the humanized domain label', () => {
    expect(slugs(filterEngines(engines, 'biophysics', labels))).toEqual(['hp-folding']);
  });

  it('matches on the raw domain and description', () => {
    expect(slugs(filterEngines(engines, 'ecology', labels))).toEqual(['logistic-map']);
    expect(slugs(filterEngines(engines, 'epidemic', labels))).toEqual(['sis']);
  });

  it('is case-insensitive', () => {
    expect(slugs(filterEngines(engines, 'CHAOS', labels))).toEqual(['logistic-map']);
  });

  it('returns nothing when there is no match', () => {
    expect(filterEngines(engines, 'zzzz', labels)).toEqual([]);
  });
});
