/**
 * Run options (docs/DEV_SETUP.md): the switches a run is made with, and their
 * defaults, in one place. The game, a link and the dev setup page all start
 * from `RUN_DEFAULTS`. Each switch is one value, named once in `SWITCHES` with
 * its link flag and what it takes. A run's options come in layers, switch by
 * switch: the link if it names it, else the saved setup, else the defaults
 * (`runOptionsFor`).
 */
import type { BreakKind } from '../sim/types';
import type { SetupRead } from './savedSetup';
import { arcadeTuning } from './tuning';

/**
 * SNAG IT! or the tip drill (docs/SNAG.md, docs/TIP.md): `off`, never;
 * `normal`, from stretch 5 on some contested balls; `always`, every contested
 * ball from the first series (with both `always`, either at random).
 */
export type CatchSetting = 'off' | 'normal' | 'always';
export const CATCH_SETTINGS: readonly CatchSetting[] = ['off', 'normal', 'always'];

/** Every Break it! kind, in the order the deal picks from. */
export const BREAK_KINDS: readonly BreakKind[] = ['bar', 'mash', 'juke'];

export interface RunOptions {
  /** The run's seed; null for a random one. */
  readonly seed: number | null;
  /** The area a run starts in: 1 the Forest, 2 the Candy Kingdom, 3 Frederick's Farm. */
  readonly area: number;
  /**
   * Hard mode: the zones go round until you lose, one more defender each (at
   * most 12) with stats +20 a zone, Break it! tighter past the third, recruits
   * +30 a zone (Hands slower), the sweep no faster after the third, and TRICK
   * OR TREAT! lets you set your lineup.
   */
  readonly hard: boolean;
  /** Two-tap throwing: the first tap stops the line, the second picks how far. */
  readonly twoTapAim: boolean;
  /** SNAG IT!: off, normal or always. */
  readonly snagIt: CatchSetting;
  /** The tip drill: off, normal or always. */
  readonly tipDrill: CatchSetting;
  /** The Break it! kinds a tackle can deal, at least one, in `BREAK_KINDS` order. */
  readonly breakItKinds: readonly BreakKind[];
  /** Bolts and gravestones on the field (docs/PICKUPS.md). */
  readonly pickupsOn: boolean;
  /** Field events on ordinary stretches, as the seed gives them (docs/FIELD_EVENTS.md); a Boss's own (Frog Rain) comes either way. */
  readonly fieldEventsOn: boolean;
  /** Start holding every perk TRICK OR TREAT! offers (docs/REWARDS.md, o4). */
  readonly startWithPerks: boolean;
  /** A monster team (Golem Blockers, Werewolf Runners, Ghost Catchers), for a look at them. */
  readonly monsters: boolean;
}

/**
 * The defaults: hard mode and two-tap throwing, the way the user plays
 * (release map b2), from the Forest with a random seed, and the game as it
 * comes: every tap test, pickups and field events.
 */
export const RUN_DEFAULTS: RunOptions = {
  seed: null,
  area: 1,
  hard: true,
  twoTapAim: true,
  snagIt: 'normal',
  tipDrill: 'normal',
  breakItKinds: BREAK_KINDS,
  pickupsOn: true,
  fieldEventsOn: true,
  startWithPerks: false,
  monsters: false,
};

/**
 * esrauch's original game: normal mode, one-tap throwing. What practice plays
 * (decision map t3: practice ignores hard mode; its link carries its own
 * throw), and what the tests, the bench and the balance bots ask for when they
 * mean that game rather than today's defaults.
 */
export const ORIGINAL_GAME = {
  hard: false,
  twoTapAim: false,
} as const satisfies Partial<RunOptions>;

/** One switch: its flag in a link, how a link's text and a saved value are read, and how a link writes it. */
interface Switch<T> {
  readonly flag: string;
  /** What the link names, or undefined when it names nothing this switch takes. */
  read(params: URLSearchParams, flag: string): T | undefined;
  /** A value from outside (a saved setup) as the run takes it, or undefined when it isn't one. */
  check(value: unknown): T | undefined;
  /** The flag's text for this value. */
  write(value: T): string;
}

/** A switch that takes one of these words (in a link and saved alike), and maybe old link words for some. */
function oneOf<T extends string>(
  words: readonly T[],
  old: Readonly<Record<string, T>> = {},
): Omit<Switch<T>, 'flag'> {
  const check = (value: unknown): T | undefined => words.find((w) => w === value);
  return {
    read: (params, flag) => {
      const text = params.get(flag);
      return text === null ? undefined : (check(text) ?? old[text]);
    },
    check,
    write: (value) => value,
  };
}

/** A switch on or off: `1` or `0` in a link (or the words given), and `on` or `off` too; true or false saved. */
function onOff(on = '1', off = '0'): Omit<Switch<boolean>, 'flag'> {
  return {
    read: (params, flag) => {
      const text = params.get(flag);
      if (text === on || text === 'on') return true;
      return text === off || text === 'off' ? false : undefined;
    },
    check: (value) => (typeof value === 'boolean' ? value : undefined),
    write: (value) => (value ? on : off),
  };
}

/** A whole number from 1 to `most`. */
const wholeUpTo = (value: unknown, most: number): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= most
    ? value
    : undefined;

/** A seed the run takes: null for a random one, or a whole number from 1. */
const checkSeed = (value: unknown): number | null | undefined =>
  value === null ? null : wholeUpTo(value, Number.MAX_SAFE_INTEGER);

/** A starting area the run takes: 1 to the last area. */
const checkArea = (value: unknown): number | undefined => wholeUpTo(value, arcadeTuning.run.areas);

/** A link's number, through the same check as a saved one (blank names nothing). */
const linkNumber = <T>(
  text: string | null,
  check: (value: unknown) => T | undefined,
): T | undefined => (text === null || text.trim() === '' ? undefined : check(Number(text)));

/** Break it! kinds as the run takes them: known, at least one, each once, in `BREAK_KINDS` order. */
function breakKinds(value: unknown): readonly BreakKind[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  if (!value.every((k) => BREAK_KINDS.some((b) => b === k))) return undefined;
  return BREAK_KINDS.filter((k) => value.includes(k));
}

/**
 * Every switch, once. Today's links read as they did: `?hard=0` and `?aim=1`
 * turn hard mode and two-tap off, `?snag=1`, `?tip=1` and `?perks=1` turn
 * theirs on, bare `?monsters` turns the monster team on, and `?area=N` and
 * `?seed=N` take a number, checked as a saved one is (a whole number from 1;
 * the area at most the last). What's new says every value, "off" included
 * (d3): `?hard=1`, `?aim=2`, `?perks=0`, `?monsters=0` (or `off`),
 * `?seed=random`, `?snag=off|normal|always` (and `?tip=`),
 * `?breakit=bar,mash,juke`, `?pickups=0|1`, `?events=off|normal|<event id>`.
 * A value a switch doesn't take names nothing, so the layer below holds.
 */
const SWITCHES: { readonly [K in keyof RunOptions]: Switch<RunOptions[K]> } = {
  seed: {
    flag: 'seed',
    read: (params, flag) =>
      params.get(flag) === 'random' ? null : linkNumber(params.get(flag), checkSeed),
    check: checkSeed,
    write: (value) => (value === null ? 'random' : String(value)),
  },
  area: {
    flag: 'area',
    read: (params, flag) => linkNumber(params.get(flag), checkArea),
    check: checkArea,
    write: (value) => String(value),
  },
  hard: { flag: 'hard', ...onOff() },
  twoTapAim: { flag: 'aim', ...onOff('2', '1') },
  snagIt: { flag: 'snag', ...oneOf(CATCH_SETTINGS, { '1': 'always' }) },
  tipDrill: { flag: 'tip', ...oneOf(CATCH_SETTINGS, { '1': 'always' }) },
  breakItKinds: {
    flag: 'breakit',
    read: (params, flag) => {
      const text = params.get(flag);
      return text === null ? undefined : breakKinds(text.split(','));
    },
    check: breakKinds,
    write: (value) => value.join(','),
  },
  pickupsOn: { flag: 'pickups', ...onOff() },
  fieldEventsOn: { flag: 'events', ...onOff() },
  startWithPerks: { flag: 'perks', ...onOff() },
  monsters: {
    flag: 'monsters',
    // Bare, or any value but 0 and off, as `?monsters` always counted.
    read: (params, flag) => {
      const text = params.get(flag);
      return text === null ? undefined : text !== '0' && text !== 'off';
    },
    check: (value) => (typeof value === 'boolean' ? value : undefined),
    write: (value) => (value ? '1' : '0'),
  },
};

const SWITCH_NAMES = Object.keys(RUN_DEFAULTS) as (keyof RunOptions)[];

/** Some of the run options, each named one with its value. */
type NamedOptions = { -readonly [K in keyof RunOptions]?: RunOptions[K] };

/** What a link says: the run options it names, and the switches only a link has. */
export interface Link {
  readonly run: Partial<RunOptions>;
  /** ?win=1: PLAY goes straight to the win cutscene, with a full bench. */
  readonly win: boolean;
  /** ?video=1 (with ?win=1): the win dance held still for the sing-along video's capture (tools/video/). */
  readonly video: boolean;
  /** ?farmSong=2: which Frederick's Farm song candidate plays (1 Harvest Moon Hoedown, 2 Spooky Cow). */
  readonly farmSong: number;
}

/** A page's query read for its options (each switch's flag, in `SWITCHES`), and the link-only `?win`, `?video` and `?farmSong=N`. */
export function readLink(params: URLSearchParams): Link {
  const run: NamedOptions = {};
  for (const key of SWITCH_NAMES) set(run, key, readSwitch(key, params));
  return {
    run,
    win: params.has('win'),
    video: params.has('video'),
    farmSong: Number(params.get('farmSong')) || 1,
  };
}

/** What a link's query names for this switch, if anything. */
function readSwitch<K extends keyof RunOptions>(
  key: K,
  params: URLSearchParams,
): RunOptions[K] | undefined {
  return SWITCHES[key].read(params, SWITCHES[key].flag);
}

/**
 * A switch's value from text, as a link reads it (the setup page's seed
 * box): the one check a link and a saved value go through.
 */
export function switchFromText<K extends keyof RunOptions>(
  key: K,
  text: string,
): RunOptions[K] | undefined {
  return readSwitch(key, new URLSearchParams([[SWITCHES[key].flag, text]]));
}

/** Name `key` in `named`, if there's a value for it. */
function set<K extends keyof RunOptions>(
  named: NamedOptions,
  key: K,
  value: RunOptions[K] | undefined,
): void {
  if (value !== undefined) named[key] = value;
}

/** Whether two values of a switch are the same: Break it! kinds as a set. */
function same<K extends keyof RunOptions>(key: K, a: RunOptions[K], b: RunOptions[K]): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((k: BreakKind) => b.includes(k));
  return a === b;
}

/** The switches these options name with a value other than the default, in `RUN_DEFAULTS` order. */
export function changedSwitches(named: Partial<RunOptions>): (keyof RunOptions)[] {
  return SWITCH_NAMES.filter((key) => {
    const value = named[key];
    return value !== undefined && !same(key, value, RUN_DEFAULTS[key]);
  });
}

/** Only the switches these options change from the defaults. */
export function changesOnly(named: Partial<RunOptions>): Partial<RunOptions> {
  const out: NamedOptions = {};
  for (const key of changedSwitches(named)) set(out, key, named[key]);
  return out;
}

/**
 * A link's query naming every switch, random and off included, so it plays
 * these options on any phone, whatever setup is saved there (Copy link,
 * d8 test 9; map round 5, q1).
 */
export function linkFor(options: RunOptions): string {
  return `?${queryOf(SWITCH_NAMES, options)}`;
}

/** The switches these options change from the defaults, as a link's query writes them (no `?`; '' for none). */
export function changesQuery(named: Partial<RunOptions>): string {
  return queryOf(changedSwitches(named), named);
}

/** A query (no `?`) naming these switches of `named`, as a link writes them. */
function queryOf(keys: readonly (keyof RunOptions)[], named: Partial<RunOptions>): string {
  const params = new URLSearchParams();
  for (const key of keys) writeSwitch(params, key, named[key]);
  return params.toString().replace(/%2C/g, ',');
}

/** Put this switch's flag in a link's query, if it has a value. */
function writeSwitch<K extends keyof RunOptions>(
  params: URLSearchParams,
  key: K,
  value: RunOptions[K] | undefined,
): void {
  if (value !== undefined) params.set(SWITCHES[key].flag, SWITCHES[key].write(value));
}

/**
 * Values from outside (a saved setup) checked switch by switch: each one a
 * switch takes, and the rest, named so they can be warned about.
 */
export function checkSwitches(raw: Readonly<Record<string, unknown>>): {
  readonly named: Partial<RunOptions>;
  readonly bad: readonly { readonly key: string; readonly value: unknown }[];
  readonly unknown: readonly string[];
} {
  const named: NamedOptions = {};
  const bad: { key: string; value: unknown }[] = [];
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const name = SWITCH_NAMES.find((k) => k === key);
    if (!name) {
      unknown.push(key);
      continue;
    }
    const checked = SWITCHES[name].check(value);
    if (checked === undefined) bad.push({ key, value });
    else set(named, name, checked);
  }
  return { named, bad, unknown };
}

/**
 * The switches the sim's `createRun` takes: all but the seed and the area
 * (its own arguments) and the monster team (the roster it's given).
 */
export type RunSwitches = Omit<RunOptions, 'seed' | 'area' | 'monsters'>;

/** The switches of these run options that `createRun` takes. */
export function runSwitches(o: RunOptions): RunSwitches {
  return {
    hard: o.hard,
    twoTapAim: o.twoTapAim,
    snagIt: o.snagIt,
    tipDrill: o.tipDrill,
    breakItKinds: o.breakItKinds,
    pickupsOn: o.pickupsOn,
    fieldEventsOn: o.fieldEventsOn,
    startWithPerks: o.startWithPerks,
  };
}

/** The run options played: each named one, and the defaults for the rest. */
export function runOptionsFrom(named: Partial<RunOptions>): RunOptions {
  return { ...RUN_DEFAULTS, ...named };
}

/**
 * The run options a page plays (d3, d5), switch by switch: the link's, else
 * the saved setup's, else the defaults. Practice (a play or event practice
 * link) ignores the saved setup: its link and the defaults only. A setup that
 * couldn't be read counts as nothing saved.
 */
export function runOptionsFor(
  link: Partial<RunOptions>,
  read: SetupRead,
  practice: boolean,
): RunOptions {
  const saved = !practice && read.kind === 'saved' ? read.setup : {};
  return runOptionsFrom({ ...saved, ...link });
}
