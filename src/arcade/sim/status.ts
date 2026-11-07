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
import type { ArcadeEvent, Body, Status, StatusSource } from './types';

/**
 * Give a body a status for `time` seconds. One it already has keeps the
 * longer time left, not the sum (s3), and the source of whichever that is.
 * Every give is reported, saying whether it changed anything (the review's
 * r2: the user's "report every give").
 */
export function giveStatus(
  b: Body,
  name: StatusName,
  time: number,
  from: StatusSource,
  events: ArcadeEvent[],
): void {
  const had = statusOf(b, name);
  const changed = givingChanges(b, name, time);
  if (!had) b.statuses.push({ name, left: time, from });
  else if (changed) {
    had.left = time;
    had.from = from;
  }
  events.push({ type: 'statusGained', id: b.id, status: name, from, changed });
}

/** Whether giving a body this status for `time` would change anything: it hasn't got it, or has less time left (s3). */
export function givingChanges(b: Pick<Body, 'statuses'>, name: StatusName, time: number): boolean {
  const had = statusOf(b, name);
  return !had || time >= had.left;
}

/** One step of a body's statuses wearing off; one that runs out is gone, and said so. */
export function wearStatuses(b: Body, events: ArcadeEvent[]): void {
  if (b.statuses.length === 0) return;
  for (const s of b.statuses) s.left = Math.max(0, s.left - DT);
  for (const s of b.statuses) {
    if (s.left <= 0) events.push({ type: 'statusEnded', id: b.id, status: s.name, from: s.from });
  }
  b.statuses = b.statuses.filter((s) => s.left > 0);
}

/**
 * End a body's status now, before its time is up, and say so: a spell's, as
 * the body steps out of it or the spell ends. Only the one from `from`: if
 * another source's took its place (s3), that one stays.
 */
export function endStatus(
  b: Body,
  name: StatusName,
  from: StatusSource,
  events: ArcadeEvent[],
): void {
  const s = statusOf(b, name);
  if (!s || !sameSource(s.from, from)) return;
  b.statuses = b.statuses.filter((x) => x !== s);
  events.push({ type: 'statusEnded', id: b.id, status: name, from: s.from });
}

/** Whether two sources are the same one: the one place that's decided. */
export function sameSource(a: StatusSource, b: StatusSource): boolean {
  switch (a.kind) {
    case 'pickup':
      return b.kind === 'pickup' && a.pickup === b.pickup;
    case 'fieldEvent':
      return b.kind === 'fieldEvent' && a.event === b.event;
    default:
      return assertNever(a);
  }
}

/** A body's status of this name, if it has it: the one place two statuses count as the same. */
export function statusOf(b: Pick<Body, 'statuses'>, name: StatusName): Status | undefined {
  return b.statuses.find((s) => s.name === name);
}

/** Whether a body has a status now. */
export function hasStatus(b: Pick<Body, 'statuses'>, name: StatusName): boolean {
  return statusOf(b, name) !== undefined;
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
    case 'slowed':
      return arcadeTuning.statuses.slowed.share;
    case 'ethereal':
      return 1;
    default:
      return assertNever(name);
  }
}
