import { describe, expect, it } from 'vitest';
import {
  RUN_DEFAULTS,
  readLink,
  runOptionsFrom,
  runSwitches,
} from '../../src/arcade/content/runOptions';
import { createRun } from '../../src/arcade/sim/run';
import { noPerks } from '../../src/arcade/sim/team';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import type { Play } from '../../src/arcade/content/plays';
import { FROG_RAIN } from '../../src/arcade/content/fieldEvents';

/** docs/DEV_SETUP.md, the `run-options` tests (next-job map d7). */

/** The run options a link plays, written as text. */
const played = (query: string) => runOptionsFrom(readLink(new URLSearchParams(query)).run);

describe('the defaults file (test 1)', () => {
  it('names every switch: hard mode and two-tap on, area 1, a random seed, SNAG IT! and the tip drill Normal, every Break it! kind, pickups and field events on, perks and monsters off', () => {
    expect(RUN_DEFAULTS).toEqual({
      seed: null,
      area: 1,
      hard: true,
      twoTapAim: true,
      snagIt: 'normal',
      tipDrill: 'normal',
      breakItKinds: ['bar', 'mash', 'juke'],
      pickupsOn: true,
      fieldEventsOn: true,
      startWithPerks: false,
      monsters: false,
    });
  });
});

// Each flag main.ts read before run options (src/main.ts at e83e780), and what it played.
describe("today's links read the same (test 2)", () => {
  it('a link that says nothing plays the defaults', () => {
    expect(readLink(new URLSearchParams(''))).toEqual({
      run: {},
      win: false,
      video: false,
      farmSong: 1,
    });
    expect(played('')).toEqual(RUN_DEFAULTS);
  });

  it('each run option flag plays what it played', () => {
    const cases: [string, Partial<typeof RUN_DEFAULTS>][] = [
      ['?hard=0', { hard: false }],
      ['?aim=1', { twoTapAim: false }],
      ['?hard=0&aim=1', { hard: false, twoTapAim: false }],
      ['?area=3', { area: 3 }],
      ['?seed=5', { seed: 5 }],
      ['?snag=1', { snagIt: 'always' }],
      ['?tip=1', { tipDrill: 'always' }],
      ['?perks=1', { startWithPerks: true }],
      ['?monsters', { monsters: true }],
      ['?monsters=1', { monsters: true }],
      ['?seed=7&hard=0&snag=1&aim=1', { seed: 7, hard: false, snagIt: 'always', twoTapAim: false }],
    ];
    for (const [query, named] of cases) {
      expect(readLink(new URLSearchParams(query)).run, query).toEqual(named);
      expect(played(query), query).toEqual({ ...RUN_DEFAULTS, ...named });
    }
  });

  it('a value it does not know leaves the default, as before', () => {
    for (const query of [
      '?hard=yes&aim=3',
      '?hard&aim=',
      '?hard=1&aim=2', // the old links (release map b2)
      '?seed=abc&area=0&snag=2&tip=yes&perks=0',
    ]) {
      expect(played(query), query).toEqual(RUN_DEFAULTS);
    }
  });

  it('the link-only flags: the win cutscene, its video, the Farm song', () => {
    expect(readLink(new URLSearchParams('?win=1&video=1&farmSong=2'))).toEqual({
      run: {},
      win: true,
      video: true,
      farmSong: 2,
    });
    expect(readLink(new URLSearchParams('?win&farmSong=x')).win).toBe(true);
    expect(readLink(new URLSearchParams('?win&farmSong=x')).farmSong).toBe(1);
  });

  it('a practice link plays the throw its aim says, two-tap with none', () => {
    expect(played('?try=%7B%7D&sketch=s1').twoTapAim).toBe(true);
    expect(played('?try=%7B%7D&sketch=s1&aim=2').twoTapAim).toBe(true);
    expect(played('?try=%7B%7D&sketch=s1&aim=1').twoTapAim).toBe(false);
  });
});

describe('one set of defaults (test 3)', () => {
  it('a run made with no options plays the defaults file', () => {
    const s = createRun(4);
    expect({
      hard: s.hard,
      twoTapAim: s.twoTapAim,
      snagIt: s.snagIt,
      tipDrill: s.tipDrill,
      breakItKinds: s.breakItKinds,
      pickupsOn: s.pickupsOn,
      fieldEventsOn: s.fieldEventsOn,
    }).toEqual({
      hard: RUN_DEFAULTS.hard,
      twoTapAim: RUN_DEFAULTS.twoTapAim,
      snagIt: RUN_DEFAULTS.snagIt,
      tipDrill: RUN_DEFAULTS.tipDrill,
      breakItKinds: RUN_DEFAULTS.breakItKinds,
      pickupsOn: RUN_DEFAULTS.pickupsOn,
      fieldEventsOn: RUN_DEFAULTS.fieldEventsOn,
    });
    expect(s.hard).toBe(true);
    expect(s.twoTapAim).toBe(true);
    expect(s.perks).toEqual(noPerks());
  });

  it('a run made with the defaults spelled out is the same run', () => {
    const switches = runSwitches(RUN_DEFAULTS);
    expect(createRun(4)).toEqual(createRun(4, undefined, 0, switches));
  });
});

describe('practice ignores the run options it is not made for (d5, decision map t3)', () => {
  const play = PLAY_POOL[0] as Play;
  const withEvery = {
    hard: true,
    snagIt: 'always',
    tipDrill: 'always',
    startWithPerks: true,
  } as const;

  it('play practice is never hard mode and holds no perks, whatever it is given', () => {
    const s = createRun(4, undefined, 0, { ...withEvery, practice: play });
    expect(s.hard).toBe(false);
    expect(s.perks).toEqual(noPerks());
  });

  it('event practice too', () => {
    const s = createRun(4, undefined, 0, {
      ...withEvery,
      eventPractice: { event: FROG_RAIN, stretch: 2 },
    });
    expect(s.hard).toBe(false);
    expect(s.perks).toEqual(noPerks());
  });

  it('a practice run made with no options is the original game, not the defaults', () => {
    expect(createRun(4, undefined, 0, { practice: play }).hard).toBe(false);
  });
});
