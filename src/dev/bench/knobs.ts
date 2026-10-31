/**
 * The test bench's sliders (docs/BENCH.md, k1 and k5): one per value in
 * tuning.ts that a tap test uses. A knob's key is that value's path, with
 * `{area}` for the values set by area (the slider edits the picked drive's).
 * The bench sets the live tuning object, which the sim reads as it goes, so
 * the next rep plays at the new value; `applySettings({})` puts every value
 * back as shipped.
 */
import { arcadeTuning, TIME_SCALE } from '../../arcade/content/tuning';
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
}

/** Settings: tuning.ts values by path, for those moved off shipped. */
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

export const KNOBS: readonly Knob[] = [
  k('breakit.ready', 'Get ready countdown', 'seconds', BREAKS),
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
  snag('fromDrive', 'From drive', 'count'),
  snag('call', '"SNAG IT!" call', 'seconds'),
  snag('close', 'Ring closes in', 'seconds'),
  snag('gapShare', 'Next dot after (share of the close)', 'share'),
  snag('fasterAfter', 'Faster after drive', 'count'),
  snag('perDrive', 'Faster each drive by', 'seconds'),
  snag('closeFloor', 'Ring close no faster than', 'seconds'),
  snag('window', 'Hit window ±', 'seconds'),
  snag('minDots', 'Fewest dots', 'count'),
  snag('maxDots', 'Most dots', 'count'),
  snag('perZone', 'One more dot every … drives', 'count'),
  snag('handsGap', 'Hands gap for a dot more or less', 'count'),
  snag('margin', 'Dots in from the edge', 'share'),
  snag('minApart', 'Dots at least apart', 'share'),
  snag('maxApart', 'Dots at most apart', 'share'),
  snag('dotSize', 'Dot size', 'px'),
  snag('ringFrom', 'Ring starts at (times the dot)', 'number'),
  snag('box', 'Box at most', 'px'),
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

/** Every value the bench can edit. */
export function allPaths(): string[] {
  return KNOBS.flatMap(pathsOf);
}

type Tree = Record<string, unknown>;

/** Where a path's value sits: its parent object and its last key. */
function locate(root: unknown, path: string): { parent: Tree; key: string } {
  const keys = path.split('.');
  const key = keys.pop() ?? '';
  let parent = root;
  for (const part of keys) parent = (parent as Tree)[part];
  if (typeof parent !== 'object' || parent === null || typeof (parent as Tree)[key] !== 'number') {
    throw new Error(`tuning.ts has no number at ${path}`);
  }
  return { parent: parent as Tree, key };
}

/** The value in the live tuning object. */
export function tuningValue(path: string): number {
  const { parent, key } = locate(arcadeTuning, path);
  return parent[key] as number;
}

const SHIPPED = new Map(allPaths().map((p) => [p, tuningValue(p)]));

/** The value as tuning.ts ships it. */
export function shippedValue(path: string): number {
  const v = SHIPPED.get(path);
  if (v === undefined) throw new Error(`no knob edits ${path}`);
  return v;
}

/** Set every value the bench edits: from `settings`, or as shipped. */
export function applySettings(settings: Settings): void {
  for (const [path, shipped] of SHIPPED) {
    const { parent, key } = locate(arcadeTuning, path);
    parent[key] = settings[path] ?? shipped;
  }
}

/** A knob's reach, in tuning.ts numbers (k5): half the shipped value to double it. */
export function reachOf(knob: Knob, path: string): { min: number; max: number; step: number } {
  const v = shippedValue(path);
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

/**
 * Copy settings (k3): the open tab's values as tuning.ts lines, each changed
 * one marked with what ships, for when the log isn't recording.
 */
export function copyText(test: BenchTest, drive: number, settings: Settings): string {
  const lines = knobsFor(test).map((knob) => {
    const path = pathOf(knob, drive);
    const v = settings[path] ?? shippedValue(path);
    const changed = v !== shippedValue(path) ? `  // was ${shippedValue(path)}` : '';
    return `${path}: ${round(v)},${changed}`;
  });
  return [`// Test bench: ${test}, drive ${drive} (src/arcade/content/tuning.ts)`, ...lines].join(
    '\n',
  );
}

/** A tuning.ts number written plainly: no float noise. */
export function round(v: number): number {
  return +v.toFixed(4);
}

/** The knob that edits a path, or null if none does (a slider that's gone). */
export function knobOf(path: string): Knob | null {
  return KNOBS.find((x) => pathsOf(x).includes(path)) ?? null;
}

/** The settings with `path` at `v`: kept only while it's off shipped. */
export function withValue(settings: Settings, path: string, v: number): Settings {
  const rest = withoutPaths(settings, [path]);
  return round(v) === round(shippedValue(path)) ? rest : { ...rest, [path]: round(v) };
}

/** The settings with these paths back as shipped. */
export function withoutPaths(settings: Settings, paths: readonly string[]): Settings {
  return Object.fromEntries(Object.entries(settings).filter(([p]) => !paths.includes(p)));
}
