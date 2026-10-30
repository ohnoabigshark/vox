/**
 * Headless balance runs for the arcade sim (src/arcade): plays whole runs
 * straight through the simulation (no rendering, no audio, no browser) with
 * a bot, and reports how far teams get, how downs end and how long they
 * take. For comparing team builds and tuning numbers, not for absolute
 * difficulty: the bot is a decent player, not a perfect one.
 *
 *   npm run balance:arcade [runs per scenario]
 *
 * The bot plays like a practised player by default: it calls a random pass
 * card (never a handoff while it has a pass; Flip half the time), and
 * throws when it knows the bullet would be caught deep enough: early in
 * the pocket at the first-down line, settling for anything past the line
 * of scrimmage as the pocket runs out (it looks ahead by simulating the
 * throw). In Break it! it plays like a fair person, BAD about one time in
 * ten at an even match: on the bar it aims for the middle of the sweet
 * spot with a timing error, it mashes at about 7½ taps a second, and it
 * jukes the right way 91% of the time, about a quarter second after the
 * arrow shows.
 *
 * BALANCE_SCENARIO='{"name": "Hard", "hard": true, "perks": true}' plays
 * hard mode (until the run is lost) and reports how many drives runs win.
 *
 * BOT='{"predict": false}' reads the field off the screen instead (lit,
 * green, deep), BOT='{"predict": false, "read": false}' throws at the first
 * catchable moment, and BOT='{"passOnly": false}' calls handoffs too: the
 * older, weaker bots. See BOT below for every knob.
 */
import { pocketTime } from '../src/arcade/sim/ball';
import { DRIVE_KINDS, createRun, dispatch, startingRoster } from '../src/arcade/sim/run';
import { FORM_STATS } from '../src/arcade/content/team';
import { rngFor } from '../src/arcade/sim/random';
import { plus } from '../src/arcade/sim/stats';
import { breakMarker, jukeShowing } from '../src/arcade/sim/breakit';
import { canThrow, step } from '../src/arcade/sim/step';
import type { ArcadeEvent, Form, Role, RunState, Stats, StepInput } from '../src/arcade/sim/types';
import { dist } from '../src/arcade/sim/vec';
import { litPlayers } from '../src/arcade/render/sweep';
import type { Rng } from '../src/sim/rng';

const RUNS = Number(process.argv[2]) || 200;

/** How the bot plays. BOT='{"read": false, ...}' overrides any of these. */
const BOT = {
  /**
   * Read the field like a person: throw only while the line is over an open
   * receiver (a green ring), and early in the pocket only a deep one, at or
   * past the first-down line; the depth it wants shrinks to the line of
   * scrimmage as the pocket runs out. Off: throw at the first catchable moment.
   */
  read: true,
  /**
   * Know where a throw would really be caught (a practised player who leads
   * receivers): looks ahead by simulating the throw, every few steps. Uses
   * the same depth it wants as `read`. Slow.
   */
  predict: true,
  /** Never call a handoff while there's a pass card in the hand. */
  passOnly: true,
  /** Always call a handoff when there's one in the hand (for measuring the run game). */
  runOnly: false,
  /**
   * Of the steps where it would throw, the share it reacts on (a person isn't
   * instant). Tuned so about 20% of downs end incomplete at the sweep's speed.
   */
  react: 0.3,
  /** With this share of the pocket left, it gives up waiting and throws anyway. */
  panic: 0.12,
  /** Bar: it aims for the middle of the sweet spot, off by a normal error this big (a share of the meter). */
  barError: 0.14,
  /** Mash: taps a second. */
  mashRate: 7.5,
  /** Juke: how long it takes to react to the arrow (seconds, a normal spread), and how often it picks the right side. */
  jukeReaction: 0.26,
  jukeSpread: 0.07,
  jukeRight: 0.91,
  ...(JSON.parse(process.env.BOT ?? '{}') as object),
};

interface Scenario {
  readonly name: string;
  /** Forms by role (default: all human). */
  readonly forms?: Partial<Record<Role, Form>>;
  /** Training added to every player's stats… */
  readonly training?: Partial<Stats>;
  /** …or only to one role's. */
  readonly roleTraining?: Partial<Record<Role, Partial<Stats>>>;
  /** Take one of TRICK OR TREAT!'s two new players (at random) after each won drive, or skip. */
  readonly perks?: boolean;
  /** Hard mode: the zones go round until the run is lost (reported as drives won per run). */
  readonly hard?: boolean;
}

/** BALANCE_SCENARIO='{"name": "...", ...}' runs just that one scenario instead. */
const custom = process.env.BALANCE_SCENARIO;
const SCENARIOS: readonly Scenario[] = custom
  ? [JSON.parse(custom) as Scenario]
  : [
      { name: 'All human (never upgrade)' },
      { name: 'A new player every time', perks: true },
      { name: 'Trained: +10 Hustle', training: { hustle: 10 } },
      { name: 'Trained: +10 Hands', training: { hands: 10 } },
      { name: 'Trained: +10 Heft', training: { heft: 10 } },
      { name: 'Golem Blockers', forms: { blocker: 'golem' } },
      { name: 'Werewolf Runners', forms: { runner: 'werewolf' } },
      { name: 'Ghost Catchers', forms: { catcher: 'ghost' } },
      {
        name: 'All three monsters',
        forms: { blocker: 'golem', runner: 'werewolf', catcher: 'ghost' },
      },
    ];

interface Tally {
  runs: number;
  drivesWon: number;
  /** Each run's drives won, for hard mode's spread. */
  perRun: number[];
  fullWins: number;
  attempts: Map<string, number>;
  wins: Map<string, number>;
  downs: number;
  downTime: number;
  yards: number;
  results: Map<string, number>;
  passes: number;
  handoffs: number;
  /** Yards and downs on handoffs, and on everything else. */
  run: { yards: number; downs: number; gains: number[] };
  pass: { yards: number; downs: number; gains: number[] };
  catches: number;
  contested: number;
  pancakes: number;
  grabs: number;
  drags: number;
  /** Passes batted down, by who did it. */
  battedBy: Map<string, number>;
  breaks: number;
  /** On handoffs: how far past the line the carrier was first grabbed, and by what. */
  runGrabs: number[];
  runGrabbers: Map<string, number>;
  /** Break it! results by kind: "bar tackle" → count. */
  breakResults: Map<string, number>;
}

const bump = (m: Map<string, number>, k: string, by = 1): void => {
  m.set(k, (m.get(k) ?? 0) + by);
};

/** Its plan for a Break it!: where on the meter it will tap. */
interface Plan {
  tackleAt: number;
  tapAt: number;
  /** Juke: when it saw the arrow, and which side it'll tap. */
  sawAt: number | null;
  side: -1 | 1;
  reaction: number;
  /** SHOO!: when it saw the crows land, and how long it'll take to tap. */
  shooSaw: number | null;
  shooReaction: number;
}

/** A standard normal draw (Box-Muller). */
function normal(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
}

/** Whether a bullet fired along the line right now would be caught, with everyone where they stand. */
function wouldCatch(state: RunState): boolean {
  return litPlayers(state).size > 0;
}

/**
 * What a person reads off the screen: the line is over a receiver (it's lit
 * gold), its ring is green (no defender could reach a ball there), and it's
 * deep enough. Early on it wants the first-down line; as the pocket runs out
 * (`left` from 1 to 0) it settles for anyone past the line of scrimmage.
 */
function readsOpen(state: RunState, left: number): boolean {
  const want = wantedDepth(state, left);
  const lit = litPlayers(state);
  return state.field.players.some(
    (p) =>
      lit.has(p.id) &&
      p.pos.y >= want &&
      state.field.defenders.every((d) => d.down > 0 || dist(d.pos, p.pos) > d.reach + 0.5),
  );
}

/** The depth it wants a catch at: the first-down line early in the pocket, the line of scrimmage at the end. */
function wantedDepth(state: RunState, left: number): number {
  const { los, firstDown } = state.drive;
  return los + (firstDown - los) * Math.min(1, left / 0.6);
}

/** Throw now (in a copy) and follow the ball: is it caught, at or past the depth it wants? */
function predictsCatch(state: RunState, left: number): boolean {
  let s = structuredClone(state);
  for (let i = 0; i < 120; i++) {
    const r = step(s, i === 0 ? { throw: true } : {});
    s = r.state;
    for (const e of r.events) {
      if (e.type === 'caught') {
        const by = s.field.players.find((p) => p.id === e.id);
        return (by?.pos.y ?? -Infinity) >= wantedDepth(state, left);
      }
      if (e.type === 'batted' || e.type === 'incomplete' || e.type === 'downEnded') return false;
    }
  }
  return false;
}

function botInput(state: RunState, rng: Rng, plan: Plan): StepInput {
  if (state.phase === 'breakit' && state.tackle) {
    const t = state.tackle;
    const fresh = plan.tackleAt !== t.startedAt;
    if (fresh) {
      plan.tackleAt = t.startedAt;
      plan.sawAt = null;
    }
    switch (t.kind) {
      case 'bar':
        if (fresh) {
          plan.tapAt = (t.sweet.from + t.sweet.to) / 2 + BOT.barError * normal(rng);
        }
        return (breakMarker(state) ?? 0) >= plan.tapAt ? { breakTap: true } : {};
      case 'mash':
        return rng.next() < BOT.mashRate / 60 ? { breakTap: true } : {};
      case 'juke':
        if (!jukeShowing(state)) return {};
        if (plan.sawAt === null) {
          plan.sawAt = state.time;
          plan.side = rng.next() < BOT.jukeRight ? t.side : t.side === 1 ? -1 : 1;
          plan.reaction = Math.max(0.1, BOT.jukeReaction + BOT.jukeSpread * normal(rng));
        }
        return state.time - plan.sawAt >= plan.reaction ? { juke: plan.side } : {};
    }
  }
  // SHOO!: the King's crows have landed; it reacts like it does to a juke's arrow.
  const crows = state.field.crows;
  if (crows?.some((f) => f.phase === 'shoo')) {
    if (plan.shooSaw === null) {
      plan.shooSaw = state.time;
      plan.shooReaction = Math.max(0.1, BOT.jukeReaction + BOT.jukeSpread * normal(rng));
    }
    if (state.time - plan.shooSaw >= plan.shooReaction) return { shoo: true };
  } else {
    plan.shooSaw = null;
  }
  if (!canThrow(state)) return {};
  const left = 1 - (state.time - state.snappedAt) / pocketTime(state);
  if (left < BOT.panic) return { throw: true };
  const wants = BOT.predict
    ? Math.round(state.time * 60) % 3 === 0 && predictsCatch(state, left)
    : BOT.read
      ? readsOpen(state, left)
      : wouldCatch(state);
  if (wants && rng.next() < BOT.react) return { throw: true };
  return {};
}

function count(
  t: Tally,
  events: readonly ArcadeEvent[],
  state: RunState,
  ran: { now: boolean; grabbed: boolean },
): void {
  for (const e of events) {
    switch (e.type) {
      case 'thrown':
        t.passes++;
        break;
      case 'handoff':
        t.handoffs++;
        ran.now = true;
        break;
      case 'grabbed':
        t.grabs++;
        if (ran.now && !ran.grabbed) {
          ran.grabbed = true;
          const c = state.field.players.find((p) => p.id === e.id);
          if (c) t.runGrabs.push(c.pos.y - state.drive.los);
          for (const id of e.by) {
            const d = state.field.defenders.find((x) => x.id === id);
            bump(t.runGrabbers, d?.kind ?? '?');
          }
        }
        break;
      case 'dragged':
        t.drags++;
        break;
      case 'caught':
        t.catches++;
        if (e.contested) t.contested++;
        break;
      case 'pancake':
        t.pancakes++;
        break;
      case 'batted': {
        const by = state.field.defenders.find((d) => d.id === e.by);
        bump(t.battedBy, `${by ? by.kind : '?'}${e.contested ? ' (contested)' : ''}`);
        break;
      }
      case 'breakResult':
        bump(t.breakResults, `${state.tackle?.kind ?? '?'} ${e.outcome}`);
        break;
      case 'brokeTackle':
        t.breaks++;
        break;
      case 'downEnded':
        t.downs++;
        t.yards += e.gained;
        t.downTime += state.time - state.snappedAt;
        bump(t.results, e.result);
        {
          const kind = ran.now ? t.run : t.pass;
          kind.yards += e.gained;
          kind.downs++;
          kind.gains.push(e.gained);
        }
        ran.now = false;
        ran.grabbed = false;
        break;
      default:
        break;
    }
  }
}

/**
 * TRICK OR TREAT! for the bot: with `perks` on, one of the two new players
 * at random (it places itself: the sim's bestSpot); then Done. With `perks`
 * off, it skips (the never-upgrade baseline: the game itself has no Skip).
 */
function draftPick(state: RunState, rng: Rng, scenario: Scenario): RunState {
  if (!scenario.perks || state.offer.length === 0) {
    return dispatch(state, { type: 'skipDraft' }).state;
  }
  const s = dispatch(state, { type: 'pick', offer: rng.int(0, state.offer.length - 1) }).state;
  return s.phase === 'draft' ? dispatch(s, { type: 'skipDraft' }).state : s;
}

function playRun(seed: number, scenario: Scenario, t: Tally): void {
  const rng = rngFor(seed, 'bot');
  // Each scenario's team: the starting humans, turned into its kinds and given its training.
  const roster = startingRoster().map((p) => {
    const kind = scenario.forms?.[p.preferred] ?? p.kind;
    const extra = {
      hustle: 0,
      hands: 0,
      heft: 0,
      ...scenario.training,
      ...scenario.roleTraining?.[p.preferred],
    };
    return { ...p, kind, stats: plus(plus(p.stats, FORM_STATS[kind]), extra) };
  });
  let state = createRun(seed, roster, 0, { hard: scenario.hard ?? false });
  const plan: Plan = {
    tackleAt: -1,
    tapAt: 1,
    sawAt: null,
    side: 1,
    reaction: 0.3,
    shooSaw: null,
    shooReaction: 0.3,
  };
  const ran = { now: false, grabbed: false };
  let driveKey = '';
  for (let guard = 0; guard < 200000 && state.phase !== 'over' && state.phase !== 'won'; guard++) {
    const key = `${state.drive.area}:${state.drive.kind}`;
    if (key !== driveKey) {
      driveKey = key;
      bump(t.attempts, key);
    }
    if (state.phase === 'draft') {
      state = draftPick(state, rng, scenario);
      continue;
    }
    if (state.phase === 'setup') {
      if (rng.next() < 0.5) state = dispatch(state, { type: 'flip' }).state;
      const runs = state.hand
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => state.playbook[c]?.handoff !== undefined && i !== state.banned);
      const passes = state.hand
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => state.playbook[c]?.handoff === undefined && i !== state.banned);
      const hand =
        BOT.runOnly && runs.length > 0
          ? (rng.pick(runs)?.i ?? 0)
          : BOT.passOnly && passes.length > 0
            ? (rng.pick(passes)?.i ?? 0)
            : (rng.pick([...runs, ...passes])?.i ?? 0);
      const called = dispatch(state, { type: 'call', hand }).state;
      const hiked = dispatch(called, { type: 'hike' });
      count(t, hiked.events, state, ran);
      state = hiked.state;
      continue;
    }
    const r = step(state, botInput(state, rng, plan));
    if (r.events.some((e) => e.type === 'driveWon')) bump(t.wins, key);
    count(t, r.events, state, ran);
    state = r.state;
  }
  t.runs++;
  t.drivesWon += state.drivesWon;
  t.perRun.push(state.drivesWon);
  if (state.phase === 'won') t.fullWins++;
}

const pct = (a: number, b: number): string =>
  b === 0 ? '  —  ' : `${((100 * a) / b).toFixed(0).padStart(3)}%`;

/** How a play's gains spread: mean, standard deviation, and the share in each band. */
function spread(gains: readonly number[]): string {
  const n = gains.length;
  const mean = gains.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(gains.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const band = (lo: number, hi: number): string =>
    pct(gains.filter((g) => g >= lo && g < hi).length, n);
  return (
    `mean ${mean.toFixed(1)} sd ${sd.toFixed(1)} · ≤0 ${band(-99, 0.5)} · 1-2 ${band(0.5, 2.5)} · ` +
    `3-5 ${band(2.5, 5.5)} · 6-9 ${band(5.5, 9.5)} · 10+ ${band(9.5, 999)}`
  );
}

function report(scenario: Scenario, t: Tally): void {
  console.log(`\n## ${scenario.name}  (${t.runs} runs)`);
  console.log(
    `  drives won ${(t.drivesWon / t.runs).toFixed(1)} of 12 · beat the game ${pct(t.fullWins, t.runs)} · ` +
      `yards/down ${(t.yards / t.downs).toFixed(1)} · down length ${(t.downTime / t.downs).toFixed(1)}s`,
  );
  if (scenario.hard) {
    const sorted = [...t.perRun].sort((a, b) => a - b);
    const at = (q: number): number =>
      sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    console.log(
      `  hard mode: drives won p10 ${at(0.1)} · median ${at(0.5)} · p90 ${at(0.9)} · best ${at(1)} (4 drives a zone)`,
    );
  }
  const results = [...t.results.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${pct(n, t.downs)}`)
    .join(' · ');
  console.log(`  downs end: ${results}`);
  const batted = [...t.battedBy.entries()].map(([k, n]) => `${k} ${n}`).join(', ');
  if (batted) console.log(`  batted by: ${batted}`);
  console.log(
    `  yards a run ${(t.run.yards / Math.max(1, t.run.downs)).toFixed(1)} (${t.run.downs}) · yards a pass play ${(t.pass.yards / Math.max(1, t.pass.downs)).toFixed(1)} · completions ${pct(t.catches, t.passes)} (contested ${pct(t.contested, t.catches)}) · ` +
      `pancakes ${(t.pancakes / t.runs).toFixed(1)}/run · Break it! ${t.grabs}: broke ${pct(t.breaks, t.grabs)}, dragged ${pct(t.drags, t.grabs)}`,
  );
  for (const [name, k] of [
    ['runs ', t.run],
    ['passes', t.pass],
  ] as const) {
    if (k.gains.length > 0) console.log(`  ${name} ${spread(k.gains)}`);
  }
  {
    const kinds = ['bar', 'mash', 'juke'].map((k) => {
      const n = (o: string): number => t.breakResults.get(`${k} ${o}`) ?? 0;
      const all = n('break') + n('drag') + n('tackle');
      return `${k} GREAT ${pct(n('break'), all)} OK ${pct(n('drag'), all)} BAD ${pct(n('tackle'), all)}`;
    });
    const bad = [...t.breakResults.entries()]
      .filter(([k]) => k.endsWith('tackle'))
      .reduce((a, [, n]) => a + n, 0);
    const all = [...t.breakResults.values()].reduce((a, n) => a + n, 0);
    console.log(`  Break it! BAD ${pct(bad, all)} · ${kinds.join(' · ')}`);
  }
  if (t.runGrabs.length > 0) {
    const g = [...t.runGrabs].sort((a, b) => a - b);
    const q = (f: number): string => (g[Math.floor(f * (g.length - 1))] ?? 0).toFixed(1);
    const by = [...t.runGrabbers.entries()].map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(
      `  handoffs first grabbed at (yards past the line) p10 ${q(0.1)} · median ${q(0.5)} · p90 ${q(0.9)} · by ${by}`,
    );
  }
  [0, 1, 2].forEach((area) => {
    const row = DRIVE_KINDS.map((k) => {
      const key = `${area}:${k}`;
      return `${k.padEnd(9)} ${pct(t.wins.get(key) ?? 0, t.attempts.get(key) ?? 0)}`;
    }).join('  ');
    console.log(`  area ${['I  ', 'II ', 'III'][area]}  ${row}`);
  });
}

console.log(`Arcade balance runs: ${RUNS} per scenario.`);
for (const scenario of SCENARIOS) {
  const t: Tally = {
    runs: 0,
    drivesWon: 0,
    perRun: [],
    fullWins: 0,
    attempts: new Map(),
    wins: new Map(),
    downs: 0,
    downTime: 0,
    yards: 0,
    results: new Map(),
    passes: 0,
    handoffs: 0,
    run: { yards: 0, downs: 0, gains: [] },
    pass: { yards: 0, downs: 0, gains: [] },
    catches: 0,
    contested: 0,
    pancakes: 0,
    grabs: 0,
    drags: 0,
    battedBy: new Map(),
    breaks: 0,
    runGrabs: [],
    runGrabbers: new Map(),
    breakResults: new Map(),
  };
  for (let seed = 1; seed <= RUNS; seed++) playRun(seed, scenario, t);
  report(scenario, t);
}
