import { describe, expect, it } from 'vitest';
import { applyGains } from '../../src/arcade/sim/growth';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import type { RunState } from '../../src/arcade/sim/types';
import { nameTags } from '../../src/arcade/ui/nameTags';
import {
  keptSelection,
  routeLook,
  selectedCard,
  slotAt,
  tapSelect,
  teamPoints,
} from '../../src/arcade/ui/select';
import { trickOrTreatView } from '../../src/arcade/ui/trickOrTreat';

/**
 * Selecting a player and the names switch (docs/SELECT.md, tests 1-6):
 * before the snap, a tap on one of your seven selects them (kept as their
 * roster slot), lights their route, dims the rest and shows their card.
 */

/** A run before its first snap, with the first card called. */
const called = (): RunState => dispatch(createRun(1), { type: 'call', hand: 0 }).state;

/** Where each body stands, as a "screen": x and y straight from the field (the test's own projection). */
const flat = (s: RunState) => teamPoints(s, (pos) => ({ x: pos.x, y: pos.y }));

describe('names and the switch (1)', () => {
  it('the switch on: all seven, none selected', () => {
    const tags = nameTags(createRun(1), { names: true, selected: null });
    expect(tags).toHaveLength(7);
    expect(tags.every((t) => !t.selected)).toBe(true);
  });

  it('the switch off: none, unless one is selected, whose name shows marked', () => {
    const s = createRun(1);
    expect(nameTags(s, { names: false, selected: null })).toEqual([]);
    const one = nameTags(s, { names: false, selected: 3 });
    expect(one.map((t) => [t.name, t.selected])).toEqual([[s.roster[3]!.name, true]]);
    const all = nameTags(s, { names: true, selected: 3 });
    expect(all.filter((t) => t.selected).map((t) => t.name)).toEqual([s.roster[3]!.name]);
    expect(all).toHaveLength(7);
  });

  it('after HIKE!, nothing, selected or not', () => {
    const hiked = dispatch(called(), { type: 'hike' }).state;
    expect(nameTags(hiked, { names: true, selected: 3 })).toEqual([]);
  });
});

describe('the hit test (2)', () => {
  it('picks the nearest of your seven within reach, by roster slot', () => {
    const s = createRun(1);
    const points = flat(s);
    const body = s.field.players.find((p) => p.slot === 5)!;
    expect(slotAt(points, { x: body.pos.x + 0.3, y: body.pos.y - 0.2 }, 1)).toBe(5);
  });

  it('nothing for a tap out of reach of all of them', () => {
    const s = createRun(1);
    expect(slotAt(flat(s), { x: 0, y: s.series.los + 40 }, 1)).toBeNull();
  });

  it('Jack and the defense are never among the points', () => {
    const s = createRun(1);
    const points = flat(s);
    expect(points.map((p) => p.slot).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const jack = s.field.players.find((p) => p.role === 'qb')!;
    const near = slotAt(points, jack.pos, 0.5);
    expect(near).toBeNull();
  });
});

describe('a tap (3)', () => {
  it('selects; the same again clears; another moves it; nothing clears', () => {
    expect(tapSelect(null, 2)).toBe(2);
    expect(tapSelect(2, 2)).toBeNull();
    expect(tapSelect(2, 4)).toBe(4);
    expect(tapSelect(4, null)).toBeNull();
  });
});

describe('keeping the selection (4)', () => {
  it('through calling another card and Flip: the same roster player', () => {
    const s = createRun(1);
    expect(keptSelection(s, 4)).toBe(4);
    const one = dispatch(s, { type: 'call', hand: 0 }).state;
    const other = dispatch(one, { type: 'call', hand: 1 }).state;
    const flipped = dispatch(other, { type: 'flip' }).state;
    for (const t of [one, other, flipped]) {
      expect(keptSelection(t, 4)).toBe(4);
      expect(nameTags(t, { names: false, selected: 4 })[0]!.name).toBe(s.roster[4]!.name);
    }
  });

  it('gone once the ball is snapped', () => {
    const hiked = dispatch(called(), { type: 'hike' }).state;
    expect(keptSelection(hiked, 4)).toBeNull();
  });
});

describe('routes (5)', () => {
  it('nobody selected: every route as today', () => {
    expect([0, 3, 6].map((slot) => routeLook(slot, null))).toEqual(['plain', 'plain', 'plain']);
  });

  it('one selected: theirs bright, the rest dim', () => {
    expect([0, 3, 6].map((slot) => routeLook(slot, 3))).toEqual(['dim', 'bright', 'dim']);
  });
});

describe('the card (6)', () => {
  it("is Your team's card for that player: name, kind, position, bars with the key stat and the gains", () => {
    const s = createRun(1);
    const runnerSlot = s.field.players.find((p) => p.role === 'runner')!.slot;
    applyGains(s, [{ slot: runnerSlot, stat: 'hustle', by: 12 }], []);
    const card = selectedCard(s, runnerSlot)!;
    expect(card.name).toBe(s.roster[runnerSlot]!.name);
    expect(card.form).toBe('Human');
    expect(card.position).toBe('Runner');
    const hustle = card.stats.find((b) => b.label === 'Hustle')!;
    expect(hustle.key).toBe(true);
    expect(hustle.delta).toBe(12);
    // The same bars as Your team draws for that player.
    s.phase = 'draft';
    s.offer = [];
    const row = trickOrTreatView(s, null).roster.find((r) => r.spot === runnerSlot)!;
    expect(card.stats).toEqual(row.stats);
    expect(card.icon).toBe(row.icon);
  });

  it('nobody selected, no card', () => {
    expect(selectedCard(createRun(1), null)).toBeNull();
  });
});
