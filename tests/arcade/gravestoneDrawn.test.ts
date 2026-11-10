import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { GRAVESTONE_TALL, gravestoneShape } from '../../src/arcade/render/pickups';
import { getModel } from '../../src/voxel/models';

/** docs/PICKUPS.md, Gravestones: drawn true to size (the user, 2026-11-10, after playing). */
describe('a gravestone as drawn', () => {
  const model = getModel('pickups/gravestone');
  const { radius } = arcadeTuning.pickups.gravestone;

  it('is as wide as what it trips: twice its reach, edge to edge', () => {
    const { wide } = gravestoneShape(model, radius);
    expect(model.width * model.scale * wide).toBeCloseTo(2 * radius, 9);
  });

  it('stays about knee-to-waist high, not stretched as tall as it is wide', () => {
    const { tall } = gravestoneShape(model, radius);
    expect(model.height * model.scale * tall).toBeCloseTo(GRAVESTONE_TALL, 9);
    expect(GRAVESTONE_TALL).toBeLessThan(2 * radius);
  });

  it('follows its reach: a bigger reach draws a bigger stone', () => {
    const { wide } = gravestoneShape(model, 1.5);
    expect(model.width * model.scale * wide).toBeCloseTo(3, 9);
  });
});
