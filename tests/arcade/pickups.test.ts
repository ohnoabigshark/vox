import { describe, expect, it } from 'vitest';
import { arcadeTuning } from '../../src/arcade/content/tuning';
import { pickupsForDrive } from '../../src/arcade/sim/pickups';
import { drivePropsWithBoss } from '../../src/arcade/sim/props';
import { createRun } from '../../src/arcade/sim/run';
import type { Play } from '../../src/arcade/content/plays';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import { dist, v } from '../../src/arcade/sim/vec';

const { pickups: tuning, field } = arcadeTuning;

describe('tricks and treats: where they lie (docs/PICKUPS.md)', () => {
  it('are laid the same for a seed: one bolt and one slick to every 10-yard stretch', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const area = seed % 3;
      const index = seed % 4;
      const pickups = pickupsForDrive(seed, area, index);
      expect(pickupsForDrive(seed, area, index)).toEqual(pickups);
      // This drive's own stretch, and the two ahead of it.
      for (const from of [0, 10, 20]) {
        const here = pickups.filter((p) => p.y >= from && p.y < from + 10);
        expect(here.map((p) => p.kind).sort(), `seed ${seed}, from ${from}`).toEqual([
          'bolt',
          'slick',
        ]);
      }
    }
    expect(pickupsForDrive(1, 0, 0)).not.toEqual(pickupsForDrive(2, 0, 0));
  });

  it('a stretch keeps its pickups where they are, whichever drive the field is showing', () => {
    const round = (y: number): number => Math.round(y * 1e6) / 1e6;
    const stretch = (seed: number, index: number, from: number) =>
      pickupsForDrive(seed, 0, index)
        .filter((p) => p.y >= from && p.y < from + 10)
        .map((p) => ({ ...p, y: round(p.y - from) }));
    for (let seed = 1; seed <= 60; seed++) {
      for (let index = 0; index < 3; index++) {
        // Seen one drive ahead, then two, as from the drive before.
        expect(stretch(seed, index + 1, 0), `seed ${seed}`).toEqual(stretch(seed, index, 10));
        expect(stretch(seed, index + 1, 10), `seed ${seed}`).toEqual(stretch(seed, index, 20));
      }
    }
  });

  it('lie out of the middle lane, in from the sidelines, and clear of every prop, a Boss included', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const props = drivePropsWithBoss(seed, 0, 3, 'misterFrog');
      for (const p of pickupsForDrive(seed, 0, 3)) {
        expect(Math.abs(p.x) - tuning.radius).toBeGreaterThanOrEqual(tuning.center - 1e-9);
        expect(Math.abs(p.x) + tuning.radius).toBeLessThanOrEqual(
          field.halfWidth - tuning.edge + 1e-9,
        );
        for (const prop of props) {
          expect(dist(v(p.x, p.y), v(prop.x, prop.y))).toBeGreaterThanOrEqual(
            prop.radius + tuning.radius + tuning.gap - 1e-9,
          );
        }
      }
    }
  });

  it("a run starts with its first drive's pickups on the field; practice has none", () => {
    const s = createRun(4);
    expect(s.field.pickups).toEqual(pickupsForDrive(4, 0, 0));
    expect(s.field.pickups.length).toBeGreaterThan(0);
    const play = PLAY_POOL[0] as Play;
    expect(createRun(4, undefined, 0, { practice: play }).field.pickups).toEqual([]);
  });
});
