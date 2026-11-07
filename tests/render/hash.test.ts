import { describe, expect, it } from 'vitest';
import { hash } from '../../src/arcade/render/hash';

/** The one repeatable "random" number the field events' looks scatter their pieces by (review r3). */
describe('hash', () => {
  it('is the same for the same piece and key, and between 0 and 1', () => {
    for (let i = 0; i < 50; i++) {
      for (let k = 1; k <= 6; k++) {
        const h = hash(i, k);
        expect(hash(i, k)).toBe(h);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
      }
    }
  });

  it('differs from piece to piece, so the pieces scatter', () => {
    const firsts = new Set(Array.from({ length: 50 }, (_, i) => hash(i, 1).toFixed(6)));
    expect(firsts.size).toBe(50);
  });
});
