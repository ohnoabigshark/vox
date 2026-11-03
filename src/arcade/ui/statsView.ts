/**
 * What the stats screens show (docs/STATS.md, v1–v5), from the record and
 * the saved stats: pure, so it's tested without a page. Numbers are made
 * words here, at the edge: yards whole, yards a call to a tenth, days as
 * "Nov 2".
 */
import { areaAt, AREAS } from '../content/defense';
import { ACHIEVEMENTS, type AchievementId, type EarnedSet } from '../record/achievements';
import { SERIES_PER_AREA } from '../sim/props';
import type { Play } from '../content/plays';
import type { Form, Grade } from '../sim/types';
import {
  COMPLETION_PASSES,
  type AllTime,
  type Best,
  type Records,
  type RunSummary,
} from '../record/allTime';
import {
  completionRate,
  playerStats,
  playsStats,
  runStats,
  yardsPerCall,
  yardsPerRush,
  type PlayerStats,
  type RunStats,
} from '../record/stats';
import type { Saved } from '../record/store';
import {
  JACK,
  modeOf,
  type Mode,
  type RecordPlayer,
  type RunRecord,
  type TapTestKind,
} from '../record/types';

export interface Row {
  readonly label: string;
  readonly value: string;
  /** An all-time record this run set (RECORD on the card). */
  readonly record: boolean;
}
export interface Section {
  readonly title: string;
  readonly rows: readonly Row[];
}
export interface CardView {
  readonly title: string;
  readonly sub: string;
  readonly tiles: readonly Row[];
  readonly rows: readonly Row[];
  /** What the run newly earned, by name ("Air Mail · hard"). */
  readonly achievements: readonly string[];
}

/** The Achievements tab (v5) and the count under STATS (v4). */
export interface AchievementsView {
  readonly count: string;
  readonly earned: readonly {
    readonly name: string;
    readonly earns: string;
    readonly when: string;
  }[];
  readonly rest: readonly { readonly name: string; readonly earns: string }[];
}
export interface PlayerRow {
  readonly id: number;
  readonly name: string;
  /** Their kind, as a word; empty for Jack. */
  readonly kind: string;
  /** What they did, in a line. */
  readonly line: string;
  /** All their stats, for a tap. */
  readonly details: readonly Row[];
}
export interface PlayRow {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly mark: 'most used' | 'most successful' | 'both' | null;
  /** The record's copy of the play, for its drawing. */
  readonly play: Play | null;
}
export interface RunView {
  readonly heading: string;
  readonly players: readonly PlayerRow[];
  readonly team: readonly Section[];
  readonly plays: readonly PlayRow[];
}
export interface RunsRow {
  readonly id: string;
  readonly date: string;
  readonly where: string;
  readonly line: string;
}
export interface AllTimeView {
  readonly empty: boolean;
  readonly sections: readonly Section[];
}

const KIND: Readonly<Record<Form | 'jack', string>> = {
  // Jack is his own kind: his name says it.
  jack: '',
  human: 'Human',
  ghost: 'Ghost',
  golem: 'Golem',
  werewolf: 'Werewolf',
};
const TEST: Readonly<Record<TapTestKind, string>> = {
  bar: 'Break it! (bar)',
  mash: 'Break it! (mash)',
  juke: 'Break it! (juke)',
  snag: 'SNAG IT!',
  tip: 'Tip drill',
};
const GRADES: readonly Grade[] = ['great', 'ok', 'bad'];

const yds = (n: number): string => String(Math.round(n));
const percent = (share: number): string => `${Math.round(share * 100)}%`;
const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const row = (label: string, value: string | number, record = false): Row => ({
  label,
  value: typeof value === 'number' ? String(value) : value,
  record,
});
/** A day as "Nov 2", in the phone's own time zone. */
const day = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** How far a run got: the area by name (and which time round, in hard mode) and the series in it. */
function where(reached: RunRecord['reached']): string {
  const round = Math.floor(reached.area / AREAS.length) + 1;
  return [
    areaAt(reached.area).name,
    ...(round > 1 ? [`round ${round}`] : []),
    `series ${(reached.index % SERIES_PER_AREA) + 1}`,
  ].join(' · ');
}

/** Whether a run's value broke a record: there was one before it, and it's beaten (a first run breaks none). */
const broke = (before: Best | null | undefined, value: number): boolean =>
  before != null && value > before.value;

/**
 * The card at Game Over (v1) or a win (v3). `before`: the run's mode's
 * records as they were before it, so RECORD marks each one it broke.
 */
export function cardView(
  record: RunRecord,
  before: Records | null,
  earned: readonly AchievementId[] = [],
): CardView {
  const s = runStats(record);
  const won = record.end === 'won';
  const b = before;
  const players = [...playerStats(record)].filter(([id]) => id !== JACK);
  const name = (id: number): string => record.team.find((p) => p.id === id)?.name ?? `player ${id}`;
  /** A player's best this run, as its own row only when it broke the record. */
  const bestRun = (
    label: string,
    was: Best | null | undefined,
    of: (p: PlayerStats) => number,
  ): Row[] => {
    const top = players.reduce<[number, number] | null>(
      (m, [id, p]) => (m === null || of(p) > m[1] ? [id, of(p)] : m),
      null,
    );
    return top && broke(was, top[1]) ? [row(label, `${name(top[0])} ${yds(top[1])}`, true)] : [];
  };
  const rate = completionRate(s.passing);
  return {
    title: won ? 'You got Jack back!' : 'Game Over!',
    sub: `${won ? `All ${AREAS.length} areas` : where(record.reached)} · ${count(s.downs, 'down')}`,
    tiles: [
      row(
        s.firstDowns === 1 ? 'first down' : 'first downs',
        s.firstDowns,
        broke(b?.mostFirstDowns, s.firstDowns),
      ),
      row(s.touchdowns === 1 ? 'touchdown' : 'touchdowns', s.touchdowns),
      row(
        'passing',
        `${s.passing.completions}/${s.passing.passes}`,
        rate !== null && s.passing.passes >= COMPLETION_PASSES && broke(b?.bestCompletion, rate),
      ),
      row('rushes · yards', `${s.rushing.rushes} · ${yds(s.rushing.yards)}`),
    ],
    rows: [
      row('Yards', yds(s.yards), broke(b?.mostYards, s.yards)),
      row('Longest pass', yds(s.passing.longest), broke(b?.longestPass, s.passing.longest)),
      row('Longest rush', yds(s.rushing.longest), broke(b?.longestRush, s.rushing.longest)),
      row(
        'Tackles broken',
        s.contact.tacklesBroken,
        broke(b?.mostTacklesBroken, s.contact.tacklesBroken),
      ),
      ...bestRun('Best receiving run', b?.bestReceiving, (p) => p.catching.yards),
      ...bestRun('Best rushing run', b?.bestRushing, (p) => p.rushing.yards),
      ...bestRun('Best blocking run', b?.bestPancakes, (p) => p.pancakes),
    ],
    achievements: earned.map((id) => `${nameOf(id)}${record.modes.hard ? ' · hard' : ''}`),
  };
}

const nameOf = (id: AchievementId): string => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;

/** The Achievements tab (v5): earned first, with when and a hard mark (h1); then the rest, with what earns them. */
export function achievementsView(earned: EarnedSet): AchievementsView {
  const got = ACHIEVEMENTS.filter((a) => earned[a.id]);
  return {
    count: `🏆 ${got.length} of ${ACHIEVEMENTS.length}`,
    earned: got.map((a) => {
      const e = earned[a.id];
      return {
        name: a.name,
        earns: a.earns,
        when: e ? `${day(e.at)}${e.hard ? ' · hard' : ''}` : '',
      };
    }),
    rest: ACHIEVEMENTS.filter((a) => !earned[a.id]).map((a) => ({ name: a.name, earns: a.earns })),
  };
}

/** A player's stats in a line: by what they did. */
function line(p: PlayerStats, jack: boolean): string {
  if (jack) {
    const { completions, passes, yards, sacks } = p.passing;
    return [`${completions}/${passes}`, `${yds(yards)} yds`, count(sacks, 'sack')].join(' · ');
  }
  const parts: string[] = [];
  const c = p.catching;
  if (c.catches > 0) {
    parts.push(count(c.catches, 'catch', 'catches'), `${yds(c.yards)} yds`);
    if (Math.round(c.afterCatch) > 0) parts.push(`${yds(c.afterCatch)} after`);
  }
  const ru = p.rushing;
  if (ru.rushes > 0) parts.push(count(ru.rushes, 'rush', 'rushes'), `${yds(ru.yards)} yds`);
  if (p.contact.tacklesBroken > 0) parts.push(`${p.contact.tacklesBroken} broken`);
  if (p.pancakes > 0) parts.push(count(p.pancakes, 'pancake'));
  if (parts.length === 0 && c.targets > 0) parts.push(count(c.targets, 'target'));
  return parts.join(' · ');
}

const grades = (g: Record<Grade, number>): string =>
  GRADES.map((k) => `${k.toUpperCase()} ${g[k]}`).join(' · ');

function details(p: PlayerStats, jack: boolean): Row[] {
  if (jack) {
    return [
      row('Passes', p.passing.passes),
      row('Completions', p.passing.completions),
      row('Passing yards', yds(p.passing.yards)),
      row('Air yards', yds(p.passing.airYards)),
      row('Longest pass', yds(p.passing.longest)),
      row('Sacks taken', p.passing.sacks),
    ];
  }
  return [
    row('Targeted', p.catching.targets),
    row('Catches', p.catching.catches),
    row('Receiving yards', yds(p.catching.yards)),
    row('Yards after the catch', yds(p.catching.afterCatch)),
    row('Longest catch', yds(p.catching.longest)),
    row('Rushes', p.rushing.rushes),
    row('Rushing yards', yds(p.rushing.yards)),
    row('Longest rush', yds(p.rushing.longest)),
    row('Tackles broken', p.contact.tacklesBroken),
    row('Yards after contact', yds(p.contact.afterContact)),
    row('Tackles for loss', p.contact.tacklesForLoss),
    row('Pancakes', p.pancakes),
    row('Tap tests', grades(p.tapTests)),
    row('First downs', p.firstDowns),
    row('Touchdowns', p.touchdowns),
  ];
}

/** A run's full stats (v2): Players, Team and Plays. */
export function runView(record: RunRecord): RunView {
  const s = runStats(record);
  const stats = playerStats(record);
  const team: readonly RecordPlayer[] = record.team;
  const players = team.flatMap((p): PlayerRow[] => {
    const st = stats.get(p.id);
    if (!st) return [];
    const jack = p.id === JACK;
    return [
      {
        id: p.id,
        name: p.name,
        kind: KIND[p.kind],
        line: line(st, jack),
        details: details(st, jack),
      },
    ];
  });
  const plays = playsStats(record);
  return {
    heading: `Run · ${day(record.startedAt)}`,
    players,
    team: teamSections(s, record.end, record.reached),
    plays: [...plays.byPlay]
      .sort(([, a], [, b]) => b.calls - a.calls)
      .map(([id, p]): PlayRow => {
        const used = plays.mostUsed === id;
        const successful = plays.mostSuccessful === id;
        return {
          id,
          name: record.plays[id]?.name ?? id,
          line: `${count(p.calls, 'call')} · ${yardsPerCall(p).toFixed(1)} yds a call`,
          mark:
            used && successful
              ? 'both'
              : used
                ? 'most used'
                : successful
                  ? 'most successful'
                  : null,
          play: record.plays[id] ?? null,
        };
      }),
  };
}

/** A run past the last 20 (k3): only its summary is kept, so only its Team tab. */
export function summaryView(summary: RunSummary): RunView {
  return {
    heading: `Run · ${day(summary.startedAt)}`,
    players: [],
    team: teamSections(summary.stats, summary.end, summary.reached),
    plays: [],
  };
}

function teamSections(
  s: RunStats,
  end: RunRecord['end'],
  reached: RunRecord['reached'],
): Section[] {
  const rate = completionRate(s.passing);
  const perRush = yardsPerRush(s.rushing);
  return [
    {
      title: 'How far',
      rows: [
        row('Reached', end === 'won' ? 'Won' : where(reached)),
        row('Downs', s.downs),
        row('First downs', s.firstDowns),
        row('Touchdowns', s.touchdowns),
        row('Yards', yds(s.yards)),
      ],
    },
    {
      title: 'Passing',
      rows: [
        row('Passes', s.passing.passes),
        row('Completions', s.passing.completions),
        row('Completion rate', rate === null ? '–' : percent(rate)),
        row('Passing yards', yds(s.passing.yards)),
        row('Air yards', yds(s.passing.airYards)),
        row('Longest pass', yds(s.passing.longest)),
      ],
    },
    {
      title: 'Rushing',
      rows: [
        row('Rushes', s.rushing.rushes),
        row('Yards', yds(s.rushing.yards)),
        row('Yards a rush', perRush === null ? '–' : perRush.toFixed(1)),
        row('Longest rush', yds(s.rushing.longest)),
        row('Rushes · passes', `${s.rushing.rushes} · ${s.passing.passes}`),
      ],
    },
    {
      title: 'Contact',
      rows: [
        row('Tackles broken', s.contact.tacklesBroken),
        row('Yards after contact', yds(s.contact.afterContact)),
      ],
    },
    {
      title: 'Against you',
      rows: [
        row('Sacks', s.against.sacks),
        row('Tackles for loss', s.against.tacklesForLoss),
        row('Incomplete', s.against.incompletes),
        row('Batted down', s.against.batted),
      ],
    },
    { title: 'Blocking', rows: [row('Pancakes', s.pancakes)] },
    {
      title: 'Tap tests',
      rows: (Object.keys(TEST) as TapTestKind[]).map((k) => row(TEST[k], grades(s.tapTests[k]))),
    },
    {
      title: 'The rest',
      rows: [
        row('Pickups taken', s.rest.pickups),
        row('Field events', s.rest.fieldEvents),
        row('Crows shooed', s.rest.crowsShooed),
      ],
    },
  ];
}

/** The stats section's Runs (v5): one mode's, newest first. */
export function runsView(saved: Saved, mode: Mode): readonly RunsRow[] {
  return saved.runs
    .filter((r) => modeOf(r.summary.modes) === mode)
    .map(({ summary }) => {
      const s = summary.stats;
      const at = summary.end === 'won' ? 'Won' : where(summary.reached);
      return {
        id: summary.id,
        date: day(summary.startedAt),
        where: summary.end === 'unfinished' ? `${at} · unfinished` : at,
        line: `${yds(s.yards)} yds · ${count(s.firstDowns, 'first down')}`,
      };
    });
}

/** The stats section's All time (v5): one mode's runs, records with their dates, best runs by a player, totals. */
export function allTimeView(all: AllTime): AllTimeView {
  const dated = (label: string, b: Best | null, show: (v: number) => string = yds): Row[] =>
    b ? [row(label, `${show(b.value)} · ${day(b.at)}`)] : [];
  const r = all.records;
  const named = (label: string, b: (Best & { name: string }) | null): Row[] =>
    b ? [row(label, `${b.name} ${yds(b.value)} · ${day(b.at)}`)] : [];
  const t = all.totals;
  return {
    empty: all.runs === 0,
    sections: [
      {
        title: 'Runs',
        rows: [
          row('Played', all.runs),
          row('Won', all.won),
          row('Furthest', all.won > 0 ? 'Won' : all.furthest ? where(all.furthest) : '–'),
        ],
      },
      {
        title: 'Records',
        rows: [
          ...dated('Longest pass', r.longestPass),
          ...dated('Longest rush', r.longestRush),
          ...dated('Most yards in a run', r.mostYards),
          ...dated('Most first downs in a run', r.mostFirstDowns),
          ...dated('Most tackles broken in a run', r.mostTacklesBroken),
          ...dated('Best completion rate', r.bestCompletion, percent),
        ],
      },
      {
        title: 'Best runs by a player',
        rows: [
          ...named('Receiving yards', r.bestReceiving),
          ...named('Rushing yards', r.bestRushing),
          ...named('Pancakes', r.bestPancakes),
        ],
      },
      {
        title: 'Totals',
        rows: [
          row('Downs', t.downs),
          row('Yards', yds(t.yards)),
          row('First downs', t.firstDowns),
          row('Touchdowns', t.touchdowns),
          row(
            'Passing',
            `${t.passing.completions}/${t.passing.passes} · ${yds(t.passing.yards)} yds`,
          ),
          row('Rushing', `${t.rushing.rushes} · ${yds(t.rushing.yards)} yds`),
          row('Tackles broken', t.contact.tacklesBroken),
          row('Sacks', t.against.sacks),
          row('Pancakes', t.pancakes),
        ],
      },
    ],
  };
}
