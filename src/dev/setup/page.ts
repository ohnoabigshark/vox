/**
 * The dev setup page (docs/DEV_SETUP.md, v3, d9): every run option as a
 * switch, saved on this phone for every new run, or copied as a link. Three
 * sections (Throwing & modes, Tap tests, On the field), then Save & play,
 * Copy link and Restore defaults. What can't be read or done is said on the
 * status line and stays until tapped.
 */
import { AREAS } from '../../arcade/content/defense';
import { fieldEventById, GENERIC_EVENTS } from '../../arcade/content/fieldEvents';
import {
  BREAK_KINDS,
  CATCH_SETTINGS,
  RUN_DEFAULTS,
  changedSwitches,
  linkFor,
  runOptionsFrom,
  type CatchSetting,
  type FieldEventsSetting,
  type RunOptions,
} from '../../arcade/content/runOptions';
import { reasonOf, type SetupStore } from '../../arcade/content/savedSetup';
import type { BreakKind } from '../../arcade/sim/types';
import { el, statusLine } from '../pageKit';

/** The line at the top of the page (d5, the user's note). */
export const PAGE_NOTE =
  'These switches change runs of the game only. Practice from the play and event editors ignores them.';

export interface SetupPageDeps {
  readonly store: SetupStore;
  /** The game's page: Save & play goes there, and Copy link starts from it. */
  readonly gameUrl: string;
  /** Put text on the clipboard. */
  copy(text: string): Promise<void>;
  /** Open a page. */
  go(url: string): void;
}

const BREAK_NAMES: Readonly<Record<BreakKind, string>> = {
  bar: 'The bar',
  mash: 'MASH!',
  juke: 'JUKE!',
};

const CATCH_NAMES: Readonly<Record<CatchSetting, string>> = {
  off: 'Off',
  normal: 'Normal (from series 5)',
  always: 'Always (from series 1)',
};

/** A labelled row holding a control. */
const row = (label: string, control: HTMLElement, hint = ''): HTMLElement => {
  const l = el('label', { className: 'row' }, el('span', { text: label }), control);
  if (hint) l.append(el('small', { text: hint }));
  return l;
};

const checkbox = (name: string): HTMLInputElement => {
  const box = el('input');
  box.type = 'checkbox';
  box.name = name;
  return box;
};

const select = (
  name: string,
  options: readonly (readonly [string, string])[],
): HTMLSelectElement => {
  const s = el('select');
  s.name = name;
  for (const [value, text] of options) {
    const o = el('option', { text });
    o.value = value;
    s.append(o);
  }
  return s;
};

/** Build the page in `root`, showing the saved setup (or the defaults). */
export async function mountSetupPage(root: HTMLElement, deps: SetupPageDeps): Promise<void> {
  const twoTapAim = select('twoTapAim', [
    ['two', 'Two-tap'],
    ['one', 'One-tap (esrauch’s)'],
  ]);
  const hard = checkbox('hard');
  const area = select(
    'area',
    AREAS.map((a, i) => [String(i + 1), `${i + 1}. ${a.name}`] as const),
  );
  const seed = el('input');
  seed.name = 'seed';
  seed.inputMode = 'numeric';
  seed.placeholder = 'random';
  const kinds = new Map(BREAK_KINDS.map((k) => [k, checkbox(k)] as const));
  const catchChoices = CATCH_SETTINGS.map((c) => [c, CATCH_NAMES[c]] as const);
  const snagIt = select('snagIt', catchChoices);
  const tipDrill = select('tipDrill', catchChoices);
  const pickupsOn = checkbox('pickupsOn');
  const fieldEvents = select('fieldEvents', [
    ['off', 'Off'],
    ['normal', 'Normal (the seed’s)'],
    ...GENERIC_EVENTS.map((id) => [id, `Always ${fieldEventById(id).name}`] as const),
  ]);
  const startWithPerks = checkbox('startWithPerks');
  const monsters = checkbox('monsters');
  const changed = el('p', { className: 'changed' });
  const status = el('div', { className: 'status' });
  status.hidden = true;
  const say = statusLine(status).say;

  /** The last Break it! kind on can't go off: its box is held. */
  const holdLastKind = (): void => {
    const on = [...kinds.values()].filter((b) => b.checked);
    for (const box of kinds.values()) box.disabled = on.length === 1 && box.checked;
  };

  /** Show these options on the page. */
  const show = (o: RunOptions): void => {
    twoTapAim.value = o.twoTapAim ? 'two' : 'one';
    hard.checked = o.hard;
    area.value = String(o.area);
    seed.value = o.seed === null ? '' : String(o.seed);
    for (const [k, box] of kinds) box.checked = o.breakItKinds.includes(k);
    snagIt.value = o.snagIt;
    tipDrill.value = o.tipDrill;
    pickupsOn.checked = o.pickupsOn;
    fieldEvents.value = o.fieldEvents;
    startWithPerks.checked = o.startWithPerks;
    monsters.checked = o.monsters;
    holdLastKind();
    countChanged();
  };

  /** The options the page shows, or what's wrong with them. */
  const read = (): { ok: true; options: RunOptions } | { ok: false; problem: string } => {
    const seedText = seed.value.trim();
    if (seedText !== '' && !/^[1-9]\d*$/.test(seedText))
      return {
        ok: false,
        problem: 'The seed must be a whole number above 0, or blank for a random one.',
      };
    return {
      ok: true,
      options: {
        seed: seedText === '' ? null : Number(seedText),
        area: Number(area.value),
        hard: hard.checked,
        twoTapAim: twoTapAim.value === 'two',
        snagIt: snagIt.value as CatchSetting,
        tipDrill: tipDrill.value as CatchSetting,
        breakItKinds: BREAK_KINDS.filter((k) => kinds.get(k)?.checked),
        pickupsOn: pickupsOn.checked,
        fieldEvents: fieldEvents.value as FieldEventsSetting,
        startWithPerks: startWithPerks.checked,
        monsters: monsters.checked,
      },
    };
  };

  function countChanged(): void {
    const now = read();
    const n = now.ok ? changedSwitches(now.options).length : null;
    changed.textContent =
      n === null
        ? ''
        : n === 0
          ? 'The defaults: nothing changed.'
          : `${n} changed from the defaults.`;
  }

  const saveAndPlay = async (): Promise<void> => {
    const now = read();
    if (!now.ok) return say(now.problem, true);
    try {
      await deps.store.save(now.options);
    } catch (e) {
      return say(`Couldn’t save the setup: ${reasonOf(e)}`, true);
    }
    deps.go(deps.gameUrl);
  };

  const copyLink = async (): Promise<void> => {
    const now = read();
    if (!now.ok) return say(now.problem, true);
    const url = deps.gameUrl + linkFor(now.options);
    try {
      await deps.copy(url);
      say('Copied the link.');
    } catch (e) {
      say(`Couldn’t copy (${reasonOf(e)}). The link: ${url}`, true);
    }
  };

  const restore = async (): Promise<void> => {
    show(RUN_DEFAULTS);
    try {
      await deps.store.clear();
      say('Back to the defaults, and nothing saved.');
    } catch (e) {
      say(`Couldn’t clear the saved setup: ${reasonOf(e)}`, true);
    }
  };

  root.replaceChildren(
    el('header', {}, el('a', { text: '← dev' }), el('strong', { text: 'Dev setup' })),
    el('p', { className: 'note', text: PAGE_NOTE }),
    changed,
    el(
      'section',
      {},
      el('h2', { text: 'Throwing & modes' }),
      row('Throw', twoTapAim),
      row('Hard mode', hard),
      row('Start in', area),
      row('Seed', seed, 'Blank for a random one; AGAIN plays the next.'),
    ),
    el(
      'section',
      {},
      el('h2', { text: 'Tap tests' }),
      ...[...kinds].map(([k, box]) => row(`Break it!: ${BREAK_NAMES[k]}`, box)),
      el('small', { text: 'At least one Break it! stays on.' }),
      row('SNAG IT!', snagIt),
      row('Tip drill', tipDrill),
    ),
    el(
      'section',
      {},
      el('h2', { text: 'On the field' }),
      row('Pickups (bolts, gravestones)', pickupsOn),
      row(
        'Field events',
        fieldEvents,
        'Always: that event on every stretch but a Boss’s. Frog Rain stays Mister Frog’s either way.',
      ),
      row('Start with every perk', startWithPerks),
      row('Monster team', monsters),
    ),
    el(
      'div',
      { className: 'buttons' },
      el('button', { text: 'Save & play', onClick: () => void saveAndPlay() }),
      el('button', { text: 'Copy link', onClick: () => void copyLink() }),
      el('button', { className: 'quiet', text: 'Restore defaults', onClick: () => void restore() }),
    ),
    status,
  );
  root.querySelector('header a')?.setAttribute('href', './');
  root.addEventListener('change', () => {
    holdLastKind();
    countChanged();
  });

  const saved = await deps.store.read();
  switch (saved.kind) {
    case 'nothing':
      show(RUN_DEFAULTS);
      break;
    case 'saved':
      show(runOptionsFrom(saved.setup));
      if (saved.warnings.length > 0) say(saved.warnings.join(' '), true);
      break;
    case 'unreadable':
      show(RUN_DEFAULTS);
      say(`The saved setup can’t be read: ${saved.reason} The game plays the defaults.`, true);
      break;
  }
}
