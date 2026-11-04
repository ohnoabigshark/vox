import { describe, expect, it } from 'vitest';
import {
  DownWatch,
  LONG_PLAY,
  byStretch,
  isLong,
  seriesSpread,
  stops,
} from '../../tools/balanceCount';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, playState, stand } from '../arcade/helpers';

/**
 * The balance tool's counts for long plays (docs/DIFFICULTY.md, "The long
 * field", t1): fed made-up steps, the states before and after and their events.
 */

/** A down in play from `los` in `area`'s `stretch`, one of yours (id 2) carrying at `at`. */
function down(
  { area = 0, stretch = 0, los = 0 } = {},
  at = v(0, los + 2),
  defenders: Parameters<typeof playState>[1] = [],
): RunState {
  const s = carry(playState([{ pos: at, job: stand(at) }], defenders), 2);
  s.series = { ...s.series, area, stretch, los };
  return s;
}

/** Feed one step: the same state before and after, these events. */
const feed = (w: DownWatch, s: RunState, events: ArcadeEvent[]): void => w.step(s, s, events);

describe('balance counts for the long field', () => {
  it('1: a down gaining 20 or more is a long play, with how it ended, run or pass, and its area', () => {
    const w = new DownWatch();
    const s = down({ area: 1, stretch: 1, los: 12 }, v(0, 14), [{ kind: 'safety', pos: v(0, 40) }]);
    feed(w, s, [{ type: 'handoff', id: 2 }]);
    feed(w, s, [
      { type: 'tackled', id: 2, by: 100 },
      { type: 'downEnded', result: 'firstDown', gained: 24 },
    ]);
    // A 19-yard pass: not long.
    feed(w, s, [{ type: 'thrown', target: v(0, 30), landsAt: 1 }]);
    feed(w, s, [{ type: 'downEnded', result: 'firstDown', gained: LONG_PLAY - 1 }]);

    expect(w.downs).toEqual([
      expect.objectContaining({
        kind: 'rush',
        area: 1,
        result: 'firstDown',
        gained: 24,
        stoppedBy: 'safety',
      }),
      expect.objectContaining({ kind: 'pass', gained: 19, stoppedBy: null }),
    ]);
    expect(w.downs.map(isLong)).toEqual([true, false]);
  });

  it('2: each tackle counts for its tackler’s kind, on all downs and on long plays', () => {
    const w = new DownWatch();
    const s = down({}, v(0, 2), [
      { kind: 'zone', pos: v(0, 30) },
      { kind: 'bat', pos: v(3, 30) },
    ]);
    feed(w, s, [
      { type: 'tackled', id: 2, by: 100 },
      { type: 'downEnded', result: 'firstDown', gained: 25 },
    ]);
    feed(w, s, [
      { type: 'tackled', id: 2, by: 101 },
      { type: 'downEnded', result: 'tackled', gained: 3 },
    ]);
    feed(w, s, [{ type: 'sacked' }, { type: 'downEnded', result: 'sacked', gained: -2 }]);
    feed(w, s, [
      { type: 'outOfBounds', id: 2 },
      { type: 'downEnded', result: 'outOfBounds', gained: 4 },
    ]);
    feed(w, s, [
      { type: 'eventTackled', id: 2, call: 'FROGGED!' },
      { type: 'downEnded', result: 'tackled', gained: 1 },
    ]);

    expect(stops(w.downs)).toEqual(
      new Map([
        ['zone', 1],
        ['bat', 1],
        ['sack', 1],
        ['outOfBounds', 1],
        ['event', 1],
      ]),
    );
    expect(stops(w.downs.filter(isLong))).toEqual(new Map([['zone', 1]]));
  });

  it('3: a touchdown counts for the stretch of its line of scrimmage', () => {
    const w = new DownWatch();
    feed(w, down({ stretch: 1, los: 14 }), [
      { type: 'downEnded', result: 'touchdown', gained: 26 },
    ]);
    feed(w, down({ stretch: 3, los: 33 }), [{ type: 'downEnded', result: 'touchdown', gained: 7 }]);
    feed(w, down({ stretch: 1, los: 11 }), [{ type: 'downEnded', result: 'tackled', gained: 3 }]);
    feed(w, down({ stretch: 1, los: 18 }), [
      { type: 'downEnded', result: 'touchdown', gained: 22 },
    ]);
    expect(byStretch(w.downs.filter((d) => d.result === 'touchdown'))).toEqual(
      new Map([
        [1, 2],
        [3, 1],
      ]),
    );
  });

  it('4: the yards a carrier runs after the last defender in front of them is passed', () => {
    const w = new DownWatch();
    // At 18, an Owl still ahead at 22: not clear yet.
    const s = down({}, v(0, 18), [
      { kind: 'safety', pos: v(0, 22) },
      { kind: 'cover', pos: v(2, 10) },
    ]);
    feed(w, s, []);
    // Past it at 25: clear from there.
    s.field.players.find((p) => p.id === 2)!.pos = v(0, 25);
    feed(w, s, []);
    // Still clear later: it counts from where they first got clear.
    s.field.players.find((p) => p.id === 2)!.pos = v(0, 31);
    feed(w, s, []);
    feed(w, s, [{ type: 'downEnded', result: 'touchdown', gained: 40 }]);
    // Never clear: null.
    const t = down({}, v(0, 5), [{ kind: 'safety', pos: v(0, 20) }]);
    feed(w, t, [{ type: 'downEnded', result: 'tackled', gained: 6 }]);

    expect(w.downs.map((d) => d.pastLast)).toEqual([15, null]);
  });

  it('4b: a carrier still on the field after the down has ended doesn’t count toward the next down', () => {
    const w = new DownWatch();
    // A touchdown: the scorer stays in the end zone, nobody ahead, while the result shows.
    const scored = down({}, v(0, 40), [{ kind: 'safety', pos: v(0, 30) }]);
    scored.phase = 'play';
    feed(w, scored, [{ type: 'downEnded', result: 'touchdown', gained: 40 }]);
    scored.phase = 'downOver';
    feed(w, scored, []);
    // The next down never gets clear.
    const next = down({}, v(0, 3), [{ kind: 'safety', pos: v(0, 14) }]);
    next.phase = 'play';
    feed(w, next, [{ type: 'downEnded', result: 'tackled', gained: 5 }]);
    // Clear on the goal line as it scored: 0 yards after; the next, never clear.
    expect(w.downs.map((d) => d.pastLast)).toEqual([0, null]);
  });

  it('5: series won spread: the worst tenth, the median, the top tenth and the best', () => {
    const perRun = [7, 2, 9, 4, 12, 5, 6, 3, 8, 10];
    expect(seriesSpread(perRun)).toEqual({ p10: 3, median: 7, p90: 12, best: 12 });
    expect(seriesSpread([])).toEqual({ p10: 0, median: 0, p90: 0, best: 0 });
  });
});
