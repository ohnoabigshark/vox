import { describe, expect, it } from 'vitest';
import { addRun, emptyAllTime, summaryOf } from '../../src/arcade/record/allTime';
import type { Saved } from '../../src/arcade/record/store';
import { JACK, type PlayResult, type RunRecord } from '../../src/arcade/record/types';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import {
  allTimeView,
  cardView,
  runView,
  runsView,
  summaryView,
} from '../../src/arcade/ui/statsView';

/** docs/STATS.md, the screens (v1–v5) and their scenarios (stats map q6): what each shows, from the record. */

const blank: PlayResult = {
  seriesNumber: 1,
  down: 1,
  toGo: 10,
  los: 0,
  play: 'slants',
  flipped: false,
  kind: 'pass',
  outcome: 'incomplete',
  gained: 0,
  passer: JACK,
  target: null,
  catcher: null,
  carrier: null,
  tackledBy: null,
  airYards: null,
  afterCatch: null,
  afterContact: null,
  tackleForLoss: false,
  tacklesBroken: 0,
  drags: 0,
  pancakes: [],
  fieldEvents: [],
  pickups: [],
  crowsShooed: 0,
  tapTests: [],
};
const catchBy = (id: number, gained: number, more: Partial<PlayResult> = {}): PlayResult => ({
  ...blank,
  outcome: 'tackled',
  gained,
  target: id,
  catcher: id,
  carrier: id,
  airYards: gained / 2,
  afterCatch: gained / 2,
  ...more,
});
const rushBy = (id: number, gained: number, more: Partial<PlayResult> = {}): PlayResult => ({
  ...blank,
  play: 'dive',
  kind: 'rush',
  outcome: 'tackled',
  gained,
  passer: null,
  carrier: id,
  ...more,
});

const TEAM: RunRecord['team'] = [
  { id: JACK, name: 'Jack', kind: 'jack', preferred: null, joinedAt: 0 },
  { id: 1, name: 'Gourdon', kind: 'human', preferred: 'catcher', joinedAt: 0 },
  { id: 2, name: 'Mags', kind: 'human', preferred: 'runner', joinedAt: 0 },
  { id: 3, name: 'Slab', kind: 'human', preferred: 'blocker', joinedAt: 0 },
  { id: 8, name: 'Wisp', kind: 'ghost', preferred: 'catcher', joinedAt: 2 },
];

const slants = PLAY_POOL.find((p) => p.id === 'slants')!;
const dive = PLAY_POOL.find((p) => p.id === 'dive')!;

const record = (id: string, downs: PlayResult[], more: Partial<RunRecord> = {}): RunRecord => ({
  format: 1,
  id,
  build: 'b',
  link: '',
  modes: { hard: true, twoTap: true, snag: false, tip: false },
  startedAt: '2026-11-02T20:00:00.000Z',
  endedAt: '2026-11-02T20:06:00.000Z',
  end: 'over',
  reached: { area: 1, index: 2, seriesNumber: 7 },
  team: TEAM,
  plays: { slants, dive },
  downs,
  ...more,
});

const downs = [
  catchBy(1, 12.4, { outcome: 'firstDown' }),
  catchBy(8, 8.6),
  { ...blank, target: 1 },
  rushBy(2, 6.2, { tacklesBroken: 1, pancakes: [3, 3] }),
  rushBy(2, 10, { outcome: 'touchdown' }),
  rushBy(2, 3),
  { ...blank, kind: 'sack' as const, outcome: 'sacked' as const, gained: -2 },
];

describe('the Game Over card (v1)', () => {
  const card = cardView(record('a', downs), null);

  it('how far: the area’s name and the series, and the downs played', () => {
    expect(card.title).toBe('Game Over!');
    expect(card.sub).toBe('Candy Queendom · series 3 · 7 downs');
  });

  it('first downs, touchdowns, passing, rushes and yards; yards whole', () => {
    expect(card.tiles).toEqual([
      { value: '1', label: 'first down', record: false },
      { value: '1', label: 'touchdown', record: false },
      { value: '2/3', label: 'passing', record: false },
      { value: '3 · 19', label: 'rushes · yards', record: false },
    ]);
    expect(card.rows.map((r) => [r.label, r.value])).toEqual([
      ['Yards', '38'],
      ['Longest pass', '12'],
      ['Longest rush', '10'],
      ['Tackles broken', '1'],
    ]);
  });

  it('RECORD on each all-time record this run broke: one there before it, beaten', () => {
    const r = record('a', downs);
    const before = addRun(
      addRun(emptyAllTime(), record('old', [catchBy(1, 30)])),
      record('older', [rushBy(2, 5, { pancakes: [3] })]),
    );
    const c = cardView(r, before.records);
    // Yards 38 beat 30; the longest rush 10 beat 5; Mags' 19 and Slab's 2 pancakes beat 5 and 1.
    // No run had broken a tackle or made a first down before, so those aren't records broken.
    expect(c.rows.filter((x) => x.record).map((x) => x.label)).toEqual([
      'Yards',
      'Longest rush',
      'Best rushing run',
      'Best blocking run',
    ]);
    expect(c.tiles.some((t) => t.record)).toBe(false);
    // A single player's best run: its own row, only when it broke a record.
    expect(c.rows.find((x) => x.label === 'Best rushing run')).toEqual({
      label: 'Best rushing run',
      value: 'Mags 19',
      record: true,
    });
    expect(c.rows.some((x) => x.label === 'Best receiving run')).toBe(false);
  });

  it('a first run breaks no records: there were none', () => {
    const c = cardView(record('a', downs), emptyAllTime().records);
    expect([...c.tiles, ...c.rows].some((x) => x.record)).toBe(false);
  });

  it('hard mode’s second time round says so', () => {
    const c = cardView(record('a', [], { reached: { area: 4, index: 0, seriesNumber: 17 } }), null);
    expect(c.sub).toBe('Candy Queendom · round 2 · series 1 · 0 downs');
  });

  it('a win (v3): its own title, all three areas', () => {
    const c = cardView(
      record('a', downs, {
        end: 'won',
        modes: { hard: false, twoTap: false, snag: false, tip: false },
      }),
      null,
    );
    expect(c.title).toBe('You got Jack back!');
    expect(c.sub).toBe('All 3 areas · 7 downs');
  });
});

describe('a run’s stats (v2)', () => {
  const view = runView(record('a', downs));

  it('headed by its day', () => {
    expect(view.heading).toBe('Run · Nov 2');
  });

  it('Players: Jack first, then each who did anything, a recruit by its own name, by what they did', () => {
    expect(view.players.map((p) => [p.name, p.kind, p.line])).toEqual([
      ['Jack', '', '2/3 · 21 yds · 1 sack'],
      ['Gourdon', 'Human', '1 catch · 12 yds · 6 after'],
      ['Mags', 'Human', '3 rushes · 19 yds · 1 broken'],
      ['Slab', 'Human', '2 pancakes'],
      ['Wisp', 'Ghost', '1 catch · 9 yds · 4 after'],
    ]);
  });

  it('a player’s full stats, for a tap', () => {
    const mags = view.players.find((p) => p.name === 'Mags')!;
    expect(mags.details).toContainEqual({ label: 'Longest rush', value: '10', record: false });
    expect(mags.details).toContainEqual({ label: 'Touchdowns', value: '1', record: false });
  });

  it('Team: the run’s stats in sections; rushing says rushes', () => {
    expect(view.team.map((s) => s.title)).toEqual([
      'How far',
      'Passing',
      'Rushing',
      'Contact',
      'Against you',
      'Blocking',
      'Tap tests',
      'The rest',
    ]);
    const rushing = view.team.find((s) => s.title === 'Rushing')!;
    expect(rushing.rows.map((r) => r.label)).toEqual([
      'Rushes',
      'Yards',
      'Yards a rush',
      'Longest rush',
      'Rushes · passes',
    ]);
  });

  it('Plays: each called, its calls and yards a call, most used and most successful marked, with its drawing', () => {
    const r = record('a', [rushBy(2, 4), rushBy(2, 4), rushBy(2, 4), catchBy(1, 20)]);
    // Most called first.
    expect(runView(r).plays.map((p) => [p.name, p.line, p.mark])).toEqual([
      ['Dive', '3 calls · 4.0 yds a call', 'both'],
      ['Slants', '1 call · 20.0 yds a call', null],
    ]);
    expect(runView(r).plays[0]!.play).toEqual(dive);
  });
});

describe('a run past the last 20 (k3)', () => {
  it('its Team tab only, from its summary, the same as the full run’s', () => {
    const r = record('a', downs);
    const view = summaryView(summaryOf(r));
    expect(view.players).toEqual([]);
    expect(view.plays).toEqual([]);
    expect(view.team).toEqual(runView(r).team);
    expect(view.heading).toBe('Run · Nov 2');
  });
});

describe('the stats section (v5)', () => {
  const NORMAL = { hard: false, twoTap: false, snag: false, tip: false };
  const r1 = { ...record('a', downs), endedAt: '2026-11-01T20:00:00.000Z' };
  // Only normal mode wins.
  const r2 = record('b', [catchBy(1, 30)], { end: 'won', modes: NORMAL });
  const r3 = record('c', [], { end: 'unfinished' });
  const saved: Saved = {
    runs: [
      { summary: summaryOf(r3), record: r3 },
      { summary: summaryOf(r2), record: null },
      { summary: summaryOf(r1), record: r1 },
    ],
    allTime: { hard: addRun(addRun(emptyAllTime(), r1), r3), normal: addRun(emptyAllTime(), r2) },
    achievements: {},
    checked: [],
  };

  it('Runs: newest first, one mode at a time', () => {
    expect(runsView(saved, 'hard').map((r) => [r.id, r.date, r.where, r.line])).toEqual([
      ['c', 'Nov 2', 'Candy Queendom · series 3 · unfinished', '0 yds · 0 first downs'],
      ['a', 'Nov 2', 'Candy Queendom · series 3', '38 yds · 1 first down'],
    ]);
    expect(runsView(saved, 'normal').map((r) => [r.id, r.where])).toEqual([['b', 'Won']]);
  });

  it('All time: runs, records with their dates, best single-player runs, totals', () => {
    const all = allTimeView(saved.allTime.hard);
    expect(all.empty).toBe(false);
    expect(all.sections.map((s) => s.title)).toEqual([
      'Runs',
      'Records',
      'Best runs by a player',
      'Totals',
    ]);
    expect(all.sections[0]!.rows.map((r) => [r.label, r.value])).toEqual([
      ['Played', '2'],
      ['Won', '0'],
      ['Furthest', 'Candy Queendom · series 3'],
    ]);
    expect(all.sections[1]!.rows).toContainEqual({
      label: 'Longest pass',
      value: '12 · Nov 1',
      record: false,
    });
  });

  it('a mode with a win: the furthest is the win', () => {
    const runs = allTimeView(saved.allTime.normal).sections[0]!.rows;
    expect(runs.find((r) => r.label === 'Furthest')?.value).toBe('Won');
  });

  it('nothing yet says so', () => {
    expect(allTimeView(emptyAllTime()).empty).toBe(true);
    expect(runsView({ ...saved, runs: [] }, 'hard')).toEqual([]);
  });
});
