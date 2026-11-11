// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { setupTag } from '../../src/ui/setupTag';

/** docs/DEV_SETUP.md, `dev-setup` test 3: the start screen's DEV SETUP tag. */
describe('the tag (test 3)', () => {
  it('shows nothing when the setup changes nothing', () => {
    expect(setupTag(0, async () => {})).toBeNull();
  });

  it('says how many switches the setup changes, and opens the setup page', () => {
    const tag = setupTag(3, async () => {});
    expect(tag).not.toBeNull();
    const open = tag!.querySelector('a');
    expect(open?.textContent).toBe('DEV SETUP · 3 changed');
    expect(open?.getAttribute('href')).toBe('dev/setup.html');
  });

  it('Reset clears the setup and the tag goes', async () => {
    let cleared = 0;
    const screen = document.createElement('div');
    const tag = setupTag(2, async () => {
      cleared++;
    })!;
    screen.append(tag);
    const reset = [...tag.querySelectorAll('button')].find((b) => b.textContent === 'Reset');
    reset!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(cleared).toBe(1);
    expect(screen.contains(tag)).toBe(false);
  });

  it('a Reset that fails says so, and the tag stays', async () => {
    const screen = document.createElement('div');
    const tag = setupTag(1, async () => {
      throw new Error('localStorage is unavailable');
    })!;
    screen.append(tag);
    [...tag.querySelectorAll('button')].find((b) => b.textContent === 'Reset')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.contains(tag)).toBe(true);
    expect(tag.textContent).toContain('Couldn’t reset: localStorage is unavailable');
  });
});
