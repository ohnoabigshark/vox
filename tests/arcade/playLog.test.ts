import { describe, expect, it } from 'vitest';
import { eventLines, flagLine, type LogMeta } from '../../src/arcade/log/playLog';
import { createRun } from '../../src/arcade/sim/run';
import type { ArcadeEvent, RunState } from '../../src/arcade/sim/types';
import { v } from '../../src/arcade/sim/vec';
import { carry, playState } from './helpers';

/** docs/PLAY_LOG.md: the lines, one per event, with the down they happened in. */

const meta: LogMeta = { session: 's1', build: 'abc1234', flags: 'aim=2&snag=1' };
const NOW = Date.UTC(2026, 10, 1, 16, 21, 7, 512);

/** A Catcher (id 2) carrying at (3.14159, 11.4567), on the 4 with the line at 10. */
function carrying(): RunState {
  const s = carry(playState([{ pos: v(3.14159, 11.4567) }]), 2);
  s.drive = { ...s.drive, los: 4, firstDown: 10, down: 2 };
  return s;
}

describe('the play log: its lines (l2)', () => {
  it('one line per event, in order, each with when, which session, run and build', () => {
    const s = carrying();
    const events: ArcadeEvent[] = [
      { type: 'caught', id: 2, contested: false },
      { type: 'tackled', id: 2, by: 100 },
    ];
    const lines = eventLines(s, s, events, meta, NOW);
    expect(lines.map((l) => l.event?.type)).toEqual(['caught', 'tackled']);
    expect(lines[0]).toMatchObject({
      at: '2026-11-01T16:21:07.512Z',
      kind: 'event',
      session: 's1',
      seed: s.seed,
      build: 'abc1234',
      flags: 'aim=2&snag=1',
      practice: false,
    });
  });

  it('the down comes from the state the step started in; the carrier from the state after', () => {
    const before = carrying();
    const after = structuredClone(before);
    after.drive = { ...after.drive, los: 11.4567, down: 3 };
    const [line] = eventLines(before, after, [{ type: 'tackled', id: 2, by: 100 }], meta, NOW);
    expect(line?.drive).toEqual({
      area: before.drive.area,
      index: before.drive.index,
      kind: before.drive.kind,
    });
    expect(line?.down).toBe(2);
    expect(line?.los).toBe(4);
    expect(line?.firstDown).toBe(10);
    expect(line?.carrier).toEqual({ id: 2, x: 3.14, y: 11.46 });
    expect(line?.ball).toBe('carried');
  });

  it("a down's end also says where the line moved to and the down that's next", () => {
    const before = carrying();
    const after = structuredClone(before);
    after.drive = { ...after.drive, los: 11.4567, down: 3 };
    const ended: ArcadeEvent = { type: 'downEnded', result: 'firstDown', gained: 7.4567 };
    const [line] = eventLines(before, after, [ended], meta, NOW);
    expect(line?.next).toEqual({ los: 11.46, down: 3 });
    expect(line?.event).toEqual({ type: 'downEnded', result: 'firstDown', gained: 7.46 });
    const [other] = eventLines(before, after, [{ type: 'snapped' }], meta, NOW);
    expect(other?.next).toBeUndefined();
  });

  it('names the play called, and positions in events are rounded to hundredths', () => {
    const s = carrying();
    const thrown: ArcadeEvent = { type: 'thrown', target: v(1.23456, 9.87654), landsAt: 2.0001 };
    const [line] = eventLines(s, s, [thrown], meta, NOW);
    expect(line?.play).toBe(s.playbook[s.play.index]?.name ?? null);
    expect(line?.event).toEqual({ type: 'thrown', target: { x: 1.23, y: 9.88 }, landsAt: 2 });
  });

  it('no carrier, no spot: the ball says where it is', () => {
    const s = createRun(1);
    const [line] = eventLines(s, s, [{ type: 'snapped' }], meta, NOW);
    expect(line?.carrier).toBeNull();
    expect(line?.ball).toBe(s.field.ball.at);
  });

  it('practice is marked', () => {
    const s = { ...carrying(), practice: true };
    expect(eventLines(s, s, [{ type: 'snapped' }], meta, NOW)[0]?.practice).toBe(true);
  });
});

describe('the play log: ⚑ (l4)', () => {
  it('a flag line has the same context and no event', () => {
    const s = carrying();
    const line = flagLine(s, meta, NOW);
    expect(line).toMatchObject({ kind: 'flag', at: '2026-11-01T16:21:07.512Z', down: 2, los: 4 });
    expect(line.carrier).toEqual({ id: 2, x: 3.14, y: 11.46 });
    expect(line.event).toBeUndefined();
  });
});
