// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/ui/hud';
import { playerMenu } from '../../src/arcade/ui/playerMenu';

/** The player's menu as the HUD draws it (docs/PLAYER_MENU.md, c2 tests 2 and 3). */
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
  });
  return { root, hud, calls };
};

describe('the strip', () => {
  it('shows Route, Perk and Audible, greyed, and hides again', () => {
    const { root, hud } = make();
    const strip = root.querySelector<HTMLElement>('.hud-menu')!;
    expect(strip.hidden).toBe(true);
    hud.setPlayerMenu(playerMenu(true, 2));
    expect(strip.hidden).toBe(false);
    const slots = [...strip.querySelectorAll<HTMLButtonElement>('button')];
    expect(slots.map((b) => b.textContent)).toEqual(['Route', 'Perk', 'Audible']);
    expect(slots.every((b) => b.disabled && b.classList.contains('soon'))).toBe(true);
    hud.setPlayerMenu(null);
    expect(strip.hidden).toBe(true);
  });

  it('takes its own taps, so a tap on it never reaches the field behind (the overlay lets taps through only where nothing is interactive)', () => {
    const { root } = make();
    expect(root.querySelector('.hud-menu')!.classList.contains('interactive')).toBe(true);
  });

  it('a tap on a greyed slot does nothing and sends nothing to the game', () => {
    const { root, hud, calls } = make();
    hud.setPlayerMenu(playerMenu(true, 2));
    for (const b of root.querySelectorAll<HTMLButtonElement>('.hud-menu button')) b.click();
    expect(calls).toEqual([]);
  });
});
