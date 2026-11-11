/**
 * The dev setup page (docs/DEV_SETUP.md, v3, d9): every run option as a
 * switch, saved on this phone for every new run, or copied as a link. Three
 * sections (Throwing & modes, Tap tests, On the field), then Save & play,
 * Copy link and Restore defaults. What can't be read or done is said on the
 * status line and stays until tapped.
 */
import { AREAS } from '../../arcade/content/defense';
import {
  BREAK_KINDS,
  CATCH_SETTINGS,
  RUN_DEFAULTS,
  changedSwitches,
  linkFor,
  runOptionsFrom,
  switchFromText,
  type CatchSetting,
  type RunOptions,
} from '../../arcade/content/runOptions';
import { reasonOf, type SetupStore } from '../../arcade/content/savedSetup';
import type { BreakKind } from '../../arcade/sim/types';
import { el, statusLine } from '../pageKit';
import { assertNever } from '../../assertNever';

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

/** An on/off switch as the editors draw one: the `.tog` button, pumpkin when on (src/dev/controls.css). */
interface Toggle {
  readonly el: HTMLButtonElement;
  readonly on: boolean;
  set(on: boolean): void;
}

/** A toggle named `name` (its `data-name`), reading `text`; a tap flips it and calls `flipped`. */
function toggle(name: string, text: string, flipped: () => void): Toggle {
  const button = el('button', { className: 'tog', text });
  button.type = 'button';
  button.dataset.name = name;
  const t: Toggle = {
    el: button,
    get on() {
      return button.classList.contains('on');
    },
    set(on) {
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    },
  };
  button.addEventListener('click', () => {
    t.set(!t.on);
    flipped();
  });
  return t;
}

/** A row of toggles, with a line under them. */
const toggles = (items: readonly Toggle[], hint = ''): HTMLElement => {
  const r = el('div', { className: 'togs' }, ...items.map((t) => t.el));
  if (hint) r.append(el('small', { text: hint }));
  return r;
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
  const refresh = (): void => {
    holdLastKind();
    countChanged();
  };
  const hard = toggle('hard', 'Hard mode', refresh);
  const area = select(
    'area',
    AREAS.map((a, i) => [String(i + 1), `${i + 1}. ${a.name}`] as const),
  );
  const seed = el('input');
  seed.name = 'seed';
  seed.inputMode = 'numeric';
  seed.placeholder = 'random';
  const kinds = new Map(BREAK_KINDS.map((k) => [k, toggle(k, BREAK_NAMES[k], refresh)] as const));
  const catchChoices = CATCH_SETTINGS.map((c) => [c, CATCH_NAMES[c]] as const);
  const snagIt = select('snagIt', catchChoices);
  const tipDrill = select('tipDrill', catchChoices);
  const pickupsOn = toggle('pickupsOn', 'Pickups', refresh);
  const fieldEventsOn = toggle('fieldEventsOn', 'Field events', refresh);
  const startWithPerks = toggle('startWithPerks', 'Every perk', refresh);
  const monsters = toggle('monsters', 'Monster team', refresh);
  const playerMenu = toggle('playerMenu', 'Player menu', refresh);
  const changed = el('p', { className: 'changed' });
  const status = el('div', { className: 'status' });
  status.hidden = true;
  const say = statusLine(status).say;

  /** The last Break it! kind on can't go off: its toggle is held (dimmed, as a disabled chip is). */
  function holdLastKind(): void {
    const on = [...kinds.values()].filter((t) => t.on);
    for (const t of kinds.values()) t.el.disabled = on.length === 1 && t.on;
  }

  /** Show these options on the page. */
  const show = (o: RunOptions): void => {
    twoTapAim.value = o.twoTapAim ? 'two' : 'one';
    hard.set(o.hard);
    area.value = String(o.area);
    seed.value = o.seed === null ? '' : String(o.seed);
    for (const [k, t] of kinds) t.set(o.breakItKinds.includes(k));
    snagIt.value = o.snagIt;
    tipDrill.value = o.tipDrill;
    pickupsOn.set(o.pickupsOn);
    fieldEventsOn.set(o.fieldEventsOn);
    startWithPerks.set(o.startWithPerks);
    monsters.set(o.monsters);
    playerMenu.set(o.playerMenu);
    refresh();
  };

  /** The options the page shows, or what's wrong with them. */
  const read = (): { ok: true; options: RunOptions } | { ok: false; problem: string } => {
    // Blank is a random seed; anything else goes through the link's check (runOptions.ts).
    const seedText = seed.value.trim();
    const seedValue = seedText === '' ? null : switchFromText('seed', seedText);
    if (seedValue === undefined)
      return {
        ok: false,
        problem: 'The seed must be a whole number above 0, or blank for a random one.',
      };
    return {
      ok: true,
      options: {
        seed: seedValue,
        area: Number(area.value),
        hard: hard.on,
        twoTapAim: twoTapAim.value === 'two',
        snagIt: snagIt.value as CatchSetting,
        tipDrill: tipDrill.value as CatchSetting,
        breakItKinds: BREAK_KINDS.filter((k) => kinds.get(k)?.on),
        pickupsOn: pickupsOn.on,
        fieldEventsOn: fieldEventsOn.on,
        startWithPerks: startWithPerks.on,
        monsters: monsters.on,
        playerMenu: playerMenu.on,
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
      toggles([hard]),
      row('Start in', area),
      row('Seed', seed, 'Blank for a random one; AGAIN plays the next.'),
    ),
    el(
      'section',
      {},
      el('h2', { text: 'Tap tests' }),
      toggles([...kinds.values()], 'Break it!: the kinds a tackle can deal. One stays on.'),
      row('SNAG IT!', snagIt),
      row('Tip drill', tipDrill),
    ),
    el(
      'section',
      {},
      el('h2', { text: 'On the field' }),
      toggles(
        [pickupsOn, fieldEventsOn, startWithPerks, monsters, playerMenu],
        'Pickups: bolts and gravestones. Field events off: none from the seed; Frog Rain stays Mister Frog’s. Every perk: start holding them all. Player menu: a strip of buttons for a selected player, nothing in it works yet.',
      ),
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
  // The dropdowns and the seed box; the toggles refresh as they're tapped.
  root.addEventListener('change', refresh);

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
    default:
      assertNever(saved);
  }
}
