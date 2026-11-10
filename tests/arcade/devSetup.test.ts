import { describe, expect, it } from 'vitest';
import {
  BREAK_KINDS,
  RUN_DEFAULTS,
  type RunOptions,
  changedSwitches,
  linkFor,
  readLink,
  runOptionsFor,
  runSwitches,
} from '../../src/arcade/content/runOptions';
import { SETUP_KEY, setupNotices, setupStore } from '../../src/arcade/content/savedSetup';
import { isPracticeLink } from '../../src/arcade/content/eventLink';
import {
  createRun,
  setUpSeries,
  stretchAt,
  stretchKind,
  stretchStart,
} from '../../src/arcade/sim/run';
import { startBreakIt } from '../../src/arcade/sim/breakit';
import { catchTestFor } from '../../src/arcade/sim/catchTests';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import type { Play } from '../../src/arcade/content/plays';
import { FROG_RAIN } from '../../src/arcade/content/fieldEvents';
import type { RunState } from '../../src/arcade/sim/types';
import { ORIGINAL_GAME, playState } from './helpers';
import { onSeries } from './contests';

/** docs/DEV_SETUP.md, the `dev-setup` tests (next-job map d8). */

/** A storage that keeps what it's given, as localStorage does. */
function memoryStorage(start: Record<string, string> = {}) {
  const items = new Map(Object.entries(start));
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

/** A storage that throws on every read, as a blocked localStorage does. */
const blockedStorage = {
  getItem: (): never => {
    throw new Error('localStorage is unavailable');
  },
  setItem: (): never => {
    throw new Error('localStorage is unavailable');
  },
  removeItem: (): never => {
    throw new Error('localStorage is unavailable');
  },
};

/** A setup that changes every switch from its default. */
const EVERY_CHANGED: RunOptions = {
  seed: 42,
  area: 3,
  hard: false,
  twoTapAim: false,
  snagIt: 'off',
  tipDrill: 'always',
  breakItKinds: ['mash'],
  pickupsOn: false,
  fieldEvents: 'willOWisps',
  startWithPerks: true,
  monsters: true,
};

describe('saving (test 1)', () => {
  it('a setup saves and loads', async () => {
    const storage = memoryStorage();
    const store = setupStore(storage);
    await store.save({ hard: false, snagIt: 'always', breakItKinds: ['bar', 'juke'] });
    expect(await store.read()).toEqual({
      kind: 'saved',
      setup: { hard: false, snagIt: 'always', breakItKinds: ['bar', 'juke'] },
      warnings: [],
    });
  });

  it('keeps only what differs from the defaults', async () => {
    const storage = memoryStorage();
    await setupStore(storage).save({ ...RUN_DEFAULTS, area: 2 });
    expect(JSON.parse(storage.items.get(SETUP_KEY) ?? 'null')).toEqual({ area: 2 });
  });

  it('every switch changed saves and loads', async () => {
    const store = setupStore(memoryStorage());
    await store.save(EVERY_CHANGED);
    expect(await store.read()).toEqual({ kind: 'saved', setup: EVERY_CHANGED, warnings: [] });
  });

  it('empty storage reads as nothing saved', async () => {
    expect(await setupStore(memoryStorage()).read()).toEqual({ kind: 'nothing' });
  });

  it("storage that can't be read says why; the game plays the defaults", async () => {
    const read = await setupStore(blockedStorage).read();
    expect(read).toEqual({ kind: 'unreadable', reason: 'localStorage is unavailable' });
    expect(runOptionsFor({}, read, false)).toEqual(RUN_DEFAULTS);
  });

  it('what is stored but is not a setup is unreadable, and left as it is', async () => {
    const storage = memoryStorage({ [SETUP_KEY]: '{not json' });
    const read = await setupStore(storage).read();
    expect(read).toEqual({
      kind: 'unreadable',
      reason: expect.stringMatching(/^The dev setup isn’t JSON \(.+\)\.$/),
    });
    expect(storage.items.get(SETUP_KEY)).toBe('{not json');
    const notAnObject = await setupStore(memoryStorage({ [SETUP_KEY]: '[1, 2]' })).read();
    expect(notAnObject).toEqual({
      kind: 'unreadable',
      reason: 'The dev setup isn’t a set of switches.',
    });
  });

  it('a bad or unknown value is left out with a warning naming it', async () => {
    const storage = memoryStorage({
      [SETUP_KEY]: JSON.stringify({
        hard: false,
        area: 9,
        snagIt: 'sometimes',
        breakItKinds: [],
        fieldEvents: 'frogRain',
        pickupsOn: 'yes',
        jackSpeed: 3,
      }),
    });
    const read = await setupStore(storage).read();
    expect(read).toEqual({
      kind: 'saved',
      setup: { hard: false },
      warnings: [
        'The dev setup’s area (9) isn’t one it knows, so it was left out.',
        'The dev setup’s snagIt ("sometimes") isn’t one it knows, so it was left out.',
        'The dev setup’s breakItKinds ([]) isn’t one it knows, so it was left out.',
        'The dev setup’s fieldEvents ("frogRain") isn’t one it knows, so it was left out.',
        'The dev setup’s pickupsOn ("yes") isn’t one it knows, so it was left out.',
        'The dev setup has a switch called jackSpeed, which isn’t one, so it was left out.',
      ],
    });
  });

  it('clearing it leaves nothing saved', async () => {
    const store = setupStore(memoryStorage());
    await store.save({ hard: false });
    await store.clear();
    expect(await store.read()).toEqual({ kind: 'nothing' });
  });
});

describe('layers: the link over the saved setup over the defaults (test 2)', () => {
  // Each switch: a value a saved setup gives it, and a different one a link names.
  const cases: {
    [K in keyof RunOptions]: [saved: RunOptions[K], link: string, linked: RunOptions[K]];
  } = {
    seed: [11, 'seed=12', 12],
    area: [2, 'area=3', 3],
    hard: [false, 'hard=1', true],
    twoTapAim: [false, 'aim=2', true],
    snagIt: ['off', 'snag=always', 'always'],
    tipDrill: ['always', 'tip=off', 'off'],
    breakItKinds: [['bar'], 'breakit=mash,juke', ['mash', 'juke']],
    pickupsOn: [false, 'pickups=1', true],
    fieldEvents: ['off', 'events=taffyFlood', 'taffyFlood'],
    startWithPerks: [true, 'perks=0', false],
    monsters: [true, 'monsters=0', false],
  };
  for (const key of Object.keys(cases) as (keyof RunOptions)[]) {
    const [saved, query, linked] = cases[key];
    it(key, () => {
      const link = readLink(new URLSearchParams(query)).run;
      const setup = { kind: 'saved', setup: { [key]: saved }, warnings: [] } as const;
      const nothing = { kind: 'nothing' } as const;
      // Neither: the default. Saved only: the saved. The link: the link's, saved or not.
      expect(runOptionsFor({}, nothing, false)[key]).toEqual(RUN_DEFAULTS[key]);
      expect(runOptionsFor({}, setup, false)[key]).toEqual(saved);
      expect(runOptionsFor(link, nothing, false)[key]).toEqual(linked);
      expect(runOptionsFor(link, setup, false)[key]).toEqual(linked);
    });
  }

  it('a link sets the seed back to random over a saved one (review 1)', () => {
    const setup = { kind: 'saved', setup: { seed: 11 }, warnings: [] } as const;
    const link = readLink(new URLSearchParams('seed=random')).run;
    expect(link).toEqual({ seed: null });
    expect(runOptionsFor(link, setup, false).seed).toBeNull();
  });

  it('a link turns the monster team off with 0 or off, and on with anything else (review 2)', () => {
    const monsters = (query: string) => readLink(new URLSearchParams(query)).run.monsters;
    expect(monsters('monsters=0')).toBe(false);
    expect(monsters('monsters=off')).toBe(false);
    expect(monsters('monsters')).toBe(true);
    expect(monsters('monsters=1')).toBe(true);
    expect(monsters('monsters=yes')).toBe(true);
    expect(monsters('seed=3')).toBeUndefined();
  });

  it('a seed or area a saved setup would refuse, a link refuses too (review 4)', () => {
    for (const query of ['seed=1.5', 'seed=-3', 'seed=0', 'area=99', 'area=1.5', 'area=-1']) {
      expect(readLink(new URLSearchParams(query)).run, query).toEqual({});
    }
  });

  it('a link names one switch and the saved setup keeps the rest', () => {
    const setup = {
      kind: 'saved',
      setup: { hard: false, pickupsOn: false },
      warnings: [],
    } as const;
    const run = runOptionsFor(readLink(new URLSearchParams('hard=1')).run, setup, false);
    expect(run).toEqual({ ...RUN_DEFAULTS, hard: true, pickupsOn: false });
  });

  it('a link value it does not know names nothing, so the saved setup holds', () => {
    for (const query of [
      'snag=2',
      'breakit=',
      'breakit=bar,kick',
      'events=frogRain',
      'pickups=yes',
    ]) {
      expect(readLink(new URLSearchParams(query)).run, query).toEqual({});
    }
  });
});

describe('the tag counts what the setup changes (test 3)', () => {
  it('none for nothing saved, or a setup the same as the defaults', () => {
    expect(changedSwitches({})).toEqual([]);
    expect(changedSwitches(RUN_DEFAULTS)).toEqual([]);
    expect(changedSwitches({ breakItKinds: ['bar', 'mash', 'juke'] })).toEqual([]);
  });

  it('one for each switch that differs', () => {
    expect(changedSwitches({ hard: false, breakItKinds: ['bar'] })).toEqual([
      'hard',
      'breakItKinds',
    ]);
    expect(changedSwitches(EVERY_CHANGED)).toHaveLength(Object.keys(RUN_DEFAULTS).length);
  });
});

describe('Break it! kinds (test 4)', () => {
  /** The Break it! kinds dealt to a carrier grabbed at 60 different moments of a run made with these kinds. */
  const dealt = (kinds: RunOptions['breakItKinds']): Set<string> => {
    const seen = new Set<string>();
    for (let step = 0; step < 60; step++) {
      const s = playState([], [{ kind: 'rusher', pos: { x: 0, y: -3 } }]);
      Object.assign(s, { breakItKinds: kinds });
      s.step = step;
      const qb = s.field.players[0]!;
      startBreakIt(s, qb, [s.field.defenders[0]!.id]);
      seen.add(s.tackle!.kind);
    }
    return seen;
  };

  it('all three are dealt by default', () => {
    expect(dealt(RUN_DEFAULTS.breakItKinds)).toEqual(new Set(BREAK_KINDS));
  });

  it('one switched off is never dealt', () => {
    expect(dealt(['bar', 'juke'])).toEqual(new Set(['bar', 'juke']));
    expect(dealt(['mash'])).toEqual(new Set(['mash']));
  });

  it('a run takes its kinds from its options', () => {
    expect(createRun(1, undefined, 0, { breakItKinds: ['juke'] }).breakItKinds).toEqual(['juke']);
  });
});

describe('SNAG IT! and the tip drill (test 5)', () => {
  /** Which catch test a contested ball goes to, at 80 moments of this series, with these settings. */
  const goesTo = (
    series: number,
    snagIt: RunOptions['snagIt'],
    tipDrill: RunOptions['tipDrill'],
  ) => {
    const s: RunState = createRun(3, undefined, 0, { ...ORIGINAL_GAME, snagIt, tipDrill });
    onSeries(s, series);
    const seen: (string | null)[] = [];
    for (let step = 0; step < 80; step++) {
      s.step = step;
      seen.push(catchTestFor(s));
    }
    return seen;
  };

  it('Off: a contested ball never goes to it', () => {
    for (const series of [1, 5, 9, 13]) {
      expect(goesTo(series, 'off', 'normal')).not.toContain('snag');
      expect(goesTo(series, 'normal', 'off')).not.toContain('tip');
      expect(goesTo(series, 'off', 'always')).not.toContain('snag');
    }
  });

  it('both Off: no catch tests at all', () => {
    for (const series of [1, 5, 13])
      expect(new Set(goesTo(series, 'off', 'off'))).toEqual(new Set([null]));
  });

  it('Always: every contested ball from series 1 does', () => {
    for (const series of [1, 2, 5, 13]) {
      expect(new Set(goesTo(series, 'always', 'normal')), `snag ${series}`).toEqual(
        new Set(['snag']),
      );
      expect(new Set(goesTo(series, 'off', 'always')), `tip ${series}`).toEqual(new Set(['tip']));
    }
  });

  it('both Always: every contested ball goes to one of them, either at random (as ?snag=1&tip=1)', () => {
    expect(new Set(goesTo(1, 'always', 'always'))).toEqual(new Set(['snag', 'tip']));
  });

  it('Off leaves the other on Normal as it was: the same contested balls go to it (review)', () => {
    for (const series of [5, 9, 13]) {
      const both = goesTo(series, 'normal', 'normal');
      const snagOnly = goesTo(series, 'normal', 'off');
      const tipOnly = goesTo(series, 'off', 'normal');
      expect(snagOnly, `snag ${series}`).toEqual(both.map((t) => (t === 'snag' ? t : null)));
      expect(tipOnly, `tip ${series}`).toEqual(both.map((t) => (t === 'tip' ? t : null)));
    }
  });

  it('Normal: none before series 5, then some', () => {
    expect(new Set(goesTo(4, 'normal', 'normal'))).toEqual(new Set([null]));
    expect(goesTo(5, 'normal', 'normal').some((t) => t !== null)).toBe(true);
    expect(goesTo(5, 'normal', 'off').some((t) => t === 'snag')).toBe(true);
  });
});

describe('pickups off (test 6)', () => {
  it('no bolts or gravestones on the field, in any area', () => {
    for (const area of [0, 1, 2]) {
      expect(
        createRun(5, undefined, area, { pickupsOn: true }).field.pickups.length,
      ).toBeGreaterThan(0);
      const off = createRun(5, undefined, area, { pickupsOn: false });
      expect(off.field.pickups).toEqual([]);
      setUpSeries(off, area, stretchStart(2), [], true);
      expect(off.field.pickups).toEqual([]);
    }
  });
});

describe('field events (test 7)', () => {
  /** The field event on each of the first 12 stretches of a run with this seed and setting. */
  const events = (seed: number, fieldEvents: RunOptions['fieldEvents']) => {
    const s = createRun(seed, undefined, 0, { fieldEvents });
    return Array.from({ length: 12 }, (_, i) => {
      const at = stretchAt(i + 1);
      setUpSeries(s, at.area, stretchStart(at.stretch), [], true);
      return {
        boss: stretchKind(at.stretch) === 'boss',
        n: i + 1,
        event: s.field.fieldEvent?.event.id,
      };
    });
  };

  it('Off: none on ordinary stretches; Frog Rain stays Mister Frog’s', () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const e of events(seed, 'off')) {
        if (e.n === 4) expect(e.event).toBe('frogRain');
        else if (!e.boss) expect(e.event, `seed ${seed} stretch ${e.n}`).toBeUndefined();
      }
    }
  });

  it('one chosen: that event on every ordinary stretch; Frog Rain stays Mister Frog’s', () => {
    for (const chosen of ['taffyFlood', 'willOWisps'] as const) {
      for (const e of events(2, chosen)) {
        if (e.n === 4) expect(e.event).toBe('frogRain');
        else if (!e.boss) expect(e.event, `${chosen} stretch ${e.n}`).toBe(chosen);
      }
    }
  });

  it('Normal: the run is the one it was (some ordinary stretches have one, some don’t)', () => {
    const all = Array.from({ length: 6 }, (_, i) => events(i + 1, 'normal')).flat();
    const ordinary = all.filter((e) => !e.boss && e.n > 1);
    expect(ordinary.some((e) => e.event === undefined)).toBe(true);
    expect(ordinary.some((e) => e.event !== undefined)).toBe(true);
    expect(createRun(3)).toEqual(createRun(3, undefined, 0, { fieldEvents: 'normal' }));
  });
});

describe('which links are practice (test 8, review 11)', () => {
  it('the play editor’s ?try= and the event editor’s ?event=, nothing else', () => {
    expect(isPracticeLink('?try=abc&sketch=s1&aim=2')).toBe(true);
    expect(isPracticeLink('?event=abc&stretch=2')).toBe(true);
    expect(isPracticeLink('?try=')).toBe(true);
    expect(isPracticeLink('')).toBe(false);
    expect(isPracticeLink('?seed=3&hard=0&snag=always')).toBe(false);
  });
});

describe('what the game says about the setup (test 1, review 3)', () => {
  it('a setup it can’t read: a notice, and the defaults', () => {
    expect(
      setupNotices({ kind: 'unreadable', reason: 'localStorage is unavailable' }, false),
    ).toEqual(['The dev setup can’t be read: localStorage is unavailable; playing the defaults.']);
  });

  it('values left out: their warnings', () => {
    expect(setupNotices({ kind: 'saved', setup: {}, warnings: ['a', 'b'] }, false)).toEqual([
      'a',
      'b',
    ]);
    expect(setupNotices({ kind: 'nothing' }, false)).toEqual([]);
  });

  it('nothing in practice, which ignores the setup', () => {
    expect(setupNotices({ kind: 'unreadable', reason: 'x' }, true)).toEqual([]);
    expect(setupNotices({ kind: 'saved', setup: {}, warnings: ['a'] }, true)).toEqual([]);
  });
});

describe('practice is untouched (test 8)', () => {
  const setup = { kind: 'saved', setup: EVERY_CHANGED, warnings: [] } as const;
  const nothing = { kind: 'nothing' } as const;
  const play = PLAY_POOL[0] as Play;

  /** The run a practice link makes, given what's saved: as game.ts makes it. */
  const practiceRun = (
    query: string,
    read: typeof setup | typeof nothing,
    made: 'play' | 'event',
  ) => {
    const o = runOptionsFor(readLink(new URLSearchParams(query)).run, read, true);
    const switches = runSwitches(o);
    return createRun(
      9,
      undefined,
      0,
      made === 'play'
        ? { ...switches, practice: play }
        : { ...switches, eventPractice: { event: FROG_RAIN, stretch: 2 } },
    );
  };

  it('play practice makes the same run with a setup saved as without', () => {
    for (const query of ['try=x&sketch=s1&aim=2', 'try=x&sketch=s1&aim=1']) {
      expect(practiceRun(query, setup, 'play')).toEqual(practiceRun(query, nothing, 'play'));
    }
  });

  it('event practice too', () => {
    for (const query of ['event=x&stretch=2&aim=2', 'event=x&stretch=2&aim=1']) {
      expect(practiceRun(query, setup, 'event')).toEqual(practiceRun(query, nothing, 'event'));
    }
  });

  it('practice takes its link, and the defaults for the rest, not the setup', () => {
    const o = runOptionsFor(readLink(new URLSearchParams('try=x&aim=1&snag=1')).run, setup, true);
    expect(o).toEqual({ ...RUN_DEFAULTS, twoTapAim: false, snagIt: 'always' });
  });
});

describe('Copy link (test 9)', () => {
  it('writes every changed switch, and reading it back gives the same setup', () => {
    const setups: Partial<RunOptions>[] = [
      {},
      { hard: false },
      { snagIt: 'off', tipDrill: 'always', breakItKinds: ['juke', 'bar'] },
      { fieldEvents: 'off', pickupsOn: false, monsters: true, startWithPerks: true },
      EVERY_CHANGED,
    ];
    for (const named of setups) {
      const query = linkFor(named);
      const back = readLink(new URLSearchParams(query)).run;
      expect(runOptionsFor(back, { kind: 'nothing' }, false), query).toEqual({
        ...RUN_DEFAULTS,
        ...named,
        ...(named.breakItKinds
          ? { breakItKinds: BREAK_KINDS.filter((k) => named.breakItKinds?.includes(k)) }
          : {}),
      });
      // Every changed switch is in the link, and nothing else.
      expect(Object.keys(back).sort(), query).toEqual(changedSwitches(named).sort());
    }
  });

  it('a setup the same as the defaults is the plain game’s link', () => {
    expect(linkFor(RUN_DEFAULTS)).toBe('');
    expect(linkFor({ hard: false, area: 2 })).toBe('?area=2&hard=0');
  });
});
