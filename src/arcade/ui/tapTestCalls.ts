/**
 * What a quick tap test's result is called, and the sound each of its events
 * makes: shared by the game and the test bench (docs/BENCH.md), so the bench
 * calls a rep exactly as the game calls the test.
 */
import type { SfxId } from '../../audio/sfx';
import type { BreakOutcome } from '../sim/breakit';
import type { ArcadeEvent, Grade } from '../sim/types';

/** A Break it! outcome as a grade: a break is GREAT, a drag OK, a tackle BAD. */
export function breakGrade(outcome: BreakOutcome): Grade {
  return outcome === 'break' ? 'great' : outcome === 'drag' ? 'ok' : 'bad';
}

const WORD: Readonly<Record<Grade, string>> = { great: 'GREAT!', ok: 'OK', bad: 'BAD' };
const TONE: Readonly<Record<Grade, 'good' | 'ok' | 'bad'>> = {
  great: 'good',
  ok: 'ok',
  bad: 'bad',
};

/** The tap tests that freeze the play, each with its countdown and its call. */
export type CountdownTest = 'bar' | 'mash' | 'juke' | 'snag' | 'tip';

/** Each test's call as its countdown ends, and the line its countdown shows. */
const CALLS: Readonly<Record<CountdownTest, { readonly call: string; readonly ready: string }>> = {
  bar: { call: 'BREAK IT!', ready: 'GET READY TO BREAK IT!' },
  mash: { call: 'MASH!', ready: 'GET READY TO MASH!' },
  juke: { call: 'JUKE!', ready: 'GET READY TO JUKE!' },
  snag: { call: 'SNAG IT!', ready: 'GET READY TO SNAG IT!' },
  // The other calls are orders; this one's a noun, so it gets ready FOR it (docs/TIP.md, w1).
  tip: { call: 'TIP DRILL!', ready: 'GET READY FOR THE TIP DRILL!' },
};

/** What a test is called on screen, as its countdown ends. */
export function testCall(test: CountdownTest): string {
  return CALLS[test].call;
}

/** The grade called big in the middle of the screen, and its colour; SHOO CROWS! has its own words. */
export function gradeCall(
  test: CountdownTest | 'shoo',
  grade: Grade,
): { word: string; tone: 'good' | 'ok' | 'bad' } {
  if (test === 'shoo') return { word: grade === 'great' ? 'SHOOED!' : 'CROWS!', tone: TONE[grade] };
  return { word: WORD[grade], tone: TONE[grade] };
}

/** Whether a tap test's event buzzes the phone: a catch test's tap that caught it (a dot hit, a pop not dropped). */
export function tapTestBuzz(e: ArcadeEvent): boolean {
  if (e.type === 'snagDot') return e.hit;
  if (e.type === 'tipPop') return e.result !== 'drop';
  return false;
}

/** The sound a tap test's event makes, or null for any other event. */
export function tapTestSound(e: ArcadeEvent): SfxId | null {
  switch (e.type) {
    case 'snagDot':
      return e.hit ? 'catch' : 'fumble';
    case 'tipPop':
      return e.result === 'drop' ? 'fumble' : 'catch';
    case 'grabbed':
    case 'brokeTackle':
    case 'dragged':
    case 'crowsShooed':
    case 'crowsStruck':
      return 'burst';
    case 'crowsLanded':
      return 'hop';
    default:
      return null;
  }
}

/** A countdown as a box shows it: what's coming, and the whole seconds left ("2…", never "0…"). */
export function countdownText(
  test: CountdownTest,
  secondsLeft: number,
): { title: string; count: string } {
  return { title: CALLS[test].ready, count: `${Math.max(1, Math.ceil(secondsLeft))}…` };
}
