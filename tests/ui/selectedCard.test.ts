// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Hud, type SelectedCard } from '../../src/ui/hud';

/** The selected player's card and the Aa switch, as the HUD draws them (docs/SELECT.md, s3, n2). */
const make = () => {
  const root = document.createElement('div');
  const calls: string[] = [];
  const noop = (): void => {};
  const hud = new Hud(root, {
    onAction: noop,
    onCard: noop,
    onFlip: noop,
    onDraft: noop,
    onSkip: noop,
    onNames: () => calls.push('names'),
    onUnselect: () => calls.push('unselect'),
  });
  return { root, hud, calls };
};

const card: SelectedCard = {
  name: 'Kid Carver',
  form: 'Human',
  position: 'Runner',
  icon: '',
  stats: [
    { label: 'Hustle', value: 62, key: true, delta: 12 },
    { label: 'Hands', value: 50 },
    { label: 'Heft', value: 50 },
  ],
};

describe('the selected card', () => {
  it('shows the name, kind and position, its bars, and ✕ clears it', () => {
    const { root, hud, calls } = make();
    hud.setSelected(card);
    const el = root.querySelector<HTMLElement>('.hud-selected')!;
    expect(el.hidden).toBe(false);
    expect(el.textContent).toContain('Kid Carver');
    expect(el.textContent).toContain('Human · Runner');
    expect(el.querySelectorAll('.hud-stat')).toHaveLength(3);
    el.querySelector<HTMLButtonElement>('.hud-selected-close')!.click();
    expect(calls).toEqual(['unselect']);
    hud.setSelected(null);
    expect(el.hidden).toBe(true);
  });
});

describe('the names switch', () => {
  it('shows before the snap only, struck through when off, and tapping it calls back', () => {
    const { root, hud, calls } = make();
    const button = root.querySelector<HTMLButtonElement>('.hud-names')!;
    hud.setNamesSwitch(null);
    expect(button.hidden).toBe(true);
    hud.setNamesSwitch(true);
    expect(button.hidden).toBe(false);
    expect(button.classList.contains('off')).toBe(false);
    hud.setNamesSwitch(false);
    expect(button.classList.contains('off')).toBe(true);
    button.click();
    expect(calls).toEqual(['names']);
  });
});
