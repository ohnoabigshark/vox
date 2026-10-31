/**
 * The arcade game's own controls over the canvas (GAMEPLAY.md, Controls):
 * the THROW button on a pass play, SHOO! when the King's crows land on the
 * ball's holder (his drive), and the Break it! panel, one of
 * three: the bar (a sweet spot and "close" band, and a marker crossing it),
 * MASH! (a filling bar), or JUKE! (two buttons, one lighting up). Each
 * opens with a countdown ("GET READY TO MASH! 2"). For the bar and the mash
 * a tap anywhere counts; a juke takes its two buttons.
 * SNAG IT! (docs/SNAG.md) has its own box of dots, each tapped on its own.
 * Buttons fire on press, not release: in a timing game every frame counts.
 */
import './controls.css';
import type { SnagDotResult } from '../sim/types';
import { ringScale, snagBoxStyle } from './snagLook';

export interface ControlHandlers {
  onThrow(): void;
  /** A tap in Break it! (the bar, or a mash). */
  onBreakTap(): void;
  /** A juke button: left (-1) or right (+1). */
  onJuke(side: -1 | 1): void;
  /** SHOO!: drive the King's crows off. */
  onShoo(): void;
  /** SNAG IT!: a tap on this dot. */
  onSnag(dot: number): void;
}

/**
 * What the SNAG IT! box shows: whether the call is still on (no dot yet),
 * and each dot, placed as shares of the box, with how far its ring has
 * closed (null before it shows) and how it went.
 */
export interface SnagView {
  /** Which SNAG IT! this is (its start time), so a new one starts clean. */
  readonly id: number;
  readonly calling: boolean;
  readonly dots: readonly {
    readonly x: number;
    readonly y: number;
    readonly ring: number | null;
    readonly result: SnagDotResult;
  }[];
}

/**
 * What the Break it! panel shows. `ready` is the countdown's seconds left
 * (null once it's over). Bar positions are measured along the marker's trip.
 */
export type BreakView = { readonly ready: number | null } & (
  | {
      readonly kind: 'bar';
      readonly sweet: { readonly from: number; readonly to: number };
      readonly near: number;
      readonly marker: number;
      readonly dir: 1 | -1;
    }
  | { readonly kind: 'mash'; readonly fill: number; readonly left: number }
  /** The side to press, or null before it shows; and what pressing it now would get. */
  | {
      readonly kind: 'juke';
      readonly side: -1 | 1 | null;
      readonly grade: 'great' | 'ok' | 'bad' | null;
    }
);

export class ArcadeControls {
  private readonly root: HTMLElement;
  private readonly buttons: HTMLElement;
  private readonly meter: HTMLElement;
  private readonly sweet: HTMLElement;
  private readonly near: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly jukeButtons: HTMLElement;
  private readonly jukeLeft: HTMLElement;
  private readonly jukeRight: HTMLElement;
  private readonly shoo: HTMLElement;
  private readonly snagBox: HTMLElement;
  private readonly snagTitle: HTMLElement;
  private snagDots: HTMLElement[] = [];
  private snagId: number | null = null;
  private readonly onSnag: (dot: number) => void;
  private breaking = false;
  private juking = false;

  constructor(parent: HTMLElement, handlers: ControlHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'arc-controls';
    this.root.innerHTML = `
      <div class="arc-buttons" hidden>
        <button class="arc-btn arc-throw interactive">THROW</button>
      </div>
      <button class="arc-shoo interactive" hidden>SHOO CROWS!</button>
      <div class="arc-meter interactive" hidden>
        <div class="arc-meter-title">BREAK IT!</div>
        <div class="arc-meter-bar">
          <div class="arc-near"></div>
          <div class="arc-sweet"></div>
          <div class="arc-marker"></div>
          <div class="arc-fill"></div>
        </div>
        <div class="arc-juke">
          <button class="arc-juke-btn arc-juke-left">◀</button>
          <button class="arc-juke-btn arc-juke-right">▶</button>
        </div>
        <div class="arc-meter-hint">TAP!</div>
      </div>
      <div class="arc-snag interactive" hidden>
        <div class="arc-snag-title">SNAG IT!</div>
      </div>`;
    parent.append(this.root);
    const q = (sel: string): HTMLElement => {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (!el) throw new Error(`controls missing ${sel}`);
      return el;
    };
    this.buttons = q('.arc-buttons');
    this.meter = q('.arc-meter');
    this.sweet = q('.arc-sweet');
    this.near = q('.arc-near');
    this.marker = q('.arc-marker');
    this.title = q('.arc-meter-title');
    this.hint = q('.arc-meter-hint');
    this.bar = q('.arc-meter-bar');
    this.fill = q('.arc-fill');
    this.jukeButtons = q('.arc-juke');
    this.jukeLeft = q('.arc-juke-left');
    this.jukeRight = q('.arc-juke-right');
    const press = (el: HTMLElement, fn: () => void): void =>
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
    press(q('.arc-throw'), () => handlers.onThrow());
    this.shoo = q('.arc-shoo');
    press(this.shoo, () => handlers.onShoo());
    press(this.jukeLeft, () => handlers.onJuke(-1));
    press(this.jukeRight, () => handlers.onJuke(1));
    this.snagBox = q('.arc-snag');
    this.snagTitle = q('.arc-snag-title');
    this.onSnag = (dot) => handlers.onSnag(dot);
    // For the bar and the mash, a tap anywhere on the screen counts.
    window.addEventListener('pointerdown', () => {
      if (this.breaking && !this.juking) handlers.onBreakTap();
    });
  }

  /** Show the SNAG IT! box (null hides it). */
  setSnag(view: SnagView | null): void {
    this.snagBox.hidden = !view;
    if (!view) return;
    // A new SNAG IT!: fresh dots, one button each.
    if (view.id !== this.snagId) {
      this.snagId = view.id;
      for (const [name, value] of Object.entries(snagBoxStyle())) {
        this.snagBox.style.setProperty(name, value);
      }
      for (const el of this.snagDots) el.remove();
      this.snagDots = view.dots.map((_, i) => {
        const el = document.createElement('button');
        el.className = 'arc-snag-dot';
        el.innerHTML = '<div class="arc-snag-ring"></div>';
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.onSnag(i);
        });
        this.snagBox.append(el);
        return el;
      });
    }
    this.snagTitle.classList.toggle('calling', view.calling);
    view.dots.forEach((d, i) => {
      const el = this.snagDots[i];
      if (!el) return;
      el.hidden = d.ring === null;
      el.style.left = `${d.x * 100}%`;
      el.style.top = `${d.y * 100}%`;
      el.className = `arc-snag-dot${d.result ? ` ${d.result}` : ''}`;
      const ring = el.firstElementChild;
      // From `ringFrom` times the dot's size as it shows, down onto it as it closes.
      if (ring instanceof HTMLElement) ring.style.scale = String(ringScale(d.ring));
    });
  }

  /** Show SHOO! (the King's crows have landed on the ball's holder). */
  setShoo(show: boolean): void {
    this.shoo.hidden = !show;
  }

  /** Show THROW (on a pass play, while the QB has the ball). */
  setButtons(show: boolean): void {
    this.buttons.hidden = !show;
  }

  /** Show the Break it! panel (null hides it). */
  setBreak(view: BreakView | null): void {
    this.breaking = view !== null;
    this.juking = view?.kind === 'juke';
    this.meter.hidden = !view;
    if (!view) return;
    const clamp = (x: number): number => Math.max(0, Math.min(1, x));
    const pct = (x: number): string => `${clamp(x) * 100}%`;
    const isBar = view.kind === 'bar';
    this.bar.hidden = view.kind === 'juke';
    this.sweet.hidden = !isBar;
    this.near.hidden = !isBar;
    this.marker.hidden = !isBar;
    this.fill.hidden = view.kind !== 'mash';
    this.jukeButtons.hidden = view.kind !== 'juke';
    const call = { bar: 'BREAK IT!', mash: 'MASH!', juke: 'JUKE!' }[view.kind];
    if (view.ready !== null) {
      // The countdown: what's coming, and how long until it does.
      this.title.textContent = `GET READY TO ${call}`;
      this.hint.textContent = `${Math.max(1, Math.ceil(view.ready))}…`;
    } else {
      this.title.textContent = call;
    }
    switch (view.kind) {
      case 'bar': {
        if (view.ready === null) this.hint.textContent = 'TAP IN THE GREEN!';
        // A span along the trip, as [left, width] on the bar (mirrored when it runs right to left).
        const span = (from: number, to: number): [string, string] => {
          const [a, c] =
            view.dir === 1 ? [clamp(from), clamp(to)] : [clamp(1 - to), clamp(1 - from)];
          return [pct(a), pct(c - a)];
        };
        [this.sweet.style.left, this.sweet.style.width] = span(view.sweet.from, view.sweet.to);
        [this.near.style.left, this.near.style.width] = span(
          view.sweet.from - view.near,
          view.sweet.to + view.near,
        );
        this.marker.style.left = pct(view.dir === 1 ? view.marker : 1 - view.marker);
        break;
      }
      case 'mash':
        if (view.ready === null) this.hint.textContent = 'TAP TAP TAP!';
        this.fill.style.width = pct(view.fill);
        break;
      case 'juke': {
        // Both buttons through the countdown; then the one to press lights up, its colour
        // saying what a press gets now: green GREAT, orange OK, red BAD (it's too late).
        const lit = (side: -1 | 1): string =>
          view.side === side ? ` go ${view.grade ?? 'great'}` : view.side !== null ? ' dim' : '';
        this.jukeLeft.className = `arc-juke-btn arc-juke-left${lit(-1)}`;
        this.jukeRight.className = `arc-juke-btn arc-juke-right${lit(1)}`;
        if (view.ready === null) {
          this.hint.textContent =
            view.grade === 'bad' ? 'TOO LATE!' : view.side === -1 ? 'LEFT!' : 'RIGHT!';
        }
        break;
      }
    }
  }
}
