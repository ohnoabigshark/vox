import { describe, expect, it } from 'vitest';
import {
  breakGrade,
  countdownText,
  gradeCall,
  tapTestSound,
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
  });
});

describe('the countdown, as both boxes show it (review c2)', () => {
  it("what's coming, and the whole seconds left: never 0 while it runs", () => {
    expect(countdownText('SNAG IT!', 2)).toEqual({ title: 'GET READY TO SNAG IT!', count: '2…' });
    expect(countdownText('SNAG IT!', 1.2)).toEqual({ title: 'GET READY TO SNAG IT!', count: '2…' });
    expect(countdownText('MASH!', 0.3)).toEqual({ title: 'GET READY TO MASH!', count: '1…' });
    expect(countdownText('MASH!', 0)).toEqual({ title: 'GET READY TO MASH!', count: '1…' });
  });
});
