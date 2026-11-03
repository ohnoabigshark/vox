/**
 * The stats screens (docs/STATS.md, v1–v5), drawn from what statsView.ts
 * says they show: the card at Game Over or a win, a run's stats (Players,
 * Team, Plays), and the stats section (All time and Runs, Hard or Normal).
 * It only draws; what's tapped goes back through the callbacks.
 */
import type { Achievement } from '../arcade/record/achievements';
import type { KeptStats } from '../arcade/record/keeper';
import type { Saved } from '../arcade/record/store';
import type { Mode } from '../arcade/record/types';
import {
  achievementsView,
  allTimeView,
  runsView,
  runView,
  summaryView,
  type CardView,
  type Row,
  type RunView,
  type Section,
} from '../arcade/ui/statsView';
import { playDrawing } from './playDrawing';
import './stats.css';

/** How long each achievement's pop stays (h2: about 3 s). */
const TOAST_MS = 3000;

export interface CardButton {
  readonly label: string;
  readonly main?: boolean;
  readonly onTap: () => void;
}

const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
};

function rowEl(r: Row): HTMLElement {
  const div = make('div', 'stats-row');
  const value = make('span', '', r.value);
  if (r.record) value.append(make('em', 'stats-new', 'RECORD'));
  div.append(make('span', '', r.label), value);
  return div;
}

function sectionEls(sections: readonly Section[]): HTMLElement[] {
  return sections.flatMap((s) =>
    s.rows.length === 0 ? [] : [make('h3', '', s.title), ...s.rows.map(rowEl)],
  );
}

/** A row that opens to show more under it when tapped, and closes again. */
function opening(head: HTMLElement[], more: () => Element[]): HTMLElement[] {
  const button = make('button', 'stats-item interactive');
  button.append(...head);
  const box = make('div', 'stats-more');
  box.hidden = true;
  button.addEventListener('click', () => {
    if (box.childElementCount === 0) box.append(...more());
    box.hidden = !box.hidden;
  });
  return [button, box];
}

/** Tabs over a body: tapping one shows its content. */
function tabbed(
  tabs: readonly { readonly name: string; readonly content: () => HTMLElement[] }[],
  open: string,
  className = 'stats-tabs',
): { readonly bar: HTMLElement; readonly body: HTMLElement } {
  const bar = make('div', className);
  const body = make('div', 'stats-body');
  const buttons = tabs.map((t) => {
    const b = make('button', 'interactive', t.name);
    b.addEventListener('click', () => show(t.name));
    return b;
  });
  const show = (name: string): void => {
    buttons.forEach((b, i) => b.classList.toggle('on', tabs[i]?.name === name));
    body.replaceChildren(...(tabs.find((t) => t.name === name)?.content() ?? []));
    body.scrollTop = 0;
  };
  bar.append(...buttons);
  show(open);
  return { bar, body };
}

export class StatsScreens {
  private readonly cardLayer: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly toastEl: HTMLElement;
  /** Achievements waiting to pop, the first showing (or held). */
  private readonly toasts: { readonly name: string; readonly earns: string }[] = [];
  /** A play is on: no pop shows until it's over (h2: never mid-play). */
  private held = false;
  private toastTimer: number | undefined;
  /** The panel under the one showing (a run opened from the stats section), to go back to. */
  private under: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.cardLayer = make('div', 'stats-card-layer interactive');
    this.cardLayer.hidden = true;
    this.panel = make('div', 'stats-panel interactive');
    this.panel.hidden = true;
    this.toastEl = make('div', 'stats-toast');
    this.toastEl.hidden = true;
    root.append(this.cardLayer, this.panel, this.toastEl);
  }

  /** The card at Game Over or a win (v1, v3), with its buttons below it. */
  card(view: CardView, buttons: readonly CardButton[]): void {
    const card = make('div', 'stats-card');
    const tiles = make('div', 'stats-tiles');
    for (const t of view.tiles) {
      const tile = make('div', 'stats-tile');
      // RECORD on a line of its own above the number, so the number stays centred (u1's note).
      if (t.record) tile.append(make('em', 'stats-new', 'RECORD'));
      tile.append(make('b', '', t.value), make('span', '', t.label));
      tiles.append(tile);
    }
    card.append(
      make('h2', '', view.title),
      make('p', 'stats-sub', view.sub),
      tiles,
      ...view.rows.map(rowEl),
      ...view.achievements.map((name) => make('div', 'stats-ach', `🏆 ${name}`)),
    );
    const row = make('div', 'stats-buttons');
    for (const b of buttons) {
      const button = make('button', `stats-button${b.main ? ' main' : ''} interactive`, b.label);
      button.addEventListener('click', b.onTap);
      row.append(button);
    }
    this.cardLayer.replaceChildren(card, row);
    this.cardLayer.hidden = false;
  }

  hideCard(): void {
    this.cardLayer.hidden = true;
    this.cardLayer.replaceChildren();
  }

  /** A run's stats (v2): Team, Players, Plays, Players open; a run kept only as its summary has Team alone. */
  run(view: RunView, onBack: () => void): void {
    const tabs = [
      { name: 'Team', content: () => sectionEls(view.team) },
      ...(view.players.length > 0 ? [{ name: 'Players', content: () => this.players(view) }] : []),
      ...(view.plays.length > 0 ? [{ name: 'Plays', content: () => this.plays(view) }] : []),
    ];
    const { bar, body } = tabbed(tabs, view.players.length > 0 ? 'Players' : 'Team');
    this.showPanel(view.heading, onBack, bar, body);
  }

  /** The stats section (v5): All time and Runs, Hard first. */
  section(kept: KeptStats, onBack: () => void): void {
    let mode: Mode = 'hard';
    // The tab open, kept when Hard / Normal (or ‹ Back from a run) draws the section again.
    let open = 'All time';
    const draw = (): void => {
      const modes = make('div', 'stats-tabs small');
      for (const m of ['hard', 'normal'] as const) {
        const b = make(
          'button',
          `interactive${m === mode ? ' on' : ''}`,
          m === 'hard' ? 'Hard' : 'Normal',
        );
        b.addEventListener('click', () => {
          mode = m;
          draw();
        });
        modes.append(b);
      }
      const shown = (name: string, content: () => HTMLElement[]) => () => {
        open = name;
        // Hard / Normal is for All time and Runs; achievements are one list (h1).
        modes.hidden = name === 'Achievements';
        return content();
      };
      const { bar, body } = tabbed(
        [
          { name: 'All time', content: shown('All time', () => this.allTime(kept, mode)) },
          { name: 'Runs', content: shown('Runs', () => this.runs(kept, mode, draw, onBack)) },
          { name: 'Achievements', content: shown('Achievements', () => this.achievements(kept)) },
        ],
        open,
      );
      this.showPanel('Stats', onBack, bar, modes, body);
    };
    draw();
  }

  /** An achievement just earned (h2): a pop at the top for about 3 s, one after another, never in the way of a tap. */
  toast(a: Achievement, hard: boolean): void {
    this.toasts.push({ name: `${a.name}${hard ? ' · hard' : ''}`, earns: a.earns });
    if (this.toasts.length === 1 && !this.held) this.nextToast();
  }

  /**
   * Holds the pops while a play is on, and lets them go after it: one cut
   * short by the snap shows again, whole, in the pause after the down.
   */
  holdToasts(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    if (held) {
      window.clearTimeout(this.toastTimer);
      this.toastEl.hidden = true;
    } else this.nextToast();
  }

  private nextToast(): void {
    const next = this.toasts[0];
    if (!next || this.held) {
      this.toastEl.hidden = true;
      return;
    }
    this.toastEl.replaceChildren(make('b', '', `🏆 ${next.name}`), make('small', '', next.earns));
    this.toastEl.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      this.toasts.shift();
      this.nextToast();
    }, TOAST_MS);
  }

  /** Closes the panel showing, and forgets what was under it. */
  closePanel(): void {
    this.under = null;
    this.panel.hidden = true;
    this.panel.replaceChildren();
  }

  private showPanel(title: string, onBack: () => void, ...content: HTMLElement[]): void {
    const top = make('div', 'stats-bar');
    const back = make('button', 'stats-back interactive', '‹ Back');
    back.addEventListener('click', () => {
      const under = this.under;
      this.under = null;
      if (under) under();
      else {
        this.closePanel();
        onBack();
      }
    });
    top.append(back, make('h2', '', title));
    this.panel.replaceChildren(top, ...content);
    this.panel.hidden = false;
  }

  private players(view: RunView): HTMLElement[] {
    return view.players.flatMap((p) => {
      const name = make('b', '', p.name);
      if (p.kind) name.append(' ', make('i', '', p.kind));
      return opening([name, make('small', '', p.line)], () => p.details.map(rowEl));
    });
  }

  private plays(view: RunView): HTMLElement[] {
    const mark = { 'most used': ' ●', 'most successful': ' ★', both: ' ★●' } as const;
    return [
      ...view.plays.flatMap((p) =>
        opening(
          [make('b', '', p.name), make('small', '', `${p.line}${p.mark ? mark[p.mark] : ''}`)],
          () => (p.play ? [playDrawing(p.play)] : []),
        ),
      ),
      make('p', 'stats-key', '★ most successful · ● most used'),
    ];
  }

  /** What's kept, or why there's nothing to show yet. */
  private saved(kept: KeptStats): Saved | HTMLElement[] {
    if (kept.kind === 'loading') return [make('p', 'stats-empty', 'Your stats are loading…')];
    if (kept.kind === 'unreadable')
      return [make('p', 'stats-empty', "Your stats can't be read on this phone.")];
    return kept.saved;
  }

  private achievements(kept: KeptStats): HTMLElement[] {
    const saved = this.saved(kept);
    if (Array.isArray(saved)) return saved;
    const view = achievementsView(saved.achievements);
    const item = (name: string, small: string): HTMLElement => {
      const div = make('div', 'stats-item');
      div.append(make('b', '', name), make('small', '', small));
      return div;
    };
    return [
      make('p', 'stats-key', view.count),
      ...view.earned.map((a) => item(`✓ ${a.name}`, `${a.earns} · ${a.when}`)),
      ...(view.rest.length > 0 ? [make('h3', '', 'Still to earn')] : []),
      ...view.rest.map((a) => item(a.name, a.earns)),
    ];
  }

  private allTime(kept: KeptStats, mode: Mode): HTMLElement[] {
    const saved = this.saved(kept);
    if (Array.isArray(saved)) return saved;
    const view = allTimeView(saved.allTime[mode]);
    if (view.empty) return [make('p', 'stats-empty', 'No runs yet. Play one!')];
    return sectionEls(view.sections);
  }

  private runs(kept: KeptStats, mode: Mode, back: () => void, onBack: () => void): HTMLElement[] {
    const saved = this.saved(kept);
    if (Array.isArray(saved)) return saved;
    const rows = runsView(saved, mode);
    if (rows.length === 0) return [make('p', 'stats-empty', 'No runs yet. Play one!')];
    return rows.map((r) => {
      const button = make('button', 'stats-item interactive');
      button.append(make('b', '', `${r.date} · ${r.where}`), make('small', '', r.line));
      button.addEventListener('click', () => {
        const kept = saved.runs.find((x) => x.summary.id === r.id);
        if (!kept) return;
        this.run(kept.record ? runView(kept.record) : summaryView(kept.summary), onBack);
        this.under = back;
      });
      return button;
    });
  }
}
