/**
 * Creating a run, setting up drives and downs, and the actions between
 * steps (the snap, moving on after a drive). Steps are advanced by step()
 * in step.ts. See GAMEPLAY.md, The Run, A Drive and A Down.
 */
import { areaAt, type DefenseSpec } from '../content/defense';
import { PLAY_POOL } from '../content/playPool';
import type { Play } from '../content/plays';
import { playSlot } from '../content/team';
import { arcadeTuning } from '../content/tuning';
import { rngFor } from './random';
import { assignMarks } from './ai';
import { pickupsForDrive } from './pickups';
import { BOSS_SPOT, drivePropsWithBoss } from './props';
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
  Action,
  ArcadeEvent,
  ArcadeResult,
  DownResult,
  DriveKind,
  RosterPlayer,
  RunState,
  FrogLane,
  RoyalCrows,
} from './types';

export const DRIVE_KINDS: readonly DriveKind[] = ['intro', 'challenge', 'gimmick', 'boss'];

/** Seven plain humans (sim/team.ts). */
export { startingRoster };

/** The defense for a drive: the area's Intro, Challenge, a seeded Gimmick, or its Boss. */
export function defenseFor(seed: number, area: number, index: number): DefenseSpec {
  const a = areaAt(area);
  switch (DRIVE_KINDS[index]) {
    case 'intro':
      return a.intro;
    case 'challenge':
      return a.challenge;
    case 'gimmick':
      return a.gimmick;
    default:
      return a.boss;
  }
}

/**
 * A drive's defense as it lines up: its spec, plus in hard mode one more
 * defender for every zone after the first (never past `maxDefenders` on the
 * field), alternately a Cover and a Bat, spread over the field.
 */
export function driveDefense(state: RunState, area: number, index: number): DefenseSpec {
  const spec = defenseFor(state.seed, area, index);
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

/** How much stiffer a drive's defense is than its spec: more each area (faster in hard mode), more on the Boss. */
export function defenseBoost(
  state: RunState,
  area: number,
  kind: DriveKind,
  spec: DefenseSpec,
): number {
  const d = arcadeTuning.defense;
  const perArea = state.hard ? arcadeTuning.hard.statsPerZone : d.perArea;
  return area * perArea + (kind === 'boss' ? d.boss : 0) + spec.boost;
}

/**
 * A new run. `startArea` (0-based) starts it at that area's first drive
 * instead, as if the drives before it were won (for trying later areas).
 */
export function createRun(
  seed: number,
  roster: RosterPlayer[] = startingRoster(),
  startArea = 0,
  options: {
    readonly hard?: boolean;
    readonly twoTapAim?: boolean;
    /** The plays it deals from; the whole play pool if not given. */
    readonly playbook?: readonly Play[];
    /**
     * Practice (the play editor's Try it): this play is the whole playbook,
     * called at every setup, and every rep lines up the same spot again.
     */
    readonly practice?: Play;
  } = {},
): RunState {
  const state: RunState = {
    seed,
    playbook: options.practice ? [options.practice] : (options.playbook ?? PLAY_POOL),
    practice: options.practice !== undefined,
    taken: [],
    hard: options.hard ?? false,
    twoTapAim: options.twoTapAim ?? false,
    step: 0,
    time: 0,
    phase: 'setup',
    drive: { area: 0, index: 0, kind: 'intro', name: '', start: 0, firstDown: 0, down: 1, los: 0 },
    hand: [],
    called: null,
    banned: null,
    flipped: false,
    play: { index: 0, flipped: false },
    tackle: null,
    roster,
    bench: [],
    perks: noPerks(),
    offer: [],
    field: {
      players: [],
      defenders: [],
      props: [],
      pickups: [],
      frogLane: null,
      frogDump: null,
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
    drivesWon: 0,
    yards: 0,
    nextId: 1,
  };
  const area = Math.max(0, Math.min(startArea, arcadeTuning.run.areas - 1));
  state.drivesWon = area * DRIVE_KINDS.length;
  setUpDrive(state, area, 0, [], true);
  return state;
}

/**
 * Start a drive: the line of scrimmage at 0, 1st & 10, the defense lined up.
 * With `ready`, the first down is set up straight away; without, it waits
 * for the player to move on (after a won drive: the upgrade pick comes first).
 */
export function setUpDrive(
  state: RunState,
  area: number,
  index: number,
  events: ArcadeEvent[],
  ready: boolean,
): void {
  const spec = driveDefense(state, area, index);
  const start = 0;
  state.perks.secondWindUsed = false;
  state.drive = {
    area,
    index,
    kind: DRIVE_KINDS[index] ?? 'boss',
    name: spec.name,
    start,
    firstDown: start + arcadeTuning.drive.distance,
    down: 1,
    los: start,
  };
  const props = drivePropsWithBoss(state.seed, area, index, spec.boss);
  state.field = {
    ...state.field,
    props,
    // Practice tests the play by itself (map item k8); a pickup taken never comes back (k3).
    pickups: state.practice
      ? []
      : pickupsForDrive(state.seed, area, index).filter((p) => !state.taken.includes(p.id)),
  };
  events.push({ type: 'driveStarted', drive: index, name: spec.name });
  setUpDown(state, events);
  if (!ready) state.phase = 'draft';
}

/** Frog Rain: this down's lane, in from a sideline picked at random (never over the pumpkin), so you can Flip away from it. */
function frogLane(state: RunState): FrogLane {
  const f = arcadeTuning.frogRain;
  const rng = rngFor(state.seed, 'frogLane', state.drivesWon, state.drive.down, state.nextId);
  const { los } = state.drive;
  const hw = arcadeTuning.field.halfWidth;
  const half = hw * f.width;
  const side = rng.next() < 0.5 ? -1 : 1;
  return { x: side * (hw - half), half, from: los - f.behind, to: los + f.ahead };
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
  const { drive } = state;
  const rng = rngFor(state.seed, 'hand', state.drivesWon, drive.down, state.nextId);
  const deck = state.playbook.map((_, i) => i);
  state.hand = [];
  while (state.hand.length < Math.min(HAND, state.playbook.length)) {
    state.hand.push(deck.splice(rng.int(0, deck.length - 1), 1)[0] ?? 0);
  }
  // Practice deals its one play, already called.
  state.called = state.practice ? 0 : null;
  const spec = driveDefense(state, drive.area, drive.index);
  // The Queen's Royal Decree: one card of the three is banned this down.
  state.banned = spec.decree ? rng.int(0, state.hand.length - 1) : null;
  const first = state.banned === 0 ? 1 : 0;
  state.play = { index: state.hand[first] ?? 0, flipped: state.flipped };
  const play = state.playbook[state.play.index];
  if (!play) throw new Error('The playbook has no plays');
  const players = lineUpTeam(state, play, state.flipped, drive.los, state.nextId);
  state.nextId += players.length;
  const boost = defenseBoost(state, drive.area, drive.kind, spec);
  const defenders = lineUpDefense(spec, drive, boost, state.nextId);
  state.nextId += defenders.length;
  state.field = {
    players,
    defenders,
    props: state.field.props,
    pickups: state.field.pickups,
    frogLane: spec.frogRain ? frogLane(state) : null,
    frogDump: null,
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
  events.push({ type: 'downStarted', down: drive.down, toGo: drive.firstDown - drive.los });
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
      if (state.phase !== 'setup') break;
      state.flipped = !state.flipped;
      // A called play is mirrored where it stands.
      if (state.called !== null) call(state, state.called, events);
      break;
    case 'hike':
      hike(state, events);
      break;
    case 'skipDraft':
      if (state.phase === 'draft') leaveDraft(state);
      break;
    case 'pick':
      pick(state, action.offer, events);
      break;
    case 'swap':
      swap(state, action.a, action.b);
      break;
  }
  return { state, events };
}

/**
 * Call a play card (mirrored if Flip is on): your players take its
 * assignments where they stand, so its routes show on the field. Another
 * card can still be called instead, until the hike. A card banned by the
 * Queen's Royal Decree can't be called.
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
  const firstId = state.field.players[0]?.id ?? state.nextId;
  state.field.players.splice(
    0,
    state.field.players.length,
    ...lineUpTeam(state, play, state.flipped, state.drive.los, firstId),
  );
  events.push({ type: 'called', play: play.name, flipped: state.flipped });
}

/** The hike: the called play starts, Covers pick their marks, and a handoff play gives its Runner the ball. */
function hike(state: RunState, events: ArcadeEvent[]): void {
  const play = state.playbook[state.play.index];
  if (state.phase !== 'setup' || state.called === null || !play) return;
  state.phase = 'play';
  state.snappedAt = state.time;
  // Frog Rain: the frogs are on their way.
  state.field.frogDump = state.field.frogLane ? arcadeTuning.frogRain.dumpAt : null;
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
 * Take a new player on offer. It goes straight into the field slot it
 * improves most (bestSpot), and whoever was there sits on the bench; if it
 * beats nobody, it sits on the bench itself. The bench has no limit and the
 * newest sit at the top. With `trickOrTreat.setLineup` on, the roster then
 * stays open to rearrange, then Done; otherwise play goes straight on.
 * (Any other perk, a Boss's, applies and play goes on.)
 */
function pick(state: RunState, index: number, events: ArcadeEvent[]): void {
  const perk = state.offer[index];
  if (state.phase !== 'draft' || !perk) return;
  events.push({ type: 'perk', perk });
  if (perk.kind !== 'recruit') {
    applyPerk(state.perks, perk);
    leaveDraft(state);
    return;
  }
  state.offer = [];
  const recruit = perk.player;
  const slot = bestSpot(state, recruit);
  const replaced = slot === null ? null : (state.roster[slot] ?? null);
  if (slot !== null) state.roster[slot] = recruit;
  events.push({
    type: 'joined',
    name: recruit.name,
    slot: slot ?? -1,
    replaced: replaced?.name ?? null,
  });
  state.bench.unshift(replaced ?? recruit);
  relineTeam(state);
  if (!setsLineup(state)) leaveDraft(state);
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

/** On to the next drive (its defense is already lined up): your team, as it now is, lines up too. */
function leaveDraft(state: RunState): void {
  state.offer = [];
  state.phase = 'setup';
  relineTeam(state);
}

/** Line your players up again where they stand, with the roster and perks as they now are. */
function relineTeam(state: RunState): void {
  const play = state.playbook[state.play.index];
  const firstId = state.field.players[0]?.id;
  if (!play || firstId === undefined) return;
  state.field.players.splice(
    0,
    state.field.players.length,
    ...lineUpTeam(state, play, state.flipped, state.drive.los, firstId),
  );
}

/** End the down: move the line of scrimmage, and show what happened for a moment. */
export function endDown(
  state: RunState,
  result: DownResult,
  newLos: number,
  events: ArcadeEvent[],
): void {
  const { drive } = state;
  const wanted = result === 'firstDown' ? Math.max(newLos, drive.firstDown) : newLos;
  // Never behind the drive's start (there's no room for the QB).
  const los = Math.max(drive.start, wanted);
  const gained = los - drive.los;
  drive.los = los;
  state.yards += gained;
  state.result = { result, gained };
  state.phase = 'downOver';
  state.pause = arcadeTuning.drive.pause;
  events.push({ type: 'downEnded', result, gained });
}

/** After a finished down: a won drive moves on (or wins the run), a 4th-down failure ends it, otherwise the next down (in practice, the same spot again). */
export function nextDown(state: RunState, events: ArcadeEvent[]): void {
  const { drive, result } = state;
  // Practice: whatever happened, the next rep lines up where the first one did.
  if (state.practice) {
    drive.down = 1;
    drive.los = drive.start;
    setUpDown(state, events);
    return;
  }
  if (result?.result === 'firstDown') {
    state.drivesWon++;
    events.push({ type: 'driveWon', drive: drive.index });
    const lastDrive = drive.index >= DRIVE_KINDS.length - 1;
    if (lastDrive) events.push({ type: 'areaCleared', area: drive.area });
    // The run is won after the last area (hard mode goes round again).
    if (lastDrive && !state.hard && drive.area >= arcadeTuning.run.areas - 1) {
      state.phase = 'won';
      return;
    }
    // TRICK OR TREAT! happens in front of the next drive, already lined up (its zone sets the offer).
    if (lastDrive) setUpDrive(state, drive.area + 1, 0, events, false);
    else setUpDrive(state, drive.area, drive.index + 1, events, false);
    state.offer = rollOffer(state);
    return;
  }
  if (drive.down >= arcadeTuning.drive.downs) {
    state.phase = 'over';
    events.push({ type: 'gameOver', drivesWon: state.drivesWon, yards: state.yards });
    return;
  }
  drive.down++;
  setUpDown(state, events);
}

/** Down and distance, e.g. "3rd & 4", or "3rd & Goal" on the Boss drive. Yards round up. */
export function downAndDistance(state: RunState): string {
  const { down, firstDown, los, kind } = state.drive;
  const ordinal = ['1st', '2nd', '3rd', '4th'][down - 1] ?? `${down}th`;
  return `${ordinal} & ${kind === 'boss' ? 'Goal' : Math.max(1, Math.ceil(firstDown - los))}`;
}
