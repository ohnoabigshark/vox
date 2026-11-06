/**
 * Statuses in the sim (docs/STATUSES.md): given to a body by a source,
 * worn off one step at a time, and read by the rules through `hasStatus`
 * and `speedShare`, never through what gave them. Each is reported as it's
 * given and as it runs out (s8). A down's new line-up starts everyone with
 * none, so a status still on at the whistle ends there unreported.
 */
import { assertNever } from '../../assertNever';
import type { StatusName } from '../content/statuses';
import { arcadeTuning, DT } from '../content/tuning';
import type { ArcadeEvent, Body, StatusSource } from './types';

/**
 * Give a body a status for `time` seconds. One it already has keeps the
 * longer time left, not the sum (s3), and the source of whichever that is.
 */
export function giveStatus(
  b: Body,
  name: StatusName,
  time: number,
  from: StatusSource,
  events: ArcadeEvent[],
): void {
  const had = b.statuses.find((s) => s.name === name);
  if (!had) b.statuses.push({ name, left: time, from });
  else if (time >= had.left) {
    had.left = time;
    had.from = from;
  }
  events.push({ type: 'statusGained', id: b.id, status: name, from });
}

/** One step of a body's statuses wearing off; one that runs out is gone, and said so. */
export function wearStatuses(b: Body, events: ArcadeEvent[]): void {
  if (b.statuses.length === 0) return;
  for (const s of b.statuses) s.left = Math.max(0, s.left - DT);
  for (const s of b.statuses) {
    if (s.left <= 0) events.push({ type: 'statusEnded', id: b.id, status: s.name });
  }
  b.statuses = b.statuses.filter((s) => s.left > 0);
}

/** Whether a body has a status now. */
export function hasStatus(b: Pick<Body, 'statuses'>, name: StatusName): boolean {
  return b.statuses.some((s) => s.name === name);
}

/** What a body's statuses do to its top speed, as a share of it; they multiply (s3). */
export function speedShare(b: Pick<Body, 'statuses'>): number {
  let share = 1;
  for (const s of b.statuses) share *= speedOf(s.name);
  return share;
}

function speedOf(name: StatusName): number {
  switch (name) {
    case 'fast':
      return 1 + arcadeTuning.statuses.fast.faster;
    default:
      return assertNever(name);
  }
}
