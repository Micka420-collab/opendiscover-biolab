import { describe, expect, it } from 'vitest';
import { DOMAIN_LABELS, domainLabel } from './domain-labels';
import { listDomains } from './index';

describe('domain labels', () => {
  it('every live registry domain has a curated, non-empty label (guards drift)', () => {
    for (const d of listDomains()) {
      expect(DOMAIN_LABELS[d], `missing curated label for domain "${d}"`).toBeTruthy();
      expect(domainLabel(d)).toBe(DOMAIN_LABELS[d]);
    }
  });

  it('falls back to a non-empty title-cased label for an unknown domain', () => {
    expect(domainLabel('quantum-biology')).toBe('Quantum Biology');
    expect(domainLabel('metabolomics')).toBe('Metabolomics');
    expect(domainLabel('some new field')).toBe('Some New Field');
  });
});
