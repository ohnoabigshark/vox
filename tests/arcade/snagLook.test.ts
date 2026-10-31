import { afterEach, describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { ringScale, snagBoxStyle } from '../../src/arcade/ui/snagLook';

/** docs/BENCH.md, test 6: SNAG IT!'s sizes come from tuning.ts, so the test bench can set them. */

type Sizes = { dotSize: number; ringFrom: number; box: number };
const sizes = arcadeTuning.snag as unknown as Sizes;
const shipped: Sizes = { dotSize: sizes.dotSize, ringFrom: sizes.ringFrom, box: sizes.box };

afterEach(() => Object.assign(sizes, shipped));

describe("SNAG IT!'s sizes", () => {
  it('ship as they were in CSS: a 72 px dot, a ring from twice it, a box of at most 460 px', () => {
    expect(shipped).toEqual({ dotSize: 72, ringFrom: 2, box: 460 });
    expect(snagBoxStyle()).toEqual({
      '--snag-box': 'min(92vw, 460px, 60vh)',
      '--snag-dot': '72px',
    });
    expect(ringScale(null)).toBe(2);
    expect(ringScale(0)).toBe(2);
    expect(ringScale(0.5)).toBe(1.5);
    expect(ringScale(1)).toBe(1);
  });

  it('draw at a changed value', () => {
    Object.assign(sizes, { dotSize: 90, ringFrom: 3, box: 400 });
    expect(snagBoxStyle()).toEqual({
      '--snag-box': 'min(92vw, 400px, 60vh)',
      '--snag-dot': '90px',
    });
    expect(ringScale(0)).toBe(3);
    expect(ringScale(0.5)).toBe(2);
    expect(ringScale(1)).toBe(1);
  });
});
