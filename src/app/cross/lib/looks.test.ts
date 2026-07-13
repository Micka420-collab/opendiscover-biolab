import { describe, expect, it } from 'vitest';
import { CROSS_PALETTE, paletteFor } from './looks';

describe('paletteFor', () => {
  it('is stable regardless of input order', () => {
    const a = paletteFor(['Round', 'Wrinkled']);
    const b = paletteFor(['Wrinkled', 'Round']);
    expect(a('Round')).toBe(b('Round'));
    expect(a('Wrinkled')).toBe(b('Wrinkled'));
  });

  it('gives distinct colours to distinct looks (up to the palette size)', () => {
    const labels = ['A', 'B', 'C', 'D'];
    const color = paletteFor(labels);
    const used = new Set(labels.map(color));
    expect(used.size).toBe(labels.length);
  });

  it('is total — unknown labels still get a colour', () => {
    const color = paletteFor(['Round']);
    expect(CROSS_PALETTE).toContain(color('anything'));
  });
});
