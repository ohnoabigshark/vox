import { describe, expect, it } from 'vitest';
import {
  eventEditorLink,
  eventPracticeQuery,
  readEventPractice,
} from '../../src/arcade/content/eventLink';
import { FROG_RAIN, TAFFY_FLOOD, type FieldEvent } from '../../src/arcade/content/fieldEvents';
import { hasStatus } from '../../src/arcade/sim/status';
import { step } from '../../src/arcade/sim/step';
import { PLAY_POOL } from '../../src/arcade/content/playPool';
import { bossStretch, createRun, dispatch, stretchAt, nextDown } from '../../src/arcade/sim/run';
import type { RunState } from '../../src/arcade/sim/types';

/** docs/FIELD_EVENTS.md, test 8: Try it, event practice (f3, x2). */

const made: FieldEvent = {
  ...FROG_RAIN,
  id: 'graveyardRain',
  name: 'Graveyard rain',
  boss: null,
  area: { shape: 'circle', across: 'right', out: 4, at: 10, radius: 2 },
  look: 'plain',
  call: null,
};

describe('the Try it link (test 8)', () => {
  it('carries the event itself, the stretch and the throwing, and reads back the same', () => {
    const q = eventPracticeQuery(made, 6, true);
    const params = new URLSearchParams(q);
    expect(params.get('stretch')).toBe('6');
    expect(params.get('aim')).toBe('2');
    expect(new URLSearchParams(eventPracticeQuery(made, 6, false)).get('aim')).toBe('1');
    expect(readEventPractice(`?${q}`)).toEqual({ event: { ok: true, event: made }, stretch: 6 });
  });

  it('a link it can’t read says why; with no event it’s an ordinary game', () => {
    expect(readEventPractice('?event=nope&stretch=2')).toEqual({
      event: { ok: false, reason: 'This event link is broken.' },
      stretch: 2,
    });
    const bad = new URLSearchParams({
      event: JSON.stringify({ ...made, lasts: 'x' }),
      stretch: '2',
    });
    expect(readEventPractice(`?${bad}`)?.event).toEqual({
      ok: false,
      reason: 'This event link can’t be played: lasts is not a number.',
    });
    expect(readEventPractice('?try=x')).toBeNull();
  });

  it('a stretch it can’t read, or past the run, is held to stretches 1 to 12', () => {
    const q = (stretch: string): number | undefined =>
      readEventPractice(`?${new URLSearchParams({ event: JSON.stringify(made), stretch })}`)
        ?.stretch;
    expect(q('x')).toBe(1);
    expect(q('0')).toBe(1);
    expect(q('40')).toBe(12);
  });

  it('a link from before the renames says drive or series, and plays that stretch', () => {
    const old = new URLSearchParams({ event: JSON.stringify(made), drive: '7' });
    expect(readEventPractice(`?${old}`)?.stretch).toBe(7);
    const older = new URLSearchParams({ event: JSON.stringify(made), series: '6' });
    expect(readEventPractice(`?${older}`)?.stretch).toBe(6);
  });

  it('‹ Events goes back to the editor with the event open', () => {
    expect(eventEditorLink('https://x.ts.net:8443/vox-dev/?event=…', 'graveyardRain')).toBe(
      'https://x.ts.net:8443/vox-dev/dev/events.html#graveyardRain',
    );
  });
});

describe('event practice (test 8)', () => {
  const practice = (event: FieldEvent, series: number): RunState =>
    createRun(3, undefined, 0, { eventPractice: { event, stretch: series } });

  it('plays the chosen series’ defense, three cards to pick from, nothing called', () => {
    const s = practice(made, 6);
    expect(s.practice).toBe(true);
    expect({ area: s.series.area, stretch: s.series.stretch }).toEqual(stretchAt(6));
    expect(s.seriesWon).toBe(5);
    expect(s.playbook).toBe(PLAY_POOL);
    expect(s.hand).toHaveLength(3);
    expect(s.called).toBeNull();
  });

  it('sets the event off every rep: placed each down, counting from the hike', () => {
    const s = practice(made, 2);
    expect(s.field.fieldEvent?.event).toBe(made);
    // Series 2 starts 10 yards into the area (docs/LONG_FIELD.md), and the circle is 10 past its line.
    expect(s.series.los).toBe(10);
    expect(s.field.fieldEvent?.area).toEqual({ shape: 'circle', x: 4, y: 20, r: 2 });
    const hiked = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' }).state;
    expect(hiked.field.fieldEvent?.left).toBe(made.goesOff);
    // The next rep: the same spot, the event placed again, waiting for the hike.
    nextDown(hiked, []);
    expect(hiked.series.down).toBe(1);
    // Each step works on a copy of the run (cloneRun), so it's the same event, not the same object.
    expect(hiked.field.fieldEvent?.event).toEqual(made);
    expect(hiked.field.fieldEvent?.left).toBeNull();
    expect(hiked.called).toBeNull();
  });

  it('on a Boss’s series the event tried takes the place of the Boss’s own', () => {
    expect(practice(made, 4).field.fieldEvent?.event.id).toBe('graveyardRain');
  });

  it('the play editor’s practice is as it was: its one play, called', () => {
    const s = createRun(3, undefined, 0, { practice: PLAY_POOL[0]! });
    expect(s.called).toBe(0);
    expect(s.field.fieldEvent).toBeNull();
  });
});

describe('a Boss’s series (review r9)', () => {
  it('is worked out from where the Boss is, not written as a number', () => {
    expect(bossStretch('misterFrog')).toBe(4);
    expect(bossStretch('queen')).toBe(8);
    expect(bossStretch('king')).toBe(12);
  });
});

describe('a slow spell in Try it (round 5, test 4)', () => {
  it('reads back from its link and plays: whoever runs into it is Slowed', () => {
    const spell: FieldEvent = {
      ...made,
      goesOffAs: 'spell',
      effect: { kind: 'status', status: 'slowed', on: 'everyone' },
      area: { shape: 'band', across: 'middle', width: 30, from: -12, to: 30 },
      goesOff: 0.2,
      lasts: 2,
    };
    const link = readEventPractice(`?${eventPracticeQuery(spell, 2, true)}`);
    expect(link?.event).toEqual({ ok: true, event: spell });
    let s = createRun(3, undefined, 0, { eventPractice: { event: spell, stretch: 2 } });
    s = dispatch(dispatch(s, { type: 'call', hand: 0 }).state, { type: 'hike' }).state;
    for (let i = 0; i < 30 && s.phase === 'play'; i++) s = step(s, {}).state;
    expect(s.field.defenders.some((d) => hasStatus(d, 'slowed'))).toBe(true);
  });

  it('the taffy flood itself can be tried', () => {
    const q = eventPracticeQuery(TAFFY_FLOOD, 3, true);
    expect(readEventPractice(`?${q}`)?.event).toEqual({ ok: true, event: TAFFY_FLOOD });
  });
});
