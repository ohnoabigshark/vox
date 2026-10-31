import { describe, expect, it } from 'vitest';
import {
  httpSaver,
  restoredTab,
  saveLabel,
  savedAfter,
  saveStatus,
  tabsWithUnsaved,
  unsaved,
  type SaveState,
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
    const current = { 'breakit.ready': 2 };
    expect(unsaved({}, current, 'mash')).toEqual(['breakit.ready']);
    const saved = savedAfter({}, current, 'bar');
    expect(saved).toEqual({ 'breakit.ready': 2 });
    for (const t of ['bar', 'mash', 'juke'] as const)
      expect(unsaved(saved, current, t)).toEqual([]);
    const restored = restoredTab(current, 'juke');
    expect(restored).toEqual({});
    for (const t of ['bar', 'mash', 'juke'] as const) {
      expect(unsaved(saved, restored, t)).toEqual(['breakit.ready']);
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
    const current = { 'snag.close': 0.56, 'crows.window': 0.7, 'breakit.ready': 2 };
    expect(tabsWithUnsaved(saved, current)).toEqual(['bar', 'mash', 'juke', 'shoo']);
    expect(tabsWithUnsaved(saved, saved)).toEqual([]);
  });

  it('H: the status says where saves stand, plainly, and a failure in red', () => {
    const status = (server: SaveState['server'], error: string | null = null) =>
      saveStatus({ server, error });
    expect(status({ kind: 'checking' })).toEqual({
      text: 'Checking for the save server…',
      bad: false,
    });
    expect(status({ kind: 'none' })).toEqual({
      text: 'Saving needs the hot-reload server (/vox-dev/dev/bench.html)',
      bad: true,
    });
    expect(status({ kind: 'up', inServedGame: true })).toEqual({
      text: 'Saved settings are in the served game',
      bad: false,
    });
    expect(status({ kind: 'up', inServedGame: false })).toEqual({
      text: 'Saved · not in the served game yet',
      bad: false,
    });
    expect(status({ kind: 'up', inServedGame: false }, 'disk full')).toEqual({
      text: "Couldn't save: disk full. Your changes are still here.",
      bad: true,
    });
  });

  it("b11: a server that answers with an error says so in its words, not 'no server'", () => {
    expect(
      saveStatus({ server: { kind: 'broken', reason: 'git: not a repository' }, error: null }),
    ).toEqual({
      text: "The save server can't save: git: not a repository",
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
    expect(await httpSaver('/x', ok).probe()).toEqual({ kind: 'up', inServedGame: false });
    expect(await httpSaver('/x', answering(404, 'Not Found')).probe()).toEqual({ kind: 'none' });
    expect(await httpSaver('/x', down).probe()).toEqual({ kind: 'none' });
    expect(await httpSaver('/x', answering(500, 'git: not a repository')).probe()).toEqual({
      kind: 'broken',
      reason: 'git: not a repository',
    });
    expect(await httpSaver('/x', ok).save({ 'snag.close': 0.56 })).toEqual({ inServedGame: false });
    await expect(
      httpSaver('/x', answering(400, 'snag.nope is not a setting')).save({}),
    ).rejects.toThrow('snag.nope is not a setting');
    await expect(httpSaver('/x', down).save({})).rejects.toThrow('Failed to fetch');
  });
});
