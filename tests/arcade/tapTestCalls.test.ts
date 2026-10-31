import { describe, expect, it } from 'vitest';
import {
  breakGrade,
  countdownText,
  gradeCall,
  tapTestBuzz,
  tapTestSound,
  testCall,
} from '../../src/arcade/ui/tapTestCalls';

/** Review b8: what the game and the test bench both call a tap test's result, and its sounds. */

describe("a tap test's calls", () => {
  it('a Break it! outcome is a grade: a break GREAT, a drag OK, a tackle BAD', () => {
    expect(breakGrade('break')).toBe('great');
    expect(breakGrade('drag')).toBe('ok');
    expect(breakGrade('tackle')).toBe('bad');
  });

  it('the big word and its colour for each grade; SHOO CROWS! has its own words', () => {
    expect(gradeCall('bar', 'great')).toEqual({ word: 'GREAT!', tone: 'good' });
    expect(gradeCall('snag', 'ok')).toEqual({ word: 'OK', tone: 'ok' });
    expect(gradeCall('juke', 'bad')).toEqual({ word: 'BAD', tone: 'bad' });
    expect(gradeCall('tip', 'great')).toEqual({ word: 'GREAT!', tone: 'good' });
    expect(gradeCall('shoo', 'great')).toEqual({ word: 'SHOOED!', tone: 'good' });
    expect(gradeCall('shoo', 'bad')).toEqual({ word: 'CROWS!', tone: 'bad' });
  });

  it('the sound each tap test event makes, and none for the rest', () => {
    expect(tapTestSound({ type: 'snagDot', index: 0, hit: true })).toBe('catch');
    expect(tapTestSound({ type: 'snagDot', index: 0, hit: false })).toBe('fumble');
    expect(tapTestSound({ type: 'brokeTackle', id: 1, defender: 100 })).toBe('burst');
    expect(tapTestSound({ type: 'dragged', id: 1, yards: 2 })).toBe('burst');
    expect(tapTestSound({ type: 'crowsShooed' })).toBe('burst');
    expect(tapTestSound({ type: 'crowsStruck', on: 1 })).toBe('burst');
    expect(tapTestSound({ type: 'crowsLanded', on: 1 })).toBe('hop');
    expect(tapTestSound({ type: 'grabbed', id: 1, by: [100] })).toBe('burst');
    expect(tapTestSound({ type: 'snagResult', grade: 'great' })).toBeNull();
    // The tip drill (docs/TIP.md, t5): the catch sound for a clean tap or a bobble, the fumble for a drop.
    expect(tapTestSound({ type: 'tipPop', index: 0, result: 'clean' })).toBe('catch');
    expect(tapTestSound({ type: 'tipPop', index: 0, result: 'bobble' })).toBe('catch');
    expect(tapTestSound({ type: 'tipPop', index: 0, result: 'drop' })).toBe('fumble');
    expect(tapTestSound({ type: 'tipResult', grade: 'bad' })).toBeNull();
  });
});

describe('a catch, buzzed, as the game and the bench both do (tip-drill review)', () => {
  it('a SNAG IT! dot hit and a tip drill pop not dropped buzz; a miss, a drop and the rest don’t', () => {
    expect(tapTestBuzz({ type: 'snagDot', index: 0, hit: true })).toBe(true);
    expect(tapTestBuzz({ type: 'snagDot', index: 0, hit: false })).toBe(false);
    expect(tapTestBuzz({ type: 'tipPop', index: 0, result: 'clean' })).toBe(true);
    expect(tapTestBuzz({ type: 'tipPop', index: 0, result: 'bobble' })).toBe(true);
    expect(tapTestBuzz({ type: 'tipPop', index: 0, result: 'drop' })).toBe(false);
    expect(tapTestBuzz({ type: 'snagResult', grade: 'great' })).toBe(false);
  });
});

describe('the countdown, as both boxes show it (review c2)', () => {
  it("what's coming, and the whole seconds left: never 0 while it runs", () => {
    expect(countdownText('snag', 2)).toEqual({ title: 'GET READY TO SNAG IT!', count: '2…' });
    expect(countdownText('snag', 1.2)).toEqual({ title: 'GET READY TO SNAG IT!', count: '2…' });
    expect(countdownText('mash', 0.3)).toEqual({ title: 'GET READY TO MASH!', count: '1…' });
    expect(countdownText('mash', 0)).toEqual({ title: 'GET READY TO MASH!', count: '1…' });
  });

  it('each test’s call; the tip drill, a noun, gets ready FOR its call (docs/TIP.md, w1)', () => {
    expect(['bar', 'mash', 'juke', 'snag', 'tip'].map((t) => testCall(t as never))).toEqual([
      'BREAK IT!',
      'MASH!',
      'JUKE!',
      'SNAG IT!',
      'TIP DRILL!',
    ]);
    expect(countdownText('tip', 2)).toEqual({ title: 'GET READY FOR THE TIP DRILL!', count: '2…' });
    expect(countdownText('bar', 1)).toEqual({ title: 'GET READY TO BREAK IT!', count: '1…' });
  });
});
