/** Records for the record's tests: a down's result by hand, and a run around them. */
import {
  JACK,
  type PlayResult,
  type RecordPlayer,
  type RunRecord,
} from '../../../src/arcade/record/types';

export const blankDown: PlayResult = {
  seriesNumber: 1,
  down: 1,
  toGo: 10,
  los: 0,
  play: 'slants',
  flipped: false,
  hotRoutes: [],
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

/** A completed pass to `id`, `air` of its yards in the air. */
export const catchBy = (
  id: number,
  gained: number,
  air = gained,
  more: Partial<PlayResult> = {},
): PlayResult => ({
  ...blankDown,
  outcome: 'tackled',
  gained,
  target: id,
  catcher: id,
  carrier: id,
  airYards: air,
  afterCatch: gained - air,
  ...more,
});

export const rushBy = (id: number, gained: number, more: Partial<PlayResult> = {}): PlayResult => ({
  ...blankDown,
  play: 'dive',
  kind: 'rush',
  outcome: 'tackled',
  gained,
  passer: null,
  carrier: id,
  ...more,
});

export const STARTERS: readonly RecordPlayer[] = [
  { id: JACK, name: 'Jack', kind: 'jack', preferred: null, joinedAt: 0 },
  ...[1, 2, 3, 4, 5, 6, 7].map((id) => ({
    id,
    name: `Player ${id}`,
    kind: 'human' as const,
    preferred: 'catcher' as const,
    joinedAt: 0,
  })),
];

export const HARD = { hard: true, twoTap: true, snag: false, tip: false };
export const NORMAL = { hard: false, twoTap: false, snag: false, tip: false };

export const runOf = (downs: PlayResult[], more: Partial<RunRecord> = {}): RunRecord => ({
  format: 1,
  id: 'run',
  build: 'b',
  link: '',
  setup: '',
  modes: HARD,
  startedAt: '2026-11-03T12:00:00.000Z',
  endedAt: '2026-11-03T12:10:00.000Z',
  end: 'over',
  reached: { area: 0, index: 0, seriesNumber: 1 },
  team: [...STARTERS],
  plays: {},
  downs,
  ...more,
});
