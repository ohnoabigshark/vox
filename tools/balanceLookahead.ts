/**
 * The passing bot's lookahead (tools/arcade-balance.ts, `BOT.predict`): a
 * practised player who knows where a throw would be caught. It throws in a
 * copy of the run and follows the ball, stepping that one copy in place
 * rather than copying it every step (docs/PLAN.md, "Faster balance runs").
 */
import { cloneRun } from '../src/arcade/sim/run';
import { stepInPlace } from '../src/arcade/sim/step';
import type { RunState } from '../src/arcade/sim/types';

/** How deep it wants a catch: the first-down line early in the pocket, the line of scrimmage as it runs out. */
export function wantedDepth(state: RunState, left: number): number {
  const { los, firstDown } = state.series;
  return los + (firstDown - los) * Math.min(1, left / 0.6);
}

/** Throw now (in a copy) and follow the ball: is it caught, at or past the depth it wants? */
export function predictsCatch(state: RunState, left: number): boolean {
  const s = cloneRun(state);
  for (let i = 0; i < 120; i++) {
    const { events } = stepInPlace(s, i === 0 ? { throw: true } : {});
    for (const e of events) {
      if (e.type === 'caught' || e.type === 'snagStarted' || e.type === 'tipStarted') {
        const id = e.type === 'caught' ? e.id : e.receiver;
        const by = s.field.players.find((p) => p.id === id);
        return (by?.pos.y ?? -Infinity) >= wantedDepth(state, left);
      }
      if (e.type === 'batted' || e.type === 'incomplete' || e.type === 'downEnded') return false;
    }
  }
  return false;
}
