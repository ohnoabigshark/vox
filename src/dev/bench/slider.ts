/**
 * The test bench's slider widget (docs/BENCH.md, r-u1–u4): a row whose knob
 * is the only thing that moves it. The rules (grabbing, snapping, what a row
 * shows) are in row.ts; this draws them and takes the pointer and keys.
 */
import { Grab, snap, type Range, type RowView } from './row';

/** What a slider row shows; the tuning rows add the rest of `RowView`. */
export type Shown = Pick<RowView, 'shown' | 'at'> & Partial<RowView> & { readonly value: number };

/**
 * A slider row that moves only when its knob is dragged (r-u1): a touch on
 * the track does nothing and a swipe from there scrolls the page. The knob
 * also takes the arrow keys. With `onReset`, the row has a ↺ (r-u3).
 */
export function slider(
  name: string,
  range: Range,
  on: { onMove(v: number): void; onReset?(): void },
): { el: HTMLElement; show(view: Shown): void } {
  const el = document.createElement('div');
  el.className = 'b-slider';
  el.innerHTML = `
    <span class="b-name"></span><output></output>
    <div class="b-track"><span class="b-fill"></span><span class="b-tick" hidden></span>
      <span class="b-knob" role="slider" tabindex="0"></span></div>
    <small hidden></small>`;
  const q = <T extends HTMLElement>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (!found) throw new Error(`slider missing ${sel}`);
    return found;
  };
  const title = q('.b-name');
  title.textContent = name;
  const mark = document.createElement('em');
  mark.textContent = 'UNSAVED';
  const output = q<HTMLOutputElement>('output');
  const track = q('.b-track');
  const fill = q('.b-fill');
  const tick = q('.b-tick');
  const knob = q('.b-knob');
  const note = q('small');
  knob.setAttribute('aria-label', name);
  knob.setAttribute('aria-valuemin', String(range.min));
  knob.setAttribute('aria-valuemax', String(range.max));
  let reset: HTMLButtonElement | null = null;
  if (on.onReset) {
    reset = document.createElement('button');
    reset.className = 'b-one';
    reset.textContent = '↺';
    reset.setAttribute('aria-label', `${name}: back to its default`);
    reset.addEventListener('click', () => on.onReset?.());
    output.after(reset);
  }
  let value = range.min;
  const grab = new Grab(range, () => track.getBoundingClientRect().width);
  const moveTo = (v: number): void => {
    if (v !== value) on.onMove(v);
  };
  track.addEventListener('pointerdown', (e) => {
    const onKnob = e.target instanceof Element && e.target.closest('.b-knob') !== null;
    if (!grab.down(onKnob ? 'knob' : 'track', e.clientX, value)) return;
    e.preventDefault();
    knob.setPointerCapture(e.pointerId);
    knob.focus();
    el.classList.add('grabbed');
  });
  knob.addEventListener('pointermove', (e) => {
    const v = grab.move(e.clientX);
    if (v !== null) moveTo(v);
  });
  const letGo = (): void => {
    if (!grab.dragging) return;
    grab.up();
    el.classList.remove('grabbed');
  };
  knob.addEventListener('pointerup', letGo);
  knob.addEventListener('pointercancel', letGo);
  knob.addEventListener('keydown', (e) => {
    const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (by === undefined) return;
    e.preventDefault();
    moveTo(snap(value + by * range.step, range));
  });
  return {
    el,
    show(view) {
      value = view.value;
      output.textContent = view.shown;
      knob.style.left = fill.style.width = `${view.at * 100}%`;
      knob.setAttribute('aria-valuenow', String(view.value));
      knob.setAttribute('aria-valuetext', view.shown);
      if (view.tick !== undefined) {
        tick.hidden = false;
        tick.style.left = `${view.tick * 100}%`;
      }
      if (view.note !== undefined) {
        note.hidden = false;
        note.textContent = view.note;
      }
      el.classList.toggle('unsaved', view.unsaved === true);
      if (view.unsaved) title.append(mark);
      else mark.remove();
      if (reset) reset.disabled = view.atDefault === true;
    },
  };
}
