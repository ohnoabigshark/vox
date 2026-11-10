/**
 * Run options (docs/DEV_SETUP.md): the switches a run is made with, and their
 * defaults, in one place. The game, a link and (later) the dev setup page all
 * start from `RUN_DEFAULTS`; a link says only what it changes (`readLink`),
 * laid over the defaults by `runOptionsFrom`.
 */

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
  /** SNAG IT! from the first series, not only from series 5 (docs/SNAG.md). */
  readonly snagAlways: boolean;
  /** The tip drill from the first series; with SNAG IT! too, either at random (docs/TIP.md). */
  readonly tipAlways: boolean;
  /** Start holding every perk TRICK OR TREAT! offers (docs/REWARDS.md, o4). */
  readonly startWithPerks: boolean;
  /** A monster team (Golem Blockers, Werewolf Runners, Ghost Catchers), for a look at them. */
  readonly monsters: boolean;
}

/**
 * The defaults: hard mode and two-tap throwing, the way the user plays
 * (release map b2), from the Forest with a random seed.
 */
export const RUN_DEFAULTS: RunOptions = {
  seed: null,
  area: 1,
  hard: true,
  twoTapAim: true,
  snagAlways: false,
  tipAlways: false,
  startWithPerks: false,
  monsters: false,
};

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

/**
 * A page's query read for its options. Each flag names its option only when
 * its value is one it knows; anything else leaves the default, so old links
 * (`?hard=1&aim=2`) play the defaults. `?hard=0` and `?aim=1` turn hard mode
 * and two-tap throwing off; `?snag=1`, `?tip=1` and `?perks=1` turn theirs on;
 * `?monsters` on its own does; `?area=N` and `?seed=N` take a number.
 */
export function readLink(params: URLSearchParams): Link {
  const run: { -readonly [K in keyof RunOptions]?: RunOptions[K] } = {};
  const seed = Number(params.get('seed'));
  if (seed) run.seed = seed;
  const area = Number(params.get('area'));
  if (area) run.area = area;
  if (params.get('hard') === '0') run.hard = false;
  if (params.get('aim') === '1') run.twoTapAim = false;
  if (params.get('snag') === '1') run.snagAlways = true;
  if (params.get('tip') === '1') run.tipAlways = true;
  if (params.get('perks') === '1') run.startWithPerks = true;
  if (params.has('monsters')) run.monsters = true;
  return {
    run,
    win: params.has('win'),
    video: params.has('video'),
    farmSong: Number(params.get('farmSong')) || 1,
  };
}

/** The run options played: each named one, and the defaults for the rest. */
export function runOptionsFrom(named: Partial<RunOptions>): RunOptions {
  return { ...RUN_DEFAULTS, ...named };
}
