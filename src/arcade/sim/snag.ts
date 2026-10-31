/**
 * SNAG IT! (docs/SNAG.md): from drive 5 (or the first, with ?snag=1), a
 * contested ball freezes the play for a test: "SNAG IT!" is called, then
 * dots pop up in a box one after another, each with a ring closing onto it.
 * A tap on a dot as its ring closes hits it; a tap too early, or none, misses
 * it. Every dot hit is a GREAT (caught, the defenders knocked flying), one
 * miss an OK (caught and tackled there), more a BAD (batted down). How many
 * dots comes from the level, the crowd and the Hands gap; how fast, from the
 * level past drive 10 (both shared with the tip drill: sim/catchTests.ts).
 * step.ts carries out the grade.
 */
import { arcadeTuning } from '../content/tuning';
import type { Contest } from './ball';
import { catchCount, contestSituation, freezeContested, paceShare } from './catchTests';
import { rngFor } from './random';
import type { ArcadeEvent, Grade, RunState, SnagDot, StepInput, Vec } from './types';
import { clamp, dist } from './vec';

const sn = arcadeTuning.snag;

/** How fast on this drive: how long a ring takes to close, and the gap between dots (sim seconds). */
export function snagPace(drive: number): { close: number; gap: number } {
  const close = sn.close * paceShare(drive);
  return { close, gap: close * sn.gapShare };
}

/** Where the dots go: each in the box, apart from the two before it, and not too far from the last. */
function placeDots(state: RunState, count: number): Vec[] {
  const rng = rngFor(state.seed, 'snag', state.step);
  const lo = sn.margin;
  const hi = 1 - sn.margin;
  const inBox = (p: Vec): boolean => p.x >= lo && p.x <= hi && p.y >= lo && p.y <= hi;
  const dots: Vec[] = [{ x: lo + rng.next() * (hi - lo), y: lo + rng.next() * (hi - lo) }];
  while (dots.length < count) {
    const last = dots[dots.length - 1] ?? { x: 0.5, y: 0.5 };
    const before = dots[dots.length - 2];
    const fits = (p: Vec): boolean => inBox(p) && (!before || dist(p, before) >= sn.minApart);
    const at = (angle: number, d: number): Vec => ({
      x: last.x + Math.cos(angle) * d,
      y: last.y + Math.sin(angle) * d,
    });
    let next: Vec | undefined;
    for (let i = 0; i < 40 && !next; i++) {
      const d = sn.minApart + rng.next() * (sn.maxApart - sn.minApart);
      const p = at(rng.next() * 2 * Math.PI, d);
      if (fits(p)) next = p;
    }
    // Unlucky draws: the first direction round the compass that fits, at the middle distance.
    for (let k = 0; k < 32 && !next; k++) {
      const p = at((k / 32) * 2 * Math.PI, (sn.minApart + sn.maxApart) / 2);
      if (fits(p)) next = p;
    }
    // Nowhere fits (it can't happen in a box this size): toward the box's middle.
    dots.push(next ?? at(Math.atan2(0.5 - last.y, 0.5 - last.x), sn.minApart));
  }
  return dots;
}

/**
 * Start SNAG IT! on a contested ball: the play freezes with the ball a yard
 * short of the receiver's hands (on its way from `from`), and the dots are
 * laid out and timed.
 */
export function startSnag(
  state: RunState,
  contest: Contest,
  from: Vec,
  events: ArcadeEvent[],
): void {
  const { receiver, defenders } = contest;
  const situation = contestSituation(state, contest);
  const count = catchCount(situation);
  const { close, gap } = snagPace(situation.drive);
  // The tap tests' countdown first (docs/SNAG.md, cd-c7): the first dot comes as it ends.
  const first = state.time + arcadeTuning.countdown.ready;
  const dots: SnagDot[] = placeDots(state, count).map((p, i) => ({
    x: p.x,
    y: p.y,
    appearsAt: first + i * gap,
    closesAt: first + i * gap + close,
    result: null,
  }));
  state.snag = {
    startedAt: state.time,
    receiver: receiver.id,
    defenders: defenders.map((d) => d.id),
    dots,
  };
  freezeContested(state, receiver, from);
  state.phase = 'snag';
  events.push({ type: 'snagStarted', receiver: receiver.id, dots: count });
}

/**
 * Judge this step: a tap on a showing dot hits it if its ring is within the
 * window of closing, and misses it if it's early; a dot nobody tapped by the
 * end of its window is missed. Returns the grade once every dot is played.
 */
export function judgeSnag(state: RunState, input: StepInput, events: ArcadeEvent[]): Grade | null {
  const t = state.snag;
  // The phase and the test are set and cleared together; one without the other is a bug.
  if (!t) throw new Error('SNAG IT! phase with no SNAG IT! running');
  const now = state.time;
  const tapped = input.snag === undefined ? undefined : t.dots[input.snag];
  if (tapped && dotOpen(tapped, now)) {
    const hit = Math.abs(now - tapped.closesAt) <= sn.window;
    tapped.result = hit ? 'hit' : 'miss';
    events.push({ type: 'snagDot', index: t.dots.indexOf(tapped), hit });
  }
  t.dots.forEach((d, index) => {
    if (d.result !== null || now <= d.closesAt + sn.window) return;
    d.result = 'miss';
    events.push({ type: 'snagDot', index, hit: false });
  });
  if (t.dots.some((d) => d.result === null)) return null;
  const misses = t.dots.filter((d) => d.result === 'miss').length;
  return misses === 0 ? 'great' : misses === 1 ? 'ok' : 'bad';
}

/** Sim seconds left in SNAG IT!'s countdown, until the first dot shows; null once it has (or with no SNAG IT!). */
export function snagCountdownLeft(state: RunState): number | null {
  const first = state.snag?.dots[0]?.appearsAt;
  return first === undefined || state.time >= first ? null : first - state.time;
}

/** Whether a dot can be tapped at `time`: it has shown, and isn't graded yet. */
export function dotOpen(dot: SnagDot, time: number): boolean {
  return dot.result === null && time >= dot.appearsAt;
}

/** The dot a tap with no aim (Space) goes to: the open one that shows first, so closes first; or null. */
export function nextDot(state: RunState): number | null {
  const i = state.snag?.dots.findIndex((d) => dotOpen(d, state.time)) ?? -1;
  return i >= 0 ? i : null;
}

/** How far a dot's ring has closed (0 as the dot shows, 1 closed on it), or null before it shows. */
export function ringClosed(state: RunState, dot: SnagDot): number | null {
  if (state.time < dot.appearsAt) return null;
  return clamp((state.time - dot.appearsAt) / (dot.closesAt - dot.appearsAt), 0, 1);
}
