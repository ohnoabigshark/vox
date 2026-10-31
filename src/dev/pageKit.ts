/**
 * Small pieces the dev editors' pages share (the play editor, the event
 * editor): building elements, and the status line, where good news goes by
 * itself and a problem stays until tapped, never swallowed.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; onClick?: () => void } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (props.className) e.className = props.className;
  if (props.text !== undefined) e.textContent = props.text;
  if (props.onClick) e.addEventListener('click', props.onClick);
  e.append(...children);
  return e;
}

/** The page's element for this selector, which its HTML must have. */
export function required(page: string, selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`${page} is missing ${selector}`);
  return found;
}

/** The status line on `statusEl`: say something, or run some work and say what went wrong. */
export function statusLine(statusEl: HTMLElement): {
  say(text: string, bad?: boolean): void;
  attempt(work: () => Promise<void>): Promise<boolean>;
} {
  let timer = 0;
  const say = (text: string, bad = false): void => {
    statusEl.textContent = text;
    statusEl.classList.toggle('bad', bad);
    statusEl.hidden = false;
    window.clearTimeout(timer);
    // A problem stays until tapped; good news goes by itself.
    if (!bad) timer = window.setTimeout(() => (statusEl.hidden = true), 2600);
  };
  statusEl.addEventListener('click', () => (statusEl.hidden = true));
  /** Run some work; a failure is shown, never swallowed. */
  const attempt = async (work: () => Promise<void>): Promise<boolean> => {
    try {
      await work();
      return true;
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true);
      return false;
    }
  };
  return { say, attempt };
}
