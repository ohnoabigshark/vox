import { describe, expect, it } from 'vitest';
import {
  RUN_DEFAULTS,
  linkFor,
  readLink,
  runOptionsFor,
  runOptionsFrom,
  runSwitches,
} from '../../src/arcade/content/runOptions';
import { isPracticeLink } from '../../src/arcade/content/eventLink';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import { startingRoster } from '../../src/arcade/sim/team';
import { keptSelection } from '../../src/arcade/ui/select';
import { playerMenu } from '../../src/arcade/ui/playerMenu';

/** docs/PLAYER_MENU.md, the `player-menu` tests (the menu's map, c2). */

const saved = { kind: 'saved', setup: { playerMenu: true }, warnings: [] } as const;
const nothing = { kind: 'nothing' } as const;
/** The run options a page plays with this query, on a phone with Player menu saved on. */
const played = (query: string) => {
  const params = new URLSearchParams(query);
  return runOptionsFor(readLink(params).run, saved, isPracticeLink(`?${query}`));
};

describe('the switch (test 1)', () => {
  it('Player menu is off by default', () => {
    expect(RUN_DEFAULTS.playerMenu).toBe(false);
    expect(runOptionsFor({}, nothing, false).playerMenu).toBe(false);
  });

  it('a link turns it on with menu=1 or on, and off with menu=0 or off', () => {
    const menu = (q: string) => readLink(new URLSearchParams(q)).run.playerMenu;
    expect(menu('menu=1')).toBe(true);
    expect(menu('menu=on')).toBe(true);
    expect(menu('menu=0')).toBe(false);
    expect(menu('menu=off')).toBe(false);
    expect(menu('')).toBeUndefined();
  });

  it('the link over the saved setup over the defaults', () => {
    expect(runOptionsFor({}, saved, false).playerMenu).toBe(true);
    expect(played('menu=0').playerMenu).toBe(false);
    expect(played('').playerMenu).toBe(true);
  });

  it('Copy link writes it, and reads it back', () => {
    for (const on of [true, false]) {
      const query = linkFor({ ...RUN_DEFAULTS, playerMenu: on });
      expect(query).toContain(`menu=${on ? 1 : 0}`);
      expect(readLink(new URLSearchParams(query)).run.playerMenu).toBe(on);
    }
  });

  it('practice ignores a saved one, as it ignores the rest of the setup', () => {
    expect(played('try=abc').playerMenu).toBe(false);
    expect(played('event=frogRain').playerMenu).toBe(false);
  });
});

describe('when the strip shows (test 2)', () => {
  const called = dispatch(createRun(1), { type: 'call', hand: 0 }).state;

  it('with the switch on and one of your seven selected before the snap', () => {
    expect(playerMenu(true, keptSelection(called, 3))).not.toBeNull();
  });

  it('not with nobody selected (✕ or a tap elsewhere clears the selection)', () => {
    expect(playerMenu(true, keptSelection(called, null))).toBeNull();
  });

  it('not after HIKE!, which clears the selection', () => {
    const hiked = dispatch(called, { type: 'hike' }).state;
    expect(playerMenu(true, keptSelection(hiked, 3))).toBeNull();
  });

  it('never with the switch off', () => {
    expect(playerMenu(false, keptSelection(called, 3))).toBeNull();
    expect(playerMenu(false, null)).toBeNull();
  });
});

describe('what it holds (test 3)', () => {
  it('Route, Perk and Audible, all greyed in this slice', () => {
    expect(playerMenu(true, 3)).toEqual({
      slots: [
        { name: 'Route', works: false },
        { name: 'Perk', works: false },
        { name: 'Audible', works: false },
      ],
    });
  });
});

describe('nothing plays differently (test 4)', () => {
  it('the switch never reaches the game: the sim is made with the same switches, on or off', () => {
    const on = runSwitches(runOptionsFrom({ playerMenu: true }));
    expect(on).toEqual(runSwitches(RUN_DEFAULTS));
    expect(Object.keys(on)).not.toContain('playerMenu');
  });

  it('the same run either way', () => {
    const run = (playerMenu: boolean) =>
      createRun(7, startingRoster(), 0, runSwitches(runOptionsFrom({ playerMenu })));
    expect(JSON.stringify(run(true))).toBe(JSON.stringify(run(false)));
  });
});
