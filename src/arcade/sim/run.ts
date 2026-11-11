/**
 * Creating a run, setting up series and downs, and the actions between
 * steps (the snap, moving on after a series). Steps are advanced by step()
 * in step.ts. See GAMEPLAY.md, The Run, A Series and A Down.
 */
import { newTally, noteGrowth } from './growth';
import { AREAS, DEFENDERS, areaAt, type DefenseSpec } from '../content/defense';
import { PLAY_POOL, startingPlaybook } from '../content/playPool';
import { OFFERED_PERKS } from '../content/perks';
import type { Play } from '../content/plays';
import { hotRouteSet, hotRoutesFor, nextHotRoute, withHotRoutes } from '../content/hotRoutes';
import { playSlot } from '../content/team';
import { assertNever } from '../../assertNever';
import { arcadeTuning } from '../content/tuning';
import { rngFor } from './random';
import { assignMarks } from './ai';
import { RUN_DEFAULTS, runOptionsFrom, type RunSwitches } from '../content/runOptions';
import { pickupsForArea } from './pickups';
import { placeEvent } from './fieldEvents';
import { fieldEventById, GENERIC_EVENTS, type FieldEvent } from '../content/fieldEvents';
import { AREA_YARDS, BOSS_SPOT, areaPropsWithBoss } from './props';
import { lineUpDefense, lineUpTeam } from './bodies';
import {
  applyPerk,
  atSpot,
  bestSpot,
  noPerks,
  rollOffer,
  setSpot,
  setsLineup,
  startingRoster,
} from './team';
import type {
  BossName,
  Action,
  ArcadeEvent,
  ArcadeResult,
  Defender,
  DownResult,
  Series,
  SeriesKind,
  Phase,
  RosterPlayer,
  RunState,
  RoyalCrows,
  FieldEventOn,
} from './types';

export const SERIES_KINDS: readonly SeriesKind[] = ['intro', 'challenge', 'gimmick', 'boss'];

/** A stretch's kind: the Boss stretch for any past the last. */
export function stretchKind(stretch: number): SeriesKind {
  return SERIES_KINDS[stretch] ?? 'boss';
}

/**
 * A down's stretch number in the run (1-based): Froggy's Forest's stretches
 * are 1-4, the Candy Queendom's 5-8, and so on (docs/LONG_FIELD.md, r2).
 */
export function stretchNumber(series: Pick<Series, 'area' | 'stretch'>): number {
  return series.area * SERIES_KINDS.length + series.stretch + 1;
}

/** The number of the stretch a Boss's gimmick comes on: the last of its area. */
export function bossStretch(boss: BossName): number {
  const area = AREAS.findIndex((a) => a.boss.boss === boss);
  if (area < 0) throw new Error(`no area has ${boss} for its Boss`);
  return stretchNumber({ area, stretch: SERIES_KINDS.length - 1 });
}

/** The area and stretch (both from 0) of a stretch number in the run: `stretchNumber` backwards. */
export function stretchAt(n: number): Pick<Series, 'area' | 'stretch'> {
  const i = Math.max(0, Math.floor(n) - 1);
  return { area: Math.floor(i / SERIES_KINDS.length), stretch: i % SERIES_KINDS.length };
}

/**
 * The stretch (0-3) a line of scrimmage is in, whose defense the down faces
 * (docs/LONG_FIELD.md, r1). Behind the area's start counts as its first.
 */
export function stretchOf(los: number): number {
  const last = SERIES_KINDS.length - 1;
  return Math.max(0, Math.min(last, Math.floor(los / arcadeTuning.series.distance)));
}

/** Where a stretch starts, in yards from its area's start: `stretchOf` backwards. */
export function stretchStart(stretch: number): number {
  return stretch * arcadeTuning.series.distance;
}

/**
 * The stretch of a line of scrimmage, with its kind, name and defense: the
 * one place a down's stretch is worked out (r1).
 */
function lineStretch(
  state: RunState,
  area: number,
  los: number,
): { at: Pick<Series, 'stretch' | 'kind' | 'name'>; spec: DefenseSpec } {
  const stretch = stretchOf(los);
  const spec = seriesDefense(state, area, stretch);
  return { at: { stretch, kind: stretchKind(stretch), name: spec.name }, spec };
}

/** Seven plain humans (sim/team.ts). */
export { startingRoster };

/** The defense for a series: the area's Intro, Challenge, a seeded Gimmick, or its Boss. */
export function defenseFor(area: number, stretch: number): DefenseSpec {
  const a = areaAt(area);
  const kind = stretchKind(stretch);
  switch (kind) {
    case 'intro':
      return a.intro;
    case 'challenge':
      return a.challenge;
    case 'gimmick':
      return a.gimmick;
    case 'boss':
      return a.boss;
    default:
      return assertNever(kind);
  }
}

/**
 * A series' defense as it lines up: its spec, plus in hard mode one more
 * defender for every zone after the first (never past `maxDefenders` in the
 * down's defense; the patrols ahead don't count), alternately a Cover and a Bat, spread over the field.
 */
export function seriesDefense(state: RunState, area: number, stretch: number): DefenseSpec {
  const spec = defenseFor(area, stretch);
  const { extraDefendersPerZone, maxDefenders } = arcadeTuning.hard;
  const room = Math.max(0, maxDefenders - spec.defenders.length);
  const extra = state.hard ? Math.min(area * extraDefendersPerZone, room) : 0;
  if (extra === 0) return spec;
  const spots = Array.from({ length: extra }, (_, k) => ({
    kind: k % 2 === 0 ? ('cover' as const) : ('bat' as const),
    x: -6.3 + ((k * 5.3) % 12.6),
    y: 3 + ((k * 1.7) % 6),
  }));
  return { ...spec, defenders: [...spec.defenders, ...spots] };
}

/** How much stiffer a series' defense is than its spec: more each area (faster in hard mode), more on the Boss. */
export function defenseBoost(
  state: RunState,
  area: number,
  kind: SeriesKind,
  spec: DefenseSpec,
): number {
  const d = arcadeTuning.defense;
  const perArea = state.hard ? arcadeTuning.hard.statsPerZone : d.perArea;
  return area * perArea + (kind === 'boss' ? d.boss : 0) + spec.boost;
}

/**
 * A new run. `startArea` (0-based) starts it at that area's first series
 * instead, as if the series before it were won (for trying later areas).
 */
export function createRun(
  seed: number,
  roster: RosterPlayer[] = startingRoster(),
  startArea = RUN_DEFAULTS.area - 1,
  options: Partial<RunSwitches> & {
    /** The plays it deals from; the starting playbook if not given (event practice: the whole pool). */
    readonly playbook?: readonly Play[];
    /**
     * Practice (the play editor's Try it): this play is the whole playbook,
     * called at every setup, and every rep lines up the same spot again.
     */
    readonly practice?: Play;
    /**
     * Event practice (the event editor's Try it, docs/FIELD_EVENTS.md f3):
     * this event every rep, at this series (1-based) against its defense,
     * with three cards dealt each time.
     */
    readonly eventPractice?: { readonly event: FieldEvent; readonly stretch: number };
  } = {},
): RunState {
  const inPractice = options.practice !== undefined || options.eventPractice !== undefined;
  // Any run option not given is the defaults file's (docs/DEV_SETUP.md, d1). Practice is
  // never hard mode and starts with no perks, whatever it's given (decision map t3, d5).
  const named = runOptionsFrom(options);
  const run = inPractice ? { ...named, hard: false, startWithPerks: false } : named;
  const state: RunState = {
    seed,
    // A run starts with the starting playbook (o3); practice is unchanged: a sketch alone, or an event against the whole pool.
    playbook: options.practice
      ? [options.practice]
      : (options.playbook ?? (options.eventPractice ? PLAY_POOL : startingPlaybook())),
    practice: inPractice,
    practiceEvent: options.eventPractice?.event ?? null,
    taken: [],
    hard: run.hard,
    twoTapAim: run.twoTapAim,
    snagIt: run.snagIt,
    tipDrill: run.tipDrill,
    breakItKinds: run.breakItKinds,
    pickupsOn: run.pickupsOn,
    fieldEventsOn: run.fieldEventsOn,
    step: 0,
    time: 0,
    phase: 'setup',
    series: {
      area: 0,
      stretch: 0,
      kind: 'intro',
      name: '',
      start: 0,
      firstDown: 0,
      down: 1,
      los: 0,
    },
    hand: [],
    called: null,
    banned: null,
    flipped: false,
    play: { index: 0, flipped: false },
    hotRoutes: {},
    tackle: null,
    snag: null,
    snagDone: null,
    tip: null,
    tipDone: null,
    roster,
    bench: [],
    perks: noPerks(),
    tally: newTally(),
    gains: {},
    offer: [],
    field: {
      players: [],
      defenders: [],
      props: [],
      pickups: [],
      fieldEvent: null,
      crows: null,
      ball: { at: 'qb' },
      runPath: null,
      aim: null,
      lane: 0,
      breakaway: 0,
      lastBreak: null,
      breaks: 0,
      drag: null,
    },
    snappedAt: 0,
    pause: 0,
    result: null,
    seriesWon: 0,
    yards: 0,
    nextId: 1,
  };
  if (options.eventPractice) {
    // The chosen series, as if the ones before it were won.
    const at = stretchAt(options.eventPractice.stretch);
    state.seriesWon = options.eventPractice.stretch - 1;
    setUpSeries(state, at.area, stretchStart(at.stretch), [], true);
    return state;
  }
  const area = Math.max(0, Math.min(startArea, arcadeTuning.run.areas - 1));
  state.seriesWon = area * SERIES_KINDS.length;
  setUpSeries(state, area, 0, [], true);
  // ?perks=1 (o4): every perk TRICK OR TREAT! offers, from the start.
  if (run.startWithPerks) for (const perk of OFFERED_PERKS) applyPerk(state.perks, perk);
  return state;
}

/**
 * Start a series at `start` (yards from the area's start, docs/LONG_FIELD.md):
 * 1st & 10, football's rule, or 1st & Goal within 10 of the goal line (a1,
 * r3), the defense of its line's stretch lined up (r1). With `ready`, the
 * first down is set up straight away; without, it waits for the player to
 * move on (after a won series: the upgrade pick comes first).
 */
export function setUpSeries(
  state: RunState,
  area: number,
  start: number,
  events: ArcadeEvent[],
  ready: boolean,
): void {
  const { at } = lineStretch(state, area, start);
  state.perks.secondWindUsed = false;
  state.series = {
    area,
    ...at,
    start,
    firstDown: Math.min(start + arcadeTuning.series.distance, AREA_YARDS),
    down: 1,
    los: start,
  };
  // The whole area's field, its Boss in his end zone from the first series (a2).
  const props = areaPropsWithBoss(state.seed, area, areaAt(area).boss.boss);
  state.field = {
    ...state.field,
    props,
    // Practice tests the play by itself (map item k8), and the run options can turn pickups
    // off (docs/DEV_SETUP.md); a pickup taken never comes back (k3).
    pickups:
      state.practice || !state.pickupsOn
        ? []
        : pickupsForArea(state.seed, area).filter((p) => !state.taken.includes(p.id)),
  };
  events.push({ type: 'seriesStarted', stretch: at.stretch, name: at.name });
  setUpDown(state, events);
  if (!ready) state.phase = 'draft';
}

/**
 * This down's field event, placed: the one practice tries; else its
 * stretch's own (Frog Rain); else its stretch's generic event, if the seed
 * gave it one and the run options have field events on. The play editor's
 * practice tests the play alone, as with pickups.
 */
function placedEvent(state: RunState, spec: DefenseSpec): FieldEventOn | null {
  if (state.practiceEvent) return placeEvent(state, state.practiceEvent);
  if (spec.fieldEvent) return placeEvent(state, fieldEventById(spec.fieldEvent));
  if (state.practice || !state.fieldEventsOn) return null;
  const generic = genericEventFor(state.seed, stretchNumber(state.series));
  return generic ? placeEvent(state, generic) : null;
}

/**
 * A stretch's generic event, or null (docs/FIELD_EVENTS.md round 5, a1,
 * a4): from stretch 2, about one ordinary stretch in two, never a Boss's;
 * the same for the same seed. Every down whose line is in the stretch gets
 * it. Its random stream is its own, so the cards dealt and the pickups are
 * as they were; whether a stretch gets one is drawn before which, so a
 * bigger pool changes only which.
 */
export function genericEventFor(seed: number, stretch: number): FieldEvent | null {
  const { genericFrom, genericShare } = arcadeTuning.fieldEvents;
  if (stretch < genericFrom || stretchKind(stretchAt(stretch).stretch) === 'boss') return null;
  const rng = rngFor(seed, 'stretchEvent', stretch);
  if (rng.next() >= genericShare) return null;
  const id = GENERIC_EVENTS[rng.int(0, GENERIC_EVENTS.length - 1)];
  return id ? fieldEventById(id) : null;
}

/** The King's crows, back on his arms for a new down (he stands at BOSS_SPOT). */
function perchedCrows(): RoyalCrows[] {
  return [0, 1].map(() => ({ phase: 'perched', pos: BOSS_SPOT, left: 0, on: null, goneAt: null }));
}

/** How many play cards are dealt each down. */
const HAND = 3;

/**
 * Line up the next down: three play cards dealt at random, both teams in
 * place (the line-up is the same for every play), waiting for the call.
 */
export function setUpDown(state: RunState, events: ArcadeEvent[]): void {
  // Each down faces the defense of the stretch its line is in (r1).
  const { at, spec } = lineStretch(state, state.series.area, state.series.los);
  state.series = { ...state.series, ...at };
  const { series } = state;
  const rng = rngFor(state.seed, 'hand', state.seriesWon, series.down, state.nextId);
  const deck = state.playbook.map((_, i) => i);
  state.hand = [];
  while (state.hand.length < Math.min(HAND, state.playbook.length)) {
    state.hand.push(deck.splice(rng.int(0, deck.length - 1), 1)[0] ?? 0);
  }
  // The play editor's practice deals its one play, already called; event practice deals three (f3).
  state.called = state.practice && !state.practiceEvent ? 0 : null;
  // The Queen's Royal Decree: one card of the three is banned this down.
  state.banned = spec.decree ? rng.int(0, state.hand.length - 1) : null;
  const first = state.banned === 0 ? 1 : 0;
  state.play = { index: state.hand[first] ?? 0, flipped: state.flipped };
  // A hot route is the down's only (a5).
  state.hotRoutes = {};
  const play = state.playbook[state.play.index];
  if (!play) throw new Error('The playbook has no plays');
  const players = lineUpTeam(state, play, state.flipped, series.los, state.nextId);
  state.nextId += players.length;
  const boost = defenseBoost(state, series.area, series.kind, spec);
  const defenders = [...lineUpDefense(spec, series, boost, state.nextId)];
  state.nextId += defenders.length;
  const ahead = patrolsAhead(state, state.nextId);
  defenders.push(...ahead);
  state.nextId += ahead.length;
  state.field = {
    players,
    defenders,
    props: state.field.props,
    pickups: state.field.pickups,
    fieldEvent: placedEvent(state, spec),
    crows: spec.boss === 'king' ? perchedCrows() : null,
    ball: { at: 'qb' },
    runPath: null,
    aim: null,
    lane: 0,
    breakaway: 0,
    lastBreak: null,
    breaks: 0,
    drag: null,
  };
  state.phase = 'setup';
  state.result = null;
  state.tackle = null;
  events.push({ type: 'downStarted', down: series.down, toGo: series.firstDown - series.los });
}

/**
 * The patrols ahead (docs/DIFFICULTY.md, "The long field"): each stretch past
 * the line's own keeps its patrolling defenders on the field, lined up as if
 * its defense stood at the stretch's start, with that stretch's stats. Hard
 * mode's extra defenders are the down's only (p1), and its cap counts only
 * the down's defense (p3).
 */
function patrolsAhead(state: RunState, firstId: number): Defender[] {
  const { area, stretch } = state.series;
  const ahead: Defender[] = [];
  for (let k = stretch + 1; k < SERIES_KINDS.length; k++) {
    const spec = defenseFor(area, k);
    const patrolling = {
      ...spec,
      defenders: spec.defenders.filter((d) => DEFENDERS[d.kind].patrols),
    };
    const boost = defenseBoost(state, area, stretchKind(k), spec);
    // Lined up from the stretch's start. The down's first-down line rides along, but only a
    // Safety reads it (bodies.ts), and Safeties never patrol.
    const from = { ...state.series, los: stretchStart(k) };
    ahead.push(...lineUpDefense(patrolling, from, boost, firstId + ahead.length));
  }
  return ahead;
}

/**
 * A copy of the run to change, for step() and dispatch(). The playbook is
 * shared, not copied: plays are read-only, and copying them every step made
 * the sim about a sixth slower.
 */
export function cloneRun(prev: RunState): RunState {
  const { playbook, ...rest } = prev;
  return { ...structuredClone(rest), playbook };
}

/** Apply an action between steps. Pure, like step(). Invalid actions change nothing. */
export function dispatch(prev: RunState, action: Action): ArcadeResult {
  const state = cloneRun(prev);
  const events: ArcadeEvent[] = [];
  switch (action.type) {
    case 'call':
      call(state, action.hand, events);
      break;
    case 'flip':
      flip(state, events);
      break;
    case 'hotRoute':
      hotRoute(state, action.slot, events);
      break;
    case 'hike':
      hike(state, events);
      break;
    case 'skipDraft':
      // On the offer it's Skip, which takes nothing and goes on to Your team (x1); on Your team, PLAY ON.
      if (state.phase === 'draft' && state.offer.length > 0) state.offer = [];
      else if (state.phase === 'draft') leaveDraft(state);
      break;
    case 'pick':
      pick(state, action.offer, events);
      break;
    case 'swap':
      swap(state, action.a, action.b);
      break;
  }
  noteGrowth(state, events);
  return { state, events };
}

/**
 * Call a play card (mirrored if Flip is on): your players take its
 * assignments where they stand, so its routes show on the field. Another
 * card can still be called instead, until the hike. A card banned by the
 * Queen's Royal Decree can't be called. Calling a card, the same one
 * included, is a new play: every hot route goes (b4).
 */
function call(state: RunState, hand: number, events: ArcadeEvent[]): void {
  const index = state.hand[hand];
  const play = index === undefined ? undefined : state.playbook[index];
  if (state.phase !== 'setup' || index === undefined || !play) return;
  if (hand === state.banned) {
    events.push({ type: 'banned' });
    return;
  }
  state.called = hand;
  state.play = { index, flipped: state.flipped };
  state.hotRoutes = {};
  relineTeam(state);
  events.push({ type: 'called', id: play.id, play: play.name, flipped: state.flipped });
}

/**
 * Flip: the cards mirrored, and a called play mirrored where it stands, its
 * hot routes with it (b4). A hot route that would now leave the field from
 * where its player lines up goes back to the card's (it can, on a play
 * whose line-up isn't the same on both sides).
 */
function flip(state: RunState, events: ArcadeEvent[]): void {
  if (state.phase !== 'setup') return;
  state.flipped = !state.flipped;
  const play = state.playbook[state.play.index];
  if (state.called === null || !play) return;
  state.play = { index: state.play.index, flipped: state.flipped };
  const dropped = Object.entries(state.hotRoutes)
    .map(([slot, route]) => ({ slot: Number(slot), route }))
    .filter(({ slot, route }) => route && !hotRoutesFor(play, slot, state.flipped).includes(route));
  for (const { slot } of dropped) state.hotRoutes = hotRouteSet(state.hotRoutes, slot, null);
  relineTeam(state);
  events.push({ type: 'called', id: play.id, play: play.name, flipped: state.flipped });
  for (const { slot } of dropped) events.push(hotRouteEvent(state, slot));
}

/**
 * Whether Route works for this roster slot now (docs/PLAYER_MENU.md, b1,
 * c1): before the snap, once a card is called, for a player who can take a
 * hot route on it and has one that fits. The player's menu greys Route
 * otherwise, and the action does nothing.
 */
export function routeWorks(state: RunState, slot: number): boolean {
  const play = state.playbook[state.play.index];
  if (state.phase !== 'setup' || state.called === null || !play || !state.roster[slot])
    return false;
  return hotRoutesFor(play, slot, state.flipped).length > 0;
}

/** Route on the player's menu: their next hot route round the loop, drawn on the field at once (c1). Free, as often as you like, until HIKE! (b5). */
function hotRoute(state: RunState, slot: number, events: ArcadeEvent[]): void {
  const play = state.playbook[state.play.index];
  if (!play || !routeWorks(state, slot)) return;
  const next = nextHotRoute(play, slot, state.flipped, state.hotRoutes[slot] ?? null);
  state.hotRoutes = hotRouteSet(state.hotRoutes, slot, next);
  relineTeam(state);
  events.push(hotRouteEvent(state, slot));
}

/** The play log's line for a player's hot route as it now stands (b7). */
function hotRouteEvent(state: RunState, slot: number): ArcadeEvent {
  // Every roster slot is on the field before the snap (lineUpTeam), so -1 is never written.
  const id = state.field.players.find((p) => p.slot === slot)?.id ?? -1;
  return { type: 'hotRoute', id, slot, route: state.hotRoutes[slot] ?? null };
}

/** The hike: the called play starts, Covers pick their marks, and a handoff play gives its Runner the ball. */
function hike(state: RunState, events: ArcadeEvent[]): void {
  const play = state.playbook[state.play.index];
  if (state.phase !== 'setup' || state.called === null || !play) return;
  state.phase = 'play';
  state.snappedAt = state.time;
  // A field event (Frog Rain): on its way.
  const on = state.field.fieldEvent;
  if (on) on.left = on.event.goesOff;
  assignMarks(state);
  events.push({ type: 'snapped' });
  const runner =
    play.handoff === undefined
      ? undefined
      : state.field.players.find(
          (p) => p.slot === playSlot(play.handoff ?? -1, state.play.flipped),
        );
  if (!runner) return;
  const hole = runner.job.kind === 'route' ? runner.job.to[runner.job.to.length - 1] : undefined;
  // It keeps its planned route in mind: it leans toward it when it picks its lane (ai.ts).
  state.field.runPath = runner.job.kind === 'route' ? [runner.pos, ...runner.job.to] : null;
  runner.job = { kind: 'carry' };
  state.field.ball = { at: 'carried', by: runner.id };
  state.field.lane = hole?.x ?? runner.pos.x;
  events.push({ type: 'handoff', id: runner.id });
}

// ── TRICK OR TREAT! ─────────────────────────────────────────────────────────

/**
 * Take an offer card (docs/REWARDS.md, o1). A new play goes into the
 * playbook. A perk applies for the rest of the run. A new player goes
 * straight into the field slot it improves most (bestSpot), and whoever was
 * there sits on the bench; if it beats nobody, it sits on the bench itself.
 * The bench has no limit and the newest sit at the top. Whichever it is,
 * Your team (docs/REWARDS.md, v2) then stays up, with each player's growth,
 * until PLAY ON; in hard mode (or with `trickOrTreat.setLineup` on) its
 * players can be swapped there.
 */
function pick(state: RunState, index: number, events: ArcadeEvent[]): void {
  const card = state.offer[index];
  if (state.phase !== 'draft' || !card) return;
  events.push({ type: 'picked', card });
  state.offer = [];
  if (card.kind === 'play') {
    // In the playbook for the rest of the run (o2): dealt from the next down.
    state.playbook = [...state.playbook, card.play];
    return;
  }
  if (card.kind === 'perk') {
    applyPerk(state.perks, card.perk);
    relineTeam(state);
    return;
  }
  const recruit = card.player;
  const slot = bestSpot(state, recruit);
  const replaced = slot === null ? null : (state.roster[slot] ?? null);
  if (slot !== null) state.roster[slot] = recruit;
  events.push({
    type: 'joined',
    id: recruit.id,
    name: recruit.name,
    slot: slot ?? -1,
    replaced: replaced?.name ?? null,
  });
  state.bench.unshift(replaced ?? recruit);
  relineTeam(state);
}

/** Swap two players' spots, field or bench (any player can play any position). */
function swap(state: RunState, a: number, b: number): void {
  const pa = atSpot(state, a);
  const pb = atSpot(state, b);
  if (state.phase !== 'draft' || !setsLineup(state)) return;
  if (!pa || !pb || a === b) return;
  setSpot(state, a, pb);
  setSpot(state, b, pa);
  relineTeam(state);
}

/**
 * On to the next series (its defense is already lined up): your team, as it
 * now is, lines up too, and what it gains is counted afresh for the next
 * Your team.
 */
function leaveDraft(state: RunState): void {
  state.offer = [];
  state.gains = {};
  state.phase = 'setup';
  relineTeam(state);
}

/**
 * Line your players up again where they stand, with the roster, perks, play,
 * Flip and hot routes as they now are: the one place a down's team is lined
 * up again once it's on the field.
 */
function relineTeam(state: RunState): void {
  const card = state.playbook[state.play.index];
  const firstId = state.field.players[0]?.id;
  if (!card || firstId === undefined) return;
  const play = withHotRoutes(card, state.hotRoutes, state.flipped);
  state.field.players.splice(
    0,
    state.field.players.length,
    ...lineUpTeam(state, play, state.flipped, state.series.los, firstId),
  );
}

/**
 * End the down: move the line of scrimmage, and show what happened for a moment.
 * A carrier down at or past the line has made it, however the down ended: a
 * tackle, a drag, a gravestone, an event (B6, review b1). The one place that says so.
 */
export function endDown(
  state: RunState,
  ended: DownResult,
  newLos: number,
  events: ArcadeEvent[],
): void {
  const { series } = state;
  const carried = ended === 'tackled' || ended === 'outOfBounds' || ended === 'touchdown';
  // Over the goal line from anywhere is a touchdown (b4); past the line to gain, a first down.
  const result: DownResult =
    carried && newLos >= AREA_YARDS
      ? 'touchdown'
      : carried && newLos >= series.firstDown
        ? 'firstDown'
        : ended;
  const wanted = result === 'touchdown' ? AREA_YARDS : newLos;
  // A loss counts on any down, back to a floor behind the area's start (docs/LONG_FIELD.md, a3).
  const los = Math.max(-arcadeTuning.series.furthestBack, wanted);
  const gained = los - series.los;
  series.los = los;
  state.yards += gained;
  state.result = { result, gained };
  state.phase = 'downOver';
  state.pause = arcadeTuning.series.pause;
  events.push({ type: 'downEnded', result, gained });
}

/** After a finished down: a won series moves on (or wins the run), a 4th-down failure ends it, otherwise the next down (in practice, the same spot again). */
export function nextDown(state: RunState, events: ArcadeEvent[]): void {
  const { series, result } = state;
  // Practice: whatever happened, the next rep lines up where the first one did.
  if (state.practice) {
    series.down = 1;
    series.los = series.start;
    setUpDown(state, events);
    return;
  }
  if (result?.result === 'firstDown' || result?.result === 'touchdown') {
    state.seriesWon++;
    events.push({ type: 'seriesWon', stretch: series.stretch });
    const touchdown = result.result === 'touchdown';
    if (touchdown) events.push({ type: 'areaCleared', area: series.area });
    // The run is won after the last area (hard mode goes round again).
    if (touchdown && !state.hard && series.area >= arcadeTuning.run.areas - 1) {
      state.phase = 'won';
      return;
    }
    // TRICK OR TREAT! happens in front of the next series, already lined up (its zone sets the offer):
    // the next area's from its start, or this area's from where the ball was downed (a1).
    if (touchdown) setUpSeries(state, series.area + 1, 0, events, false);
    else setUpSeries(state, series.area, series.los, events, false);
    state.offer = rollOffer(state);
    return;
  }
  if (series.down >= arcadeTuning.series.downs) {
    state.phase = 'over';
    events.push({ type: 'gameOver', seriesWon: state.seriesWon, yards: state.yards });
    return;
  }
  series.down++;
  setUpDown(state, events);
}

/** Whether a down is on: lined up, in play, or frozen for a test (the banner shows down and distance). */
export function downOn(phase: Phase): boolean {
  switch (phase) {
    case 'setup':
    case 'play':
    case 'breakit':
    case 'snag':
    case 'tip':
      return true;
    case 'downOver':
    case 'draft':
    case 'over':
    case 'won':
      return false;
    default:
      return assertNever(phase);
  }
}

/** Whether the play is frozen for a tap test (Break it!, SNAG IT!, the tip drill). */
export function frozenForTest(phase: Phase): boolean {
  return phase === 'breakit' || phase === 'snag' || phase === 'tip';
}

/** Less than any distance the game measures; what a float's rounding leaves over. */
const FLOAT_SLACK = 1e-9;

/**
 * Down and distance, e.g. "3rd & 4", or "3rd & Goal" when the line to gain is
 * the goal line (r3). Yards round up, but a float's leftover past a whole
 * yard doesn't count: `los + 10 - los` can come out 10.000000000000004,
 * which read "1st & 11" (B10).
 */
export function downAndDistance(state: RunState): string {
  const { down, firstDown, los } = state.series;
  const ordinal = ['1st', '2nd', '3rd', '4th'][down - 1] ?? `${down}th`;
  const toGo =
    firstDown >= AREA_YARDS ? 'Goal' : Math.max(1, Math.ceil(firstDown - los - FLOAT_SLACK));
  return `${ordinal} & ${toGo}`;
}
