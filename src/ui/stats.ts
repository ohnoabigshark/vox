/**
 * The stats screens (docs/STATS.md, v1–v5), drawn from what statsView.ts
 * says they show: the card at Game Over or a win, a run's stats (Players,
 * Team, Plays), and the stats section (All time and Runs, Hard or Normal).
 * It only draws; what's tapped goes back through the callbacks.
 */
import type { Saved } from '../arcade/record/store';
import {
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

export interface CardButton {
  readonly label: string;
  readonly main?: boolean;
  readonly onTap: () => void;
}

type Mode = 'hard' | 'normal';

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
  /** The panel under the one showing (a run opened from the stats section), to go back to. */
  private under: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.cardLayer = make('div', 'stats-card-layer interactive');
    this.cardLayer.hidden = true;
    this.panel = make('div', 'stats-panel interactive');
    this.panel.hidden = true;
    root.append(this.cardLayer, this.panel);
  }

  /** The card at Game Over or a win (v1, v3), with its buttons below it. */
  card(view: CardView, buttons: readonly CardButton[]): void {
    const card = make('div', 'stats-card');
    const tiles = make('div', 'stats-tiles');
    for (const t of view.tiles) {
      const tile = make('div', 'stats-tile');
      const b = make('b', '', t.value);
      if (t.record) b.append(make('em', 'stats-new', 'RECORD'));
      tile.append(b, make('span', '', t.label));
      tiles.append(tile);
    }
    card.append(
      make('h2', '', view.title),
      make('p', 'stats-sub', view.sub),
      tiles,
      ...view.rows.map(rowEl),
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

  /** A run's stats (v2): Players first; a run kept only as its summary has Team alone. */
  run(view: RunView, onBack: () => void): void {
    const tabs = [
      ...(view.players.length > 0 ? [{ name: 'Players', content: () => this.players(view) }] : []),
      { name: 'Team', content: () => sectionEls(view.team) },
      ...(view.plays.length > 0 ? [{ name: 'Plays', content: () => this.plays(view) }] : []),
    ];
    const { bar, body } = tabbed(tabs, tabs[0]?.name ?? 'Team');
    this.showPanel(view.heading, onBack, bar, body);
  }

  /** The stats section (v5): All time and Runs, Hard first. */
  section(saved: Saved | null, onBack: () => void): void {
    let mode: Mode = 'hard';
    const draw = (): void => {
      const modes = tabbed(
        (['hard', 'normal'] as const).map((m) => ({
          name: m === 'hard' ? 'Hard' : 'Normal',
          content: () => {
            mode = m;
            return [];
          },
        })),
        mode === 'hard' ? 'Hard' : 'Normal',
        'stats-tabs small',
      );
      const { bar, body } = tabbed(
        [
          { name: 'All time', content: () => this.allTime(saved, mode) },
          { name: 'Runs', content: () => this.runs(saved, mode, draw, onBack) },
        ],
        'All time',
      );
      // Hard / Normal redraws the section in that mode.
      for (const b of modes.bar.querySelectorAll('button')) b.addEventListener('click', draw);
      this.showPanel('Stats', onBack, bar, modes.bar, body);
    };
    draw();
  }

  /** Closes the panel showing, back to what was under it. */
  closePanel(): void {
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
      const name = make('b', '', `${p.name} `);
      name.append(make('i', '', p.kind));
      return opening([name, make('small', '', p.line)], () => p.details.map(rowEl));
    });
  }

  private plays(view: RunView): HTMLElement[] {
    const mark = { 'most used': ' ●', 'most successful': ' ★', both: ' ★●' } as const;
    return [
      ...view.plays.flatMap((p) =>
        opening(
          [make('b', '', p.name), make('small', '', `${p.line}${p.mark ? mark[p.mark] : ''}`)],
          () => (p.play ? [playDrawing(p.play) as unknown as HTMLElement] : []),
        ),
      ),
      make('p', 'stats-key', '★ most successful · ● most used'),
    ];
  }

  private allTime(saved: Saved | null, mode: Mode): HTMLElement[] {
    if (!saved) return [make('p', 'stats-empty', "Your stats can't be read on this phone.")];
    const view = allTimeView(saved.allTime[mode]);
    if (view.empty) return [make('p', 'stats-empty', 'No runs yet. Play one!')];
    return sectionEls(view.sections);
  }

  private runs(
    saved: Saved | null,
    mode: Mode,
    back: () => void,
    onBack: () => void,
  ): HTMLElement[] {
    if (!saved) return [make('p', 'stats-empty', "Your stats can't be read on this phone.")];
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
