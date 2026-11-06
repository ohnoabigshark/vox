/**
 * Whole runs played by simple bots, for tests that pin what the game does
 * (map item j7: Halloween's move into its own folder must change nothing).
 * Not a good player: the balance tool's bot is that. These bots only have to
 * reach every part of a run the same way every time.
 */
import { createHash } from 'node:crypto';
import { litPlayers } from '../../src/arcade/render/sweep';
import { breakMarker, jukeShowing } from '../../src/arcade/sim/breakit';
import { createRun, dispatch } from '../../src/arcade/sim/run';
import { canThrow, step } from '../../src/arcade/sim/step';
import type { Action, ArcadeEvent, RunState, StepInput } from '../../src/arcade/sim/types';

/** How a bot calls plays: always a pass, always a handoff, or a bit of everything. */
export type BotStyle = 'pass' | 'run' | 'mixed';

export interface BotRun {
  readonly seed: number;
  readonly hard: boolean;
  /** Two-tap throwing, the default game's; false is esrauch's original aim. */
  readonly twoTapAim: boolean;
  readonly bot: BotStyle;
  /** The area the run starts in (0 the Forest, 1 the Candy Queendom, 2 the Farm). */
  readonly startArea: number;
  /** Start holding every perk (?perks=1). */
  readonly perks: boolean;
}

const isHandoff = (s: RunState, card: number) =>
  s.playbook[s.hand[card] ?? -1]?.handoff !== undefined;

/** The card this bot calls: the first it likes, or the first card. */
function cardFor(s: RunState, bot: BotStyle, i: number): number {
  const cards = s.hand.map((_, c) => c);
  switch (bot) {
    case 'pass':
      return cards.find((c) => !isHandoff(s, c)) ?? 0;
    case 'run':
      return cards.find((c) => isHandoff(s, c)) ?? 0;
    case 'mixed':
      return i % cards.length;
  }
}

/** The bot's taps this step, in whatever phase the run is in. */
function inputFor(s: RunState, run: BotRun, i: number): StepInput {
  switch (s.phase) {
    case 'breakit':
      if (s.tackle?.kind === 'juke') return jukeShowing(s) ? { juke: s.tackle.side } : {};
      return { breakTap: (breakMarker(s) ?? 0) > 0.5 || s.tackle?.kind === 'mash' };
    case 'snag':
      return i % 10 === 0 ? { snag: Math.floor(i / 10) % 3 } : {};
    case 'tip':
      return { tip: i % 12 === 0 };
    default: {
      // Throw at a lit receiver, or as the pocket runs out; the mixed bot, sooner.
      const held = s.time - s.snappedAt;
      const late = run.bot === 'mixed' ? 0.6 + (run.seed % 3) * 0.4 : 2.5;
      const throwNow = run.bot !== 'run' && canThrow(s) && (held > late || litPlayers(s).size > 0);
      return { throw: throwNow, shoo: i % 20 === 0 };
    }
  }
}

/**
 * Plays `run` for `steps` steps (or until it's over), calling `see` with the
 * state and events after every action and step.
 */
export function playRun(
  run: BotRun,
  steps: number,
  see: (s: RunState, events: readonly ArcadeEvent[]) => void,
): RunState {
  let s = createRun(run.seed, undefined, run.startArea, {
    hard: run.hard,
    twoTapAim: run.twoTapAim,
    startWithPerks: run.perks,
  });
  const act = (action: Action) => {
    const r = dispatch(s, action);
    s = r.state;
    see(s, r.events);
    return r.events;
  };
  for (let i = 0; i < steps && s.phase !== 'over' && s.phase !== 'won'; i++) {
    if (s.phase === 'setup') {
      const first = cardFor(s, run.bot, i);
      // A card the Queen has banned can't be called: try the next.
      for (let k = 0; k < s.hand.length; k++) {
        const banned = act({ type: 'call', hand: (first + k) % s.hand.length }).some(
          (e) => e.type === 'banned',
        );
        if (!banned) break;
      }
      if (run.bot === 'mixed' && i % 5 === 0) act({ type: 'flip' });
      act({ type: 'hike' });
    }
    if (s.phase === 'draft') {
      if (run.bot !== 'pass' && s.offer.length > 0) {
        act({ type: 'pick', offer: i % s.offer.length });
        if (run.bot === 'mixed' && s.bench.length > 0) act({ type: 'swap', a: i % 7, b: 7 });
      }
      if (s.phase === 'draft') act({ type: 'skipDraft' });
    }
    const r = step(s, inputFor(s, run, i));
    s = r.state;
    see(s, r.events);
  }
  return s;
}

/** JSON with every object's keys in order, so a digest doesn't change when only the order fields are built in does. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** Steps between the states a digest always takes (half a second): a run that goes another way stays changed. */
const EVERY = 30;

/**
 * A digest of what a run did: every event, the state after each action and
 * each step with an event, and every half second's state between.
 */
export function runDigest(run: BotRun, steps: number): string {
  const hash = createHash('sha256');
  let n = 0;
  playRun(run, steps, (s, events) => {
    if (events.length > 0 || n++ % EVERY === 0) hash.update(canonical(s));
    hash.update(canonical(events));
  });
  return hash.digest('hex').slice(0, 16);
}
