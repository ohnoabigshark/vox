import { describe, expect, it } from 'vitest';
import { CANDY_KINGDOM, FARM, FOREST, type ArcadeArea } from '../../src/arcade/content/defense';
import { createRun } from '../../src/arcade/sim/run';
import { v } from '../../src/arcade/sim/vec';
import { run, stand } from './helpers';

/**
 * Two Owls in every Forest stretch (docs/DIFFICULTY.md, "The long field";
 * difficulty map https://claude.ai/artifact/QA9UrG4Tammp58npg1uP7v, f3 and
 * t3): one each side, as the Candy Queendom's and the Farm's Safeties stand.
 */

const stretches = (a: ArcadeArea) => [a.intro, a.challenge, a.gimmick, a.boss];
const safeties = (a: ArcadeArea) =>
  stretches(a).map((s) => s.defenders.filter((d) => d.kind === 'safety'));

describe('two Owls in the Forest', () => {
  it('1: every Forest stretch lines up two Safeties, at −3.5 and 3.5, 12 deep', () => {
    for (const owls of safeties(FOREST)) {
      expect(owls).toEqual([
        { kind: 'safety', x: -3.5, y: 12 },
        { kind: 'safety', x: 3.5, y: 12 },
      ]);
    }
    // One more defender each: the Clearing 5, Gnome Country 6, Bat Cave 7, the Pond 9.
    expect(stretches(FOREST).map((s) => s.defenders.length)).toEqual([5, 6, 7, 9]);
  });

  it('1b: on the field, each Owl shadows the deepest player on its own half', () => {
    const s = createRun(1);
    const owls = s.field.defenders.filter((d) => d.kind === 'safety');
    expect(owls).toHaveLength(2);
    const [left, right] = [...owls].sort((a, b) => a.home.x - b.home.x);
    const others = s.field.players.filter((p) => p.role !== 'qb');
    // The deepest on the left half at x −5, on the right at x 6.
    others.forEach((p, i) => {
      p.pos = v(i % 2 === 0 ? -5 : 6, 2 + i * 0.1);
      p.job = stand(p.pos);
    });
    s.phase = 'play';
    const after = run(s, 60).state.field.defenders;
    expect(after.find((d) => d.id === left!.id)!.pos.x).toBeCloseTo(-5, 0);
    expect(after.find((d) => d.id === right!.id)!.pos.x).toBeCloseTo(6, 0);
  });

  it('2: the Candy Queendom’s and the Farm’s defenses are unchanged', () => {
    for (const area of [CANDY_KINGDOM, FARM]) {
      for (const owls of safeties(area)) {
        expect(owls.map((d) => d.x)).toEqual([-3.5, 3.5]);
      }
    }
    expect(stretches(CANDY_KINGDOM).map((s) => s.defenders.length)).toEqual(CANDY_COUNTS_BEFORE_F3);
    expect(stretches(FARM).map((s) => s.defenders.length)).toEqual(FARM_COUNTS_BEFORE_F3);
  });
});

/** Recorded from main at 347e6e4, before f3. */
const CANDY_COUNTS_BEFORE_F3 = [5, 6, 6, 9];
const FARM_COUNTS_BEFORE_F3 = [5, 7, 8, 9];
