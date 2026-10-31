import { describe, expect, it } from 'vitest';
import {
  httpSaver,
  restoredTab,
  saveLabel,
  savedAfter,
  saveStatus,
  tabsWithUnsaved,
  unsaved,
} from '../../src/dev/bench/save';

/** docs/BENCH.md, the rework's tests D, E, H and I: Save and Restore on the bench. */

describe('Save', () => {
  it("D: Save on a tab writes that tab's values off default and leaves the other tabs' alone", () => {
    const saved = { 'crows.window': 0.7, 'snag.window': 0.15 };
    const current = {
      'crows.window': 0.9, // SHOO: moved, not saved
      'snag.close': 0.56, // SNAG IT!: moved
      'snag.window': 0.15, // SNAG IT!: as saved
    };
    expect(savedAfter(saved, current, 'snag')).toEqual({
      'crows.window': 0.7,
      'snag.close': 0.56,
      'snag.window': 0.15,
    });
  });

  it('D: a value moved back to its default leaves the file, and defaults everywhere leave {}', () => {
    const saved = { 'snag.close': 0.56, 'crows.window': 0.7 };
    expect(savedAfter(saved, { 'crows.window': 0.7 }, 'snag')).toEqual({ 'crows.window': 0.7 });
    // The default itself, written out, counts as the default.
    expect(savedAfter(saved, { 'snag.close': 0.64, 'crows.window': 0.7 }, 'snag')).toEqual({
      'crows.window': 0.7,
    });
    expect(savedAfter(savedAfter(saved, {}, 'snag'), {}, 'shoo')).toEqual({});
  });

  it("D: a by-area slider saves every area's value it has, not just the picked drive's", () => {
    const current = { 'breakit.byArea.0.sweet': 0.1, 'breakit.byArea.2.sweet': 0.05 };
    expect(savedAfter({}, current, 'bar')).toEqual(current);
  });

  it('D: saved entries no slider edits are left as they are', () => {
    expect(savedAfter({ 'drive.pause': 1 }, {}, 'snag')).toEqual({ 'drive.pause': 1 });
  });

  it('E: the countdown saved on Bar shows saved on Mash and Juke, and Restore on Juke resets it everywhere', () => {
    const current = { 'tapTests.ready': 2 };
    expect(unsaved({}, current, 'mash')).toEqual(['tapTests.ready']);
    const saved = savedAfter({}, current, 'bar');
    expect(saved).toEqual({ 'tapTests.ready': 2 });
    for (const t of ['bar', 'mash', 'juke'] as const)
      expect(unsaved(saved, current, t)).toEqual([]);
    const restored = restoredTab(current, 'juke');
    expect(restored).toEqual({});
    for (const t of ['bar', 'mash', 'juke'] as const) {
      expect(unsaved(saved, restored, t)).toEqual(['tapTests.ready']);
    }
  });
});

describe('the shared countdown (docs/SNAG.md, cd-c10 test 4)', () => {
  it('saved on the SNAG IT! tab, it shows saved on the Bar, Mash and Juke tabs too', () => {
    const current = { 'tapTests.ready': 2 };
    const saved = savedAfter({}, current, 'snag');
    expect(saved).toEqual({ 'tapTests.ready': 2 });
    for (const t of ['bar', 'mash', 'juke', 'snag'] as const) {
      expect(unsaved(saved, current, t)).toEqual([]);
    }
  });
});

describe('Restore defaults', () => {
  it("I: sets the open tab's sliders to their defaults, as unsaved changes", () => {
    const saved = { 'snag.close': 0.56, 'crows.window': 0.7 };
    const current = { 'snag.close': 0.56, 'snag.window': 0.2, 'crows.window': 0.7 };
    const restored = restoredTab(current, 'snag');
    expect(restored).toEqual({ 'crows.window': 0.7 });
    expect(unsaved(saved, restored, 'snag')).toEqual(['snag.close']);
    expect(unsaved(saved, restored, 'shoo')).toEqual([]);
  });
});

describe('what the page says', () => {
  it("H: Save counts the tab's unsaved changes, and each tab with any is marked", () => {
    expect(saveLabel(0)).toBe('Saved');
    expect(saveLabel(1)).toBe('Save 1 change');
    expect(saveLabel(3)).toBe('Save 3 changes');
    const saved = { 'snag.close': 0.56 };
    const current = { 'snag.close': 0.56, 'crows.window': 0.7, 'tapTests.ready': 2 };
    // The countdown is SNAG IT!'s too (docs/SNAG.md, cd-c8).
    expect(tabsWithUnsaved(saved, current)).toEqual(['bar', 'mash', 'juke', 'snag', 'shoo']);
    expect(tabsWithUnsaved(saved, saved)).toEqual([]);
  });

  it('H: the status says where saves stand, plainly, and a failure in red', () => {
    expect(saveStatus({ server: 'checking', inServedGame: true, error: null })).toEqual({
      text: 'Checking for the save server…',
      bad: false,
    });
    expect(saveStatus({ server: 'none', inServedGame: true, error: null })).toEqual({
      text: 'Saving needs the hot-reload server (/vox-dev/dev/bench.html)',
      bad: true,
    });
    expect(saveStatus({ server: 'up', inServedGame: true, error: null })).toEqual({
      text: 'Saved settings are in the served game',
      bad: false,
    });
    expect(saveStatus({ server: 'up', inServedGame: false, error: null })).toEqual({
      text: 'Saved · not in the served game yet',
      bad: false,
    });
    expect(saveStatus({ server: 'up', inServedGame: false, error: 'disk full' })).toEqual({
      text: "Couldn't save: disk full. Your changes are still here.",
      bad: true,
    });
  });

  it("H: the save client reports the server's answer, and a missing or failing server", async () => {
    const answering = (status: number, body: string): typeof fetch =>
      (async () => new Response(status === 204 ? null : body, { status })) as typeof fetch;
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const ok = answering(200, '{"inServedGame":false}');
    expect(await httpSaver('/x', ok).probe()).toEqual({ inServedGame: false });
    expect(await httpSaver('/x', answering(404, 'Not Found')).probe()).toBeNull();
    expect(await httpSaver('/x', down).probe()).toBeNull();
    expect(await httpSaver('/x', ok).save({ 'snag.close': 0.56 })).toEqual({ inServedGame: false });
    await expect(
      httpSaver('/x', answering(400, 'snag.nope is not a setting')).save({}),
    ).rejects.toThrow('snag.nope is not a setting');
    await expect(httpSaver('/x', down).save({})).rejects.toThrow('Failed to fetch');
  });
});
