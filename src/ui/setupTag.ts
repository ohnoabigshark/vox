/**
 * The start screen's DEV SETUP tag (docs/DEV_SETUP.md, d2): shown only when
 * the saved setup changes some switches, saying how many. Tapping it opens
 * the setup page; Reset forgets the setup, and the tag goes. A Reset that
 * fails says why on the tag, never silently.
 */
import { reasonOf } from '../arcade/content/savedSetup';

/** Where the setup page is, from the game's page. */
export const SETUP_PAGE = 'dev/setup.html';

/** The tag for a setup that changes `changed` switches, or null when it changes none. */
export function setupTag(changed: number, reset: () => Promise<void>): HTMLElement | null {
  if (changed <= 0) return null;
  const tag = document.createElement('div');
  tag.className = 'setup-tag';
  const open = document.createElement('a');
  open.href = SETUP_PAGE;
  open.textContent = `DEV SETUP · ${changed} changed`;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reset';
  const problem = document.createElement('span');
  problem.className = 'setup-tag-problem';
  button.addEventListener('click', () => {
    button.disabled = true;
    reset().then(
      () => tag.remove(),
      (e: unknown) => {
        button.disabled = false;
        problem.textContent = `Couldn’t reset: ${reasonOf(e)}`;
      },
    );
  });
  tag.append(open, button, problem);
  return tag;
}
