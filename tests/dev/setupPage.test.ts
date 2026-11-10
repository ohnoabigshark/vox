// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { RUN_DEFAULTS, readLink, type RunOptions } from '../../src/arcade/content/runOptions';
import type { SetupRead, SetupStore } from '../../src/arcade/content/savedSetup';
import { PAGE_NOTE, mountSetupPage } from '../../src/dev/setup/page';

/** docs/DEV_SETUP.md, the `dev-setup` tests the page answers (d8: 1, 4, 8, 9). */

/** A store over a value in memory, that records what's saved. */
function fakeStore(
  read: SetupRead,
): SetupStore & { saved: Partial<RunOptions>[]; cleared: number } {
  const store = {
    saved: [] as Partial<RunOptions>[],
    cleared: 0,
    read: async () => read,
    save: async (setup: Partial<RunOptions>) => {
      store.saved.push(setup);
    },
    clear: async () => {
      store.cleared++;
    },
  };
  return store;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

async function mount(read: SetupRead = { kind: 'nothing' }) {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  const store = fakeStore(read);
  const copied: string[] = [];
  const went: string[] = [];
  await mountSetupPage(root, {
    store,
    gameUrl: 'https://example.ts.net/vox/',
    copy: async (text) => {
      copied.push(text);
    },
    go: (url) => went.push(url),
  });
  return { root, store, copied, went };
}

const box = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const choice = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === text)!;

function change(el: HTMLInputElement | HTMLSelectElement, to?: string): void {
  if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !el.checked;
  else if (to !== undefined) el.value = to;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => document.body.replaceChildren());

describe('the page says practice ignores it (test 8)', () => {
  it('at the top', async () => {
    const { root } = await mount();
    expect(PAGE_NOTE).toBe(
      'These switches change runs of the game only. Practice from the play and event editors ignores them.',
    );
    expect(root.querySelector('.note')?.textContent).toBe(PAGE_NOTE);
  });
});

describe('the page and the saved setup (test 1)', () => {
  it('shows the defaults when nothing is saved, and Save & play saves it and opens the game', async () => {
    const { root, store, went } = await mount();
    expect(box(root, 'hard').checked).toBe(true);
    expect(choice(root, 'snagIt').value).toBe('normal');
    change(box(root, 'hard'));
    change(choice(root, 'fieldEvents'), 'willOWisps');
    button(root, 'Save & play').click();
    await settle();
    expect(store.saved).toEqual([{ ...RUN_DEFAULTS, hard: false, fieldEvents: 'willOWisps' }]);
    expect(went).toEqual(['https://example.ts.net/vox/']);
  });

  it('shows what is saved', async () => {
    const { root } = await mount({
      kind: 'saved',
      setup: { twoTapAim: false, seed: 77, breakItKinds: ['juke'] },
      warnings: [],
    });
    expect(choice(root, 'twoTapAim').value).toBe('one');
    expect(box(root, 'seed').value).toBe('77');
    expect(box(root, 'bar').checked).toBe(false);
    expect(box(root, 'juke').checked).toBe(true);
  });

  it("storage that can't be read shows an error on the page", async () => {
    const { root } = await mount({ kind: 'unreadable', reason: 'localStorage is unavailable' });
    const status = root.querySelector('.status.bad');
    expect(status?.textContent).toContain('localStorage is unavailable');
    expect(status?.textContent).toContain('The game plays the defaults');
  });

  it('a warning about a left-out value is shown', async () => {
    const { root } = await mount({
      kind: 'saved',
      setup: {},
      warnings: ['The dev setup’s area (9) isn’t one it knows, so it was left out.'],
    });
    expect(root.querySelector('.status.bad')?.textContent).toContain('area (9)');
  });

  it('Restore defaults puts every switch back and clears the saved setup', async () => {
    const { root, store } = await mount({ kind: 'saved', setup: { hard: false }, warnings: [] });
    expect(box(root, 'hard').checked).toBe(false);
    button(root, 'Restore defaults').click();
    await settle();
    expect(box(root, 'hard').checked).toBe(true);
    expect(store.cleared).toBe(1);
  });

  it('a seed that is not a whole number above 0 is refused, not saved', async () => {
    const { root, store } = await mount();
    change(box(root, 'seed'), 'abc');
    button(root, 'Save & play').click();
    await settle();
    expect(store.saved).toEqual([]);
    expect(root.querySelector('.status.bad')?.textContent).toContain('seed');
  });
});

describe('Break it! kinds on the page (test 4)', () => {
  it('won’t let the last one go off', async () => {
    const { root } = await mount();
    change(box(root, 'bar'));
    expect(box(root, 'mash').disabled).toBe(false);
    change(box(root, 'mash'));
    expect(box(root, 'juke').checked).toBe(true);
    expect(box(root, 'juke').disabled).toBe(true);
    // Back on, and the others can go off again.
    change(box(root, 'bar'));
    expect(box(root, 'juke').disabled).toBe(false);
  });
});

describe('Copy link on the page (test 9)', () => {
  it('copies the game with every changed switch', async () => {
    const { root, copied } = await mount();
    change(box(root, 'hard'));
    change(box(root, 'pickupsOn'));
    button(root, 'Copy link').click();
    await settle();
    expect(copied).toHaveLength(1);
    const url = new URL(copied[0]!);
    expect(url.origin + url.pathname).toBe('https://example.ts.net/vox/');
    expect(readLink(url.searchParams).run).toEqual({ hard: false, pickupsOn: false });
  });

  it('a copy that fails shows the link to copy by hand', async () => {
    const root = document.createElement('main');
    document.body.replaceChildren(root);
    await mountSetupPage(root, {
      store: fakeStore({ kind: 'nothing' }),
      gameUrl: 'https://example.ts.net/vox/',
      copy: async () => {
        throw new Error('not allowed');
      },
      go: () => {},
    });
    change(box(root, 'hard'));
    button(root, 'Copy link').click();
    await settle();
    const status = root.querySelector('.status.bad');
    expect(status?.textContent).toContain('not allowed');
    expect(status?.textContent).toContain('https://example.ts.net/vox/?hard=0');
  });
});
