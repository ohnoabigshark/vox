import { describe, expect, it } from 'vitest';
import { runDigest, type BotRun } from './botRuns';

/**
 * Same runs (map item j7): twelve seeded runs, each played by a bot for
 * 3,000 steps or until it's won or lost, with a digest pinned of every event,
 * and of the state after each event and every half second between.
 * Halloween's move into its own folder must leave every one unchanged, so a
 * change to play turns this red.
 *
 * Checked by breaking each in turn (2026-11-06): a hundredth of a second on
 * a pancake, Frog Rain or the King's crows, the Royal Decree or Second Wind
 * switched off, each turns at least two runs red. The mixed bot taps the
 * Queen's banned card first, so her refusal is played too. Candy Corn Magnet never
 * comes up in these runs; its own test in perks.test.ts catches it.
 *
 * When a change to play is meant, the failure prints each run's new digest:
 * paste it in, and say in the commit that play changed.
 */

const STEPS = 3000;

/** Normal and hard, two-tap and esrauch's aim, three bots: one run each, starting in each area in turn. */
const RUNS: readonly BotRun[] = [false, true]
  .flatMap((hard) =>
    [true, false].flatMap((twoTapAim) =>
      (['pass', 'run', 'mixed'] as const).map((bot) => ({ hard, twoTapAim, bot })),
    ),
  )
  .map((r, i) => ({ ...r, seed: i + 1, startArea: (i + 2) % 3, perks: (i + 2) % 4 === 0 }));

const name = (r: BotRun) =>
  `seed ${r.seed}: ${r.hard ? 'hard' : 'normal'}, ${r.twoTapAim ? 'two-tap' : "esrauch's aim"}, ` +
  `${r.bot} bot, area ${r.startArea + 1}${r.perks ? ', every perk' : ''}`;

/** Each run's digest, by seed, as main played it at adb458b. */
const PINNED: Record<number, string> = {
  1: 'fdce5a12123bea8e',
  2: 'c89361c585fae1b2',
  3: '16ec36436d9b2fe9',
  4: '1b08e9476b956617',
  5: 'd33e169f802d7816',
  6: '752ba494960a1863',
  7: '02f3e0e96121f4cc',
  8: 'b30a60eaf73e7d05',
  9: 'd763dcda6cfc5b6a',
  10: 'fed968860651fd65',
  11: '91063fe30d41394e',
  12: '310ce76ad60eeb1f',
};

describe('same runs', () => {
  it.each(RUNS.map((r) => [name(r), r] as const))(
    '%s',
    (_name, run) => {
      expect(runDigest(run, STEPS)).toBe(PINNED[run.seed]);
    },
    60_000,
  );
});
