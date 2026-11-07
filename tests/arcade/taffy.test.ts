import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  eventKind,
  FROG_RAIN,
  TAFFY_FLOOD,
  type FieldEvent,
} from '../../src/arcade/content/fieldEvents';
import { arcadeTuning, DT, TIME_SCALE } from '../../src/arcade/content/tuning';
import { inArea, placeArea } from '../../src/arcade/sim/fieldEvents';
import {
  bossStretch,
  createRun,
  genericEventFor,
  setUpDown,
  setUpSeries,
  stretchAt,
  stretchStart,
} from '../../src/arcade/sim/run';
import { giveStatus, hasStatus, statusOf } from '../../src/arcade/sim/status';
import { step } from '../../src/arcade/sim/step';
import type { ArcadeEvent, Body, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { FROM_BOLT } from '../../src/arcade/sim/pickups';
import { body, ofType, playState, run, stand } from './helpers';

/**
 * docs/FIELD_EVENTS.md, round 5, `field-taffy`'s tests: a spell, Slowed in
 * play, generic events picked per stretch, and the taffy flood itself. The
 * editor's (test 4) are in tests/dev/eventEditor.test.ts, saved events'
 * (test 5) in savedEvents.test.ts.
 */

const hw = arcadeTuning.field.halfWidth;
const FROM_TAFFY = { kind: 'fieldEvent', event: 'taffyFlood' } as const;

/** Put this event on the field, placed from the line and already counting: it goes off on the next step. */
function setOff(s: RunState, event: FieldEvent): RunState {
  s.field.fieldEvent = { event, area: placeArea(s, event.area), left: DT };
  return s;
}

/** Step one at a time, calling `look` after each with the events of that step. */
function stepThrough(
  s: RunState,
  seconds: number,
  look: (s: RunState, events: readonly ArcadeEvent[]) => void,
): RunState {
  let state = s;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const r = step(state, {});
    state = r.state;
    look(state, r.events);
  }
  return state;
}

describe('the taffy flood (t1)', () => {
  it('is mischief: a band across the whole field, 6 to 9 yards past the line, a spell of Slowed on everyone', () => {
    const t = TAFFY_FLOOD;
    expect(t.name).toBe('Taffy Flood');
    expect(t.boss).toBeNull();
    expect(t.area).toEqual({ shape: 'band', across: 'middle', width: 2 * hw, from: 6, to: 9 });
    expect(t.goesOffAs).toBe('spell');
    // It goes off 1 s after the snap and lasts 2 s, on screen.
    expect(t.goesOff / TIME_SCALE).toBeCloseTo(1, 9);
    expect(t.lasts / TIME_SCALE).toBeCloseTo(2, 9);
    expect(t.warning.buildUp).toBeGreaterThan(0);
    expect(t.warning.buildUp).toBeLessThanOrEqual(t.goesOff);
    expect(t.effect).toEqual({ kind: 'status', status: 'slowed', on: 'everyone' });
    expect(t.call).toBeNull();
    expect(t.look).toBe('taffyFlood');
    expect(eventKind(t)).toBe('mischief');
  });

  it('Frog Rain is still a burst', () => {
    expect(FROG_RAIN.goesOffAs).toBe('burst');
  });
});

describe('a spell (test 1, and 5b)', () => {
  /** A Catcher standing in the band (2) and one running up through it (3); the spell lasts 4 s, time to get through (the down ends at about 5). */
  const field = (): RunState =>
    setOff(
      playState([
        { pos: v(0, 7), job: stand(v(0, 7)) },
        { pos: v(4, 4), job: { kind: 'route', to: [v(4, 16)], index: 0 } },
      ]),
      { ...TAFFY_FLOOD, lasts: 4 },
    );

  it('holds whoever is in it while it lasts and lets go as they leave; nobody before it goes off or after it ends', () => {
    const s = field();
    const area = s.field.fieldEvent!.area;
    expect(hasStatus(body(s, 2), 'slowed')).toBe(false);
    let wasIn = false;
    let leftIt = false;
    const end = stepThrough(s, 4 + 0.4, (state) => {
      const on = state.field.fieldEvent;
      const spellOn = on !== null && on.left !== null && on.left <= 0 && on.left > -4;
      const runner = body(state, 3);
      if (spellOn) {
        // Held exactly while it's in the area: given as it steps in, gone as it steps out.
        expect(hasStatus(runner, 'slowed')).toBe(inArea(area, runner));
        expect(hasStatus(body(state, 2), 'slowed')).toBe(true);
        if (inArea(area, runner)) wasIn = true;
        else if (wasIn) leftIt = true;
      }
    });
    expect(wasIn && leftIt).toBe(true);
    // After it ends, nobody is held.
    expect(hasStatus(body(end, 2), 'slowed')).toBe(false);
    expect(hasStatus(body(end, 3), 'slowed')).toBe(false);
  });

  it('a status it gives names the taffy; a body stepping out while it’s on gets statusEnded, naming it too (5b)', () => {
    const events: ArcadeEvent[] = [];
    let endedWhileOn = false;
    stepThrough(field(), 4 + 0.4, (state, es) => {
      events.push(...es);
      const on = state.field.fieldEvent;
      const spellOn = on !== null && on.left !== null && on.left > -4;
      if (spellOn && ofType([...es], 'statusEnded').some((e) => e.id === 3)) endedWhileOn = true;
    });
    const gained = ofType(events, 'statusGained');
    expect(gained.map((e) => e.id)).toEqual([2, 3]);
    for (const e of gained) {
      expect(e).toEqual({
        type: 'statusGained',
        id: e.id,
        status: 'slowed',
        from: FROM_TAFFY,
        changed: true,
      });
    }
    expect(endedWhileOn).toBe(true);
    // Both ends are reported: the runner's as it steps out, the stander's as the spell ends.
    expect(ofType(events, 'statusEnded')).toEqual([
      { type: 'statusEnded', id: 3, status: 'slowed', from: FROM_TAFFY },
      { type: 'statusEnded', id: 2, status: 'slowed', from: FROM_TAFFY },
    ]);
  });

  it('before it goes off nobody is held, and nothing is reported', () => {
    const s = field();
    s.field.fieldEvent!.left = 1;
    const r = run(s, 0.5);
    expect(hasStatus(body(r.state, 2), 'slowed')).toBe(false);
    expect(ofType(r.events, 'statusGained')).toEqual([]);
  });

  it('a spell tackles nobody: a carrier in it is slowed, not stopped', () => {
    const s = setOff(
      playState([{ role: 'runner', pos: v(0, 7), job: stand(v(0, 7)) }]),
      TAFFY_FLOOD,
    );
    s.field.ball = { at: 'carried', by: 2 };
    const r = run(s, 0.2);
    expect(ofType(r.events, 'eventTackled')).toEqual([]);
    expect(r.state.phase).toBe('play');
    expect(hasStatus(body(r.state, 2), 'slowed')).toBe(true);
  });

  it('as it goes off, it reports who it caught then', () => {
    const r = run(field(), 0.1);
    expect(ofType(r.events, 'fieldEventWentOff')).toEqual([
      { type: 'fieldEventWentOff', event: 'taffyFlood', look: 'taffyFlood', hit: [2] },
    ]);
  });

  it('a burst that gives a status gives it for the event’s `lasts`, to whoever is in it as it goes off', () => {
    const burst: FieldEvent = { ...TAFFY_FLOOD, goesOffAs: 'burst', lasts: 1 };
    const r = run(setOff(field(), burst), 0.1);
    const held = statusOf(body(r.state, 2), 'slowed');
    expect(held?.from).toEqual(FROM_TAFFY);
    expect(held?.left).toBeCloseTo(1 - 0.1 + DT, 6);
    expect(hasStatus(body(r.state, 3), 'slowed')).toBe(false);
  });
});

describe('Slowed in play (test 2)', () => {
  /** Speed after a second of running up the field, with the taffy over the whole of it or not. */
  function speeds(taffy: boolean, fast = false): { yours: number; theirs: number } {
    const s = playState(
      [{ pos: v(4, 0), job: { kind: 'route', to: [v(4, 40)], index: 0 } }],
      [{ kind: 'rusher', pos: v(-2, 12) }],
    );
    if (taffy) {
      setOff(s, {
        ...TAFFY_FLOOD,
        area: { shape: 'band', across: 'middle', width: 2 * hw, from: -10, to: 40 },
        lasts: 5,
      });
    }
    if (fast) {
      giveStatus(body(s, 2), 'fast', 5, FROM_BOLT, []);
      giveStatus(body(s, 100), 'fast', 5, FROM_BOLT, []);
    }
    const { state } = run(s, 1);
    const speed = (b: Body): number => Math.hypot(b.vel.x, b.vel.y);
    return { yours: speed(body(state, 2)), theirs: speed(body(state, 100)) };
  }

  it('everyone in the taffy moves at the share set, half: yours and theirs', () => {
    const plain = speeds(false);
    const slowed = speeds(true);
    const { share } = arcadeTuning.statuses.slowed;
    expect(share).toBe(0.5);
    expect(slowed.yours / plain.yours).toBeCloseTo(share, 1);
    expect(slowed.theirs / plain.theirs).toBeCloseTo(share, 1);
  });

  it('with a bolt’s Fast, the two multiply: 1.5 × 0.5', () => {
    const plain = speeds(false);
    const both = speeds(true, true);
    expect(both.yours / plain.yours).toBeCloseTo(0.75, 1);
    expect(both.theirs / plain.theirs).toBeCloseTo(0.75, 1);
  });

  it('the carrier doesn’t steer round it: a band across the whole field has no way round', () => {
    // A regression test, passing as written: the band counts against every lane alike, so none is chosen over another.
    const lane = (event: FieldEvent): number => {
      const s = setOff(playState([{ role: 'runner', pos: v(0, 2), job: stand(v(0, 2)) }]), event);
      s.field.fieldEvent!.left = 1;
      s.field.ball = { at: 'carried', by: 2 };
      s.field.lane = 0;
      return run(s, 0.3).state.field.lane;
    };
    const away: FieldEvent = {
      ...TAFFY_FLOOD,
      area: { shape: 'band', across: 'middle', width: 2 * hw, from: 60, to: 61 },
    };
    expect(lane(TAFFY_FLOOD)).toBe(lane(away));
  });
});

describe('generic events in a run (test 3)', () => {
  const ordinary = (n: number): boolean => n >= 2 && stretchAt(n).stretch !== 3;
  const MAX = arcadeTuning.run.areas * 4;

  it('from stretch 2, about one ordinary stretch in three gets one; never stretch 1, never a Boss’s', () => {
    let picked = 0;
    let ordinaries = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (let n = 1; n <= MAX; n++) {
        const e = genericEventFor(seed, n);
        if (!ordinary(n)) {
          expect(e).toBeNull();
          continue;
        }
        ordinaries++;
        if (e) {
          picked++;
          expect(e.id).toBe('taffyFlood');
        }
      }
    }
    expect(picked / ordinaries).toBeGreaterThan(0.28);
    expect(picked / ordinaries).toBeLessThan(0.39);
  });

  it('the same seed, the same stretches; another seed, others', () => {
    const picks = (seed: number): number[] =>
      Array.from({ length: MAX }, (_, i) => i + 1).filter((n) => genericEventFor(seed, n));
    expect(picks(7)).toEqual(picks(7));
    const all = new Set(Array.from({ length: 20 }, (_, i) => picks(i + 1).join()));
    expect(all.size).toBeGreaterThan(10);
  });

  it('every down whose line is in a picked stretch has it, placed from that down’s line; one in a stretch without has none', () => {
    const seed = Array.from({ length: 100 }, (_, i) => i + 1).find(
      (s) => genericEventFor(s, 2) !== null && genericEventFor(s, 1) === null,
    )!;
    const s = createRun(seed);
    // Stretch 1's line: nothing.
    expect(s.field.fieldEvent).toBeNull();
    // A series that started in stretch 1 crosses into stretch 2: that down has the taffy.
    s.series = { ...s.series, los: stretchStart(1) + 2 };
    setUpDown(s, []);
    expect(s.field.fieldEvent?.event.id).toBe('taffyFlood');
    expect(s.field.fieldEvent?.area).toMatchObject({ y0: s.series.los + 6, y1: s.series.los + 9 });
    // And a series starting in stretch 2 has it from its first down.
    setUpSeries(s, 0, stretchStart(1), [], true);
    expect(s.field.fieldEvent?.event.id).toBe('taffyFlood');
  });

  it('Frog Rain is still only Mister Frog’s; the other Bosses’ stretches have none', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let n = 1; n <= MAX; n++) {
        const s = createRun(seed);
        const at = stretchAt(n);
        setUpSeries(s, at.area, stretchStart(at.stretch), [], true);
        const id = s.field.fieldEvent?.event.id ?? null;
        if (n === bossStretch('misterFrog')) expect(id).toBe('frogRain');
        else if (!ordinary(n)) expect(id).toBeNull();
        else expect(id).toBe(genericEventFor(seed, n)?.id ?? null);
      }
    }
  });

  it('the play editor’s practice has none', () => {
    const s = createRun(3, undefined, 0, { practice: createRun(3).playbook[0]! });
    for (let n = 1; n <= 8; n++) {
      const at = stretchAt(n);
      setUpSeries(s, at.area, stretchStart(at.stretch), [], true);
      if (n !== bossStretch('misterFrog')) expect(s.field.fieldEvent).toBeNull();
    }
  });

  it('the pick has a stream of its own: the cards dealt and the pickups are as on main', () => {
    // Taken on main (7da62b4), before generic events: a regression test.
    const hash = createHash('sha256');
    for (let seed = 1; seed <= 20; seed++) {
      for (let n = 1; n <= MAX; n++) {
        const s = createRun(seed);
        const at = stretchAt(n);
        s.seriesWon = n - 1;
        setUpSeries(s, at.area, stretchStart(at.stretch), [], true);
        hash.update(JSON.stringify({ hand: s.hand, banned: s.banned, pickups: s.field.pickups }));
      }
    }
    expect(hash.digest('hex').slice(0, 16)).toBe('6d6cc1764b66780e');
  });
});
