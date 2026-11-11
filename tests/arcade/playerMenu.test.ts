import { describe, expect, it } from 'vitest';
import { RUN_DEFAULTS, readLink, runOptionsFor } from '../../src/arcade/content/runOptions';
import { SETUP_KEY, setupStore } from '../../src/arcade/content/savedSetup';
import { PLAYS } from '../../src/arcade/content/plays';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import { startingRoster } from '../../src/arcade/sim/team';
import type { RunState } from '../../src/arcade/sim/types';
import { keptSelection, selectionAfter } from '../../src/arcade/ui/select';
import { playerMenu } from '../../src/arcade/ui/playerMenu';

/** docs/PLAYER_MENU.md, the `player-menu` tests (the menu's map, c2), as `menu-routes` left them: no switch. */

const nothing = { kind: 'nothing' } as const;

describe('every run has it (menu-routes)', () => {
  it('there is no Player menu switch any more', () => {
    expect(Object.keys(RUN_DEFAULTS)).not.toContain('playerMenu');
  });

  it('an old link’s menu=1 or menu=0 is ignored: the run is the same', () => {
    for (const q of ['menu=1', 'menu=0']) {
      const run = readLink(new URLSearchParams(q)).run;
      expect(run, q).toEqual({});
      expect(runOptionsFor(run, nothing, false), q).toEqual(RUN_DEFAULTS);
    }
  });

  it('a saved setup that still has it plays the rest, with nothing said about it', async () => {
    const data = new Map([[SETUP_KEY, JSON.stringify({ playerMenu: true, hard: false })]]);
    const store = setupStore({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    });
    expect(await store.read()).toEqual({ kind: 'saved', setup: { hard: false }, warnings: [] });
  });
});

describe('when the strip shows (test 2)', () => {
  const called = dispatch(createRun(1), { type: 'call', hand: 0 }).state;
  /** The strip after this input, through the function the game calls for ✕ and for a tap on the field. */
  const after = (selected: number | null, input: Parameters<typeof selectionAfter>[1]) =>
    playerMenu(called, keptSelection(called, selectionAfter(selected, input)));

  it('a tap on one of your seven shows it', () => {
    expect(after(null, { kind: 'tap', hit: 3 })).not.toBeNull();
  });

  it('✕ on the card clears it', () => {
    expect(after(3, { kind: 'close' })).toBeNull();
  });

  it('a tap on empty field, or on the same player again, clears it', () => {
    expect(after(3, { kind: 'tap', hit: null })).toBeNull();
    expect(after(3, { kind: 'tap', hit: 3 })).toBeNull();
  });

  it('a tap on another player moves it to them', () => {
    expect(selectionAfter(3, { kind: 'tap', hit: 5 })).toBe(5);
    expect(after(3, { kind: 'tap', hit: 5 })).not.toBeNull();
  });

  it('with one of your seven selected before the snap', () => {
    expect(playerMenu(called, keptSelection(called, 3))).not.toBeNull();
  });

  it('not with nobody selected (✕ or a tap elsewhere clears the selection)', () => {
    expect(playerMenu(called, keptSelection(called, null))).toBeNull();
  });

  it('not after HIKE!, which clears the selection', () => {
    const hiked = dispatch(called, { type: 'hike' }).state;
    expect(playerMenu(hiked, keptSelection(hiked, 3))).toBeNull();
  });
});

describe('what it holds (test 3)', () => {
  it('Route, Perk and Audible; Perk and Audible greyed', () => {
    const slots = playerMenu(slantsCalled(), 4)?.slots;
    expect(slots?.map((s) => s.slot)).toEqual(['route', 'perk', 'audible']);
    expect(slots?.filter((s) => s.works).map((s) => s.slot)).toEqual(['route']);
  });

  it('Route greyed for a Blocker, and for everyone before a card is called (c3 test 1)', () => {
    const works = (s: RunState, slot: number) => playerMenu(s, slot)?.slots.map((m) => m.works);
    expect(works(slantsCalled(), 0)).toEqual([false, false, false]);
    const dealt = createRun(1, startingRoster(), 0, { playbook: [PLAYS[0]!] });
    expect(works(dealt, 4)).toEqual([false, false, false]);
  });
});

/** A run with a passing play called (Slants is the only card). */
function slantsCalled(): RunState {
  const s = createRun(1, startingRoster(), 0, { playbook: [PLAYS[0]!] });
  return dispatch(s, { type: 'call', hand: 0 }).state;
}
