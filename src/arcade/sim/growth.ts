/**
 * Growth from play (docs/REWARDS.md): your players get better at what they
 * do. Each down's events are noted in a tally as they happen (by field
 * slot), and when the down ends its gains go onto the roster, never past
 * the ceiling. Jack, the bench and practice never grow.
 */
import { arcadeTuning } from '../content/tuning';
import { plus, STAT_ORDER, ZERO } from './stats';
import type { ArcadeEvent, DownTally, RunState, Stats } from './types';

/** One stat gained by the player in a field slot. */
export interface Gain {
  readonly slot: number;
  readonly stat: keyof Stats;
  readonly by: number;
}

/** A down that has done nothing yet. */
export function newTally(): DownTally {
  return {
    catch: null,
    testFor: null,
    catchGreats: [],
    handoffTo: null,
    grabbed: null,
    breakGreats: [],
    pancakes: [],
    held: [],
  };
}

/** What a finished down grows, from its tally, the yards it gained and where the ball was downed. */
export function gainsOf(tally: DownTally, down: { gained: number; los: number }): Gain[] {
  const g = arcadeTuning.growth;
  const sums = new Map<number, Stats>();
  const add = (slot: number, stat: keyof Stats, by: number): void => {
    if (by <= 0) return;
    sums.set(slot, plus(sums.get(slot) ?? ZERO, { ...ZERO, [stat]: by }));
  };
  if (tally.catch) {
    add(tally.catch.slot, 'hands', g.catch);
    add(tally.catch.slot, 'hustle', Math.floor(down.los - tally.catch.at) * g.yacPerYard);
  }
  for (const slot of tally.catchGreats) add(slot, 'hands', g.catchGreat);
  if (tally.handoffTo !== null && !tally.catch && down.gained >= g.rushFrom) {
    add(tally.handoffTo, 'hustle', g.rush + Math.floor(down.gained - g.rushFrom) * g.rushPerYard);
  }
  for (const slot of tally.breakGreats) add(slot, 'hustle', g.breakGreat);
  for (const slot of tally.pancakes) add(slot, 'heft', g.pancake);
  if (down.gained > 0) for (const slot of tally.held) add(slot, 'heft', g.blockHeld);
  return [...sums.keys()]
    .sort((a, b) => a - b)
    .flatMap((slot) =>
      STAT_ORDER.map((stat) => ({ slot, stat, by: sums.get(slot)?.[stat] ?? 0 })).filter(
        (gain) => gain.by > 0,
      ),
    );
}

/** A Blocker (by slot) touched a defender this down. */
export function noteHeld(tally: DownTally, slot: number): void {
  if (!tally.held.includes(slot)) tally.held.push(slot);
}

/** The field slot of one of your players on the field, or null (Jack, or nobody). */
function slotOf(state: RunState, id: number): number | null {
  const slot = state.field.players.find((p) => p.id === id)?.slot;
  return slot === undefined || slot < 0 ? null : slot;
}

/**
 * Note what these events did, in order, and when the down ends put its
 * gains on the roster, adding a `grew` event for each. Practice never
 * grows anyone (z3).
 */
export function noteGrowth(state: RunState, events: ArcadeEvent[]): void {
  const tally = state.tally;
  for (const e of [...events]) {
    switch (e.type) {
      case 'downStarted':
        Object.assign(tally, newTally());
        break;
      case 'caught': {
        const slot = slotOf(state, e.id);
        const at = state.field.players.find((p) => p.id === e.id)?.pos.y;
        if (slot !== null && at !== undefined) tally.catch = { slot, at };
        break;
      }
      case 'snagStarted':
      case 'tipStarted':
        tally.testFor = slotOf(state, e.receiver);
        break;
      case 'snagResult':
      case 'tipResult':
        if (e.grade === 'great' && tally.testFor !== null) tally.catchGreats.push(tally.testFor);
        tally.testFor = null;
        break;
      case 'handoff':
        tally.handoffTo = slotOf(state, e.id);
        break;
      case 'grabbed':
        tally.grabbed = slotOf(state, e.id);
        break;
      case 'breakResult':
        if (e.outcome === 'break' && tally.grabbed !== null) tally.breakGreats.push(tally.grabbed);
        break;
      case 'pancake': {
        const slot = slotOf(state, e.blocker);
        if (slot !== null) tally.pancakes.push(slot);
        break;
      }
      case 'downEnded':
        if (!state.practice) {
          applyGains(state, gainsOf(tally, { gained: e.gained, los: state.series.los }), events);
        }
        break;
      default:
        break;
    }
  }
}

/** Put gains on the roster (each stat capped), adding a `grew` event for each. */
export function applyGains(state: RunState, gains: readonly Gain[], events: ArcadeEvent[]): void {
  const ceiling = arcadeTuning.growth.ceiling;
  for (const { slot, stat, by } of gains) {
    const p = state.roster[slot];
    if (!p) continue;
    const had = p.stats[stat];
    const now = Math.min(ceiling, had + by);
    if (now <= had) continue;
    state.roster[slot] = { ...p, stats: { ...p.stats, [stat]: now } };
    state.gains[p.id] = plus(state.gains[p.id] ?? ZERO, { ...ZERO, [stat]: now - had });
    events.push({ type: 'grew', id: p.id, stat, by: now - had });
  }
}
