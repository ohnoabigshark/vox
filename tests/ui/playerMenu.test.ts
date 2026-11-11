// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/ui/hud';
import type { PlayerMenuView } from '../../src/ui/hud';

/** The player's menu as the HUD draws it (docs/PLAYER_MENU.md, c2 tests 2 and 3, and c3 test 1). */

/** The strip for a Catcher: Route works, Perk and Audible are greyed. */
const CATCHER: PlayerMenuView = {
  slots: [
    { slot: 'route', works: true },
    { slot: 'perk', works: false },
    { slot: 'audible', works: false },
  ],
};
/** For a Blocker: all three greyed. */
const BLOCKER: PlayerMenuView = {
  slots: CATCHER.slots.map((s) => ({ ...s, works: false })),
};
const make = () => {
  const root = document.createElement('div');
  const calls: string[] = [];
  const log = (name: string) => (): void => void calls.push(name);
  const hud = new Hud(root, {
    onAction: log('action'),
    onCard: log('card'),
    onFlip: log('flip'),
    onDraft: log('draft'),
    onSkip: log('skip'),
    onNames: log('names'),
    onUnselect: log('unselect'),
    onMenu: (slot) => void calls.push(`menu:${slot}`),
  });
  return { root, hud, calls };
};

describe('the strip', () => {
  it('shows Route, Perk and Audible, greyed but for a working Route, and hides again', () => {
    const { root, hud } = make();
    const strip = root.querySelector<HTMLElement>('.hud-menu')!;
    expect(strip.hidden).toBe(true);
    hud.setPlayerMenu(CATCHER);
    expect(strip.hidden).toBe(false);
    const slots = [...strip.querySelectorAll<HTMLButtonElement>('button')];
    expect(slots.map((b) => b.textContent)).toEqual(['Route', 'Perk', 'Audible']);
    expect(slots.map((b) => b.disabled)).toEqual([false, true, true]);
    expect(slots.map((b) => b.classList.contains('soon'))).toEqual([false, true, true]);
    hud.setPlayerMenu(BLOCKER);
    expect([...strip.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    hud.setPlayerMenu(null);
    expect(strip.hidden).toBe(true);
  });

  it('takes its own taps, so a tap on it never reaches the field behind (the overlay lets taps through only where nothing is interactive)', () => {
    const { root } = make();
    expect(root.querySelector('.hud-menu')!.classList.contains('interactive')).toBe(true);
  });

  it('a tap on a greyed slot does nothing and sends nothing to the game', () => {
    const { root, hud, calls } = make();
    hud.setPlayerMenu(BLOCKER);
    for (const b of root.querySelectorAll<HTMLButtonElement>('.hud-menu button')) b.click();
    expect(calls).toEqual([]);
  });

  it('a tap on Route tells the game, once a tap, and the button still says Route', () => {
    const { root, hud, calls } = make();
    hud.setPlayerMenu(CATCHER);
    const route = root.querySelector<HTMLButtonElement>('.hud-menu button')!;
    route.click();
    route.click();
    expect(calls).toEqual(['menu:route', 'menu:route']);
    expect(route.textContent).toBe('Route');
  });
});
