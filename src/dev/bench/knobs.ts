/**
 * The test bench's sliders (docs/BENCH.md, k1 and k5): one per value in
 * tuning.ts that a tap test uses. A knob's key is that value's path, with
 * `{area}` for the values set by area (the slider edits the picked drive's).
 * The bench sets the live tuning object, which the sim reads as it goes, so
 * the next rep plays at the new value; `applySettings({})` puts every value
 * back to their defaults.
 */
import { numberAt } from '../../arcade/content/savedTuning';
import { arcadeTuning, TIME_SCALE, tuningDefaults } from '../../arcade/content/tuning';
import { DRIVE_KINDS } from '../../arcade/sim/run';

/** The five tap tests, one tab each (b1). */
export type BenchTest = 'bar' | 'mash' | 'juke' | 'snag' | 'shoo';
export const BENCH_TESTS: readonly BenchTest[] = ['bar', 'mash', 'juke', 'snag', 'shoo'];

/**
 * How a value reads: seconds (shown as screen time), a share (0 to 1), a
 * whole count, a plain number, or pixels.
 */
export type KnobUnit = 'seconds' | 'share' | 'count' | 'number' | 'px';

export interface Knob {
  /** Its path in tuning.ts, such as `snag.close` or `breakit.byArea.{area}.sweet`. */
  readonly key: string;
  /** What it is, in game words. */
  readonly label: string;
  readonly unit: KnobUnit;
  readonly tests: readonly BenchTest[];
  /** Behind the tab's More button (r-p2): it shapes a run more than a rep. */
  readonly more?: true;
}

/** Settings: tuning.ts values by path, for those moved off their defaults. */
export type Settings = Readonly<Record<string, number>>;

const BREAKS: readonly BenchTest[] = ['bar', 'mash', 'juke'];
const k = (key: string, label: string, unit: KnobUnit, tests: readonly BenchTest[]): Knob => ({
  key,
  label,
  unit,
  tests,
});
const snag = (key: string, label: string, unit: KnobUnit): Knob =>
  k(`snag.${key}`, label, unit, ['snag']);
const snagMore = (key: string, label: string, unit: KnobUnit): Knob => ({
  ...snag(key, label, unit),
  more: true,
});

export const KNOBS: readonly Knob[] = [
  // The tap tests' countdown, shared by Break it!'s three and SNAG IT! (docs/SNAG.md, cd-c8).
  k('tapTests.ready', 'Get ready countdown', 'seconds', [...BREAKS, 'snag']),
  k('breakit.perExtraTackler', 'Each extra tackler leaves', 'share', BREAKS),
  k('breakit.meterSeconds', 'Marker crosses in', 'seconds', ['bar']),
  k('breakit.earliest', 'Sweet spot no earlier than', 'share', ['bar']),
  k('breakit.byArea.{area}.sweet', 'Sweet spot', 'share', ['bar']),
  k('breakit.near', '"Close" either side', 'share', ['bar']),
  k('breakit.mashSeconds', 'Time to mash', 'seconds', ['mash']),
  k('breakit.byArea.{area}.mashPerTap', 'Fill per tap', 'share', ['mash']),
  k('breakit.mashDrag', 'Fill that drags', 'share', ['mash']),
  k('breakit.byArea.{area}.jukeWindow', 'Juke window', 'seconds', ['juke']),
  k('breakit.jukeBreakShare', 'Share of it that breaks', 'share', ['juke']),
  k('breakit.jukeLinger', 'Red linger', 'seconds', ['juke']),
  // SNAG IT!: the seven that shape a rep, then the eleven behind More
  // (r-p2): where dots may land, and how it changes over a run.
  snag('close', 'Ring closes in', 'seconds'),
  snag('window', 'Hit window ±', 'seconds'),
  snag('gapShare', 'Next dot after (share of the close)', 'share'),
  snag('dotSize', 'Dot size', 'px'),
  snag('ringFrom', 'Ring starts at (times the dot)', 'number'),
  snag('maxApart', 'Dots at most apart', 'share'),
  snagMore('minApart', 'Dots at least apart', 'share'),
  snagMore('margin', 'Dots in from the edge', 'share'),
  snagMore('box', 'Box at most', 'px'),
  snagMore('fromDrive', 'From drive', 'count'),
  snagMore('fasterAfter', 'Faster after drive', 'count'),
  snagMore('perDrive', 'Faster each drive by', 'seconds'),
  snagMore('closeFloor', 'Ring close no faster than', 'seconds'),
  snagMore('minDots', 'Fewest dots', 'count'),
  snagMore('maxDots', 'Most dots', 'count'),
  snagMore('perZone', 'One more dot every … drives', 'count'),
  snagMore('handsGap', 'Hands gap for a dot more or less', 'count'),
  k('crows.window', 'Time to shoo', 'seconds', ['shoo']),
];

export function knobsFor(test: BenchTest): Knob[] {
  return KNOBS.filter((x) => x.tests.includes(test));
}

const AREAS = arcadeTuning.breakit.byArea.length;

/** The area a drive (1-based) is in, as a by-area value counts it: past the Farm, the Farm's. */
function areaOf(drive: number): number {
  return Math.min(AREAS - 1, Math.max(0, Math.floor((drive - 1) / DRIVE_KINDS.length)));
}

/** The value a knob edits at this drive. */
export function pathOf(knob: Knob, drive: number): string {
  return knob.key.replace('{area}', String(areaOf(drive)));
}

/** Every value a knob can edit (one for each area, for a by-area knob). */
export function pathsOf(knob: Knob): string[] {
  if (!knob.key.includes('{area}')) return [knob.key];
  return Array.from({ length: AREAS }, (_, a) => knob.key.replace('{area}', String(a)));
}

/** Every value a tab's sliders edit, every area's for a by-area slider. */
export function tabPaths(test: BenchTest): string[] {
  return knobsFor(test).flatMap(pathsOf);
}

/** The tab's values in `settings` that are off their defaults. */
export function tabOffDefault(settings: Settings, test: BenchTest): Settings {
  return Object.fromEntries(
    tabPaths(test)
      .filter((p) => settings[p] !== undefined && round(settings[p]) !== round(defaultValue(p)))
      .map((p) => [p, round(settings[p] ?? 0)]),
  );
}

/** Every value the bench can edit. */
export function allPaths(): string[] {
  return KNOBS.flatMap(pathsOf);
}

/** Where a path's number sits in a tuning object. */
function locate(root: unknown, path: string): NonNullable<ReturnType<typeof numberAt>> {
  const at = numberAt(root, path);
  if (!at) throw new Error(`tuning.ts has no number at ${path}`);
  return at;
}

/** The value in the live tuning object. */
export function tuningValue(path: string): number {
  const { parent, key } = locate(arcadeTuning, path);
  return parent[key] as number;
}

const DEFAULTS = new Map(
  allPaths().map((p) => {
    const { parent, key } = locate(tuningDefaults, p);
    return [p, parent[key] as number];
  }),
);

/** The value tuning.ts has: its default. */
export function defaultValue(path: string): number {
  const v = DEFAULTS.get(path);
  if (v === undefined) throw new Error(`no knob edits ${path}`);
  return v;
}

/** Set every value the bench edits: from `settings`, or as its default. */
export function applySettings(settings: Settings): void {
  for (const [path, byDefault] of DEFAULTS) {
    const { parent, key } = locate(arcadeTuning, path);
    parent[key] = settings[path] ?? byDefault;
  }
}

/** A knob's reach, in tuning.ts numbers (k5): half the default to double it. */
export function reachOf(knob: Knob, path: string): { min: number; max: number; step: number } {
  const v = defaultValue(path);
  switch (knob.unit) {
    case 'count':
      return { min: Math.max(1, Math.ceil(v / 2)), max: Math.floor(v * 2), step: 1 };
    case 'px':
      return { min: Math.round(v / 2), max: Math.round(v * 2), step: 1 };
    case 'share':
      return { min: v / 2, max: Math.min(1, v * 2), step: 0.005 };
    case 'seconds':
      // A hundredth of a second on screen.
      return { min: v / 2, max: v * 2, step: 0.01 * TIME_SCALE };
    case 'number':
      return { min: v / 2, max: v * 2, step: 0.05 };
  }
}

/** A tuning.ts number as the slider shows it: seconds on screen, everything else as it is. */
export function toScreen(knob: Knob, v: number): number {
  return knob.unit === 'seconds' ? v / TIME_SCALE : v;
}

/** What the slider shows, back to a tuning.ts number. */
export function fromScreen(knob: Knob, shown: number): number {
  return knob.unit === 'seconds' ? shown * TIME_SCALE : shown;
}

/** A knob's value for the slider's label: "0.80 s", "7.5%", "3", "72 px". */
export function showValue(knob: Knob, v: number): string {
  const shown = toScreen(knob, v);
  switch (knob.unit) {
    case 'seconds':
      return `${shown.toFixed(2)} s`;
    case 'share':
      return `${+(shown * 100).toFixed(1)}%`;
    case 'count':
      return String(Math.round(shown));
    case 'px':
      return `${Math.round(shown)} px`;
    case 'number':
      return `×${shown.toFixed(2)}`;
  }
}

/** A tuning.ts number written plainly: no float noise. */
export function round(v: number): number {
  return +v.toFixed(4);
}

/** The knob that edits a path, or null if none does (a slider that's gone). */
export function knobOf(path: string): Knob | null {
  return KNOBS.find((x) => pathsOf(x).includes(path)) ?? null;
}

/** The settings with `path` at `v`: kept only while it's off its default. */
export function withValue(settings: Settings, path: string, v: number): Settings {
  const rest = withoutPaths(settings, [path]);
  return round(v) === round(defaultValue(path)) ? rest : { ...rest, [path]: round(v) };
}

/** The settings with these paths back to their defaults. */
export function withoutPaths(settings: Settings, paths: readonly string[]): Settings {
  return Object.fromEntries(Object.entries(settings).filter(([p]) => !paths.includes(p)));
}
