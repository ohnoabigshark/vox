/**
 * The DOM HUD over the canvas (TECHNICAL.md §6): the drive banner and down
 * and distance at the top; the hand of play cards, Flip and the context button
 * (PLAY, HIKE!, RESUME, AGAIN) at the bottom; message pops and the big
 * GREAT/OK/BAD; and the TRICK OR TREAT! overlay (the offer and the roster).
 * The game's own buttons (THROW, Break it!) are in arcade/ui/controls.ts.
 *
 * The bottom bar keeps one height whether or not cards are showing, so the
 * layout doesn't jump between downs.
 */
import './hud.css';

export interface HudHandlers {
  /** The context button: PLAY, HIKE, resume, new run. */
  onAction(): void;
  /** Tap a card in the hand: call that play. */
  onCard(hand: number): void;
  onFlip(): void;
  /** TRICK OR TREAT!: take an offer; Done once the lineup is set. */
  onDraft(offer: number): void;
  onSkip(): void;
  /** TRICK OR TREAT!: tap a roster spot (to place a recruit there, or to swap two). */
  /** A tap on a roster spot (RosterRow.spot). */
  onRoster?(spot: number): void;
  /** Practice: ‹ Sketch, back to the play editor. */
  onBack?(): void;
}

/** One of your players on the roster panel. */
/** One stat as a bar: its value (50 is ordinary), whether the slot leans on it, and a change to preview. */
export interface StatBar {
  /** "Heft". */
  readonly label: string;
  readonly value: number;
  /** The stat this position leans on (Heft for a Blocker, Hustle for a Runner, Hands for a Catcher). */
  readonly key?: boolean;
  /** What it would change by (placing a recruit here), when non-zero. */
  readonly delta?: number;
}

export interface RosterRow {
  /** Its spot, handed back when it's tapped (the game's own numbering). */
  readonly spot: number;
  /** The position it's playing, e.g. "Runner": field rows are grouped under it, in order. */
  readonly position: string;
  /** Highlighted (picked for a swap). */
  readonly selected?: boolean;
  readonly name: string;
  /** Its form, e.g. "Werewolf". */
  readonly form: string;
  /** Its portrait: trusted SVG markup, drawn in the photo box. */
  readonly icon: string;
  readonly stats: readonly StatBar[];
  /** A short note, e.g. "prefers Catcher", or "". */
  readonly note: string;
  /** Its position is the one the player in question prefers: starred on the position's heading. */
  readonly fits?: boolean;
}

/** A player as a card: the photo, name and kind, stat bars (with any gains), a note. */
export interface PlayerCard {
  readonly name: string;
  readonly form: string;
  readonly icon: string;
  readonly stats: readonly StatBar[];
  readonly note: string;
}

/** One card of TRICK OR TREAT!'s offer: a big title over a player card. */
export interface OfferCard {
  /** "New Player!". */
  readonly title: string;
  readonly player: PlayerCard;
}

/** What TRICK OR TREAT! shows: the offer, your roster and bench, and what to do. */
export interface DraftView {
  /** The heading over the offer… */
  readonly title: string;
  /** …and a plain line under it saying what to do, or null. */
  readonly lead: string | null;
  readonly offer: readonly OfferCard[];
  /** The players on the field, in lineup order… */
  readonly roster: readonly RosterRow[];
  /** …and the bench, newest first. */
  readonly bench: readonly RosterRow[];
  /** What to do now, under the roster heading. */
  readonly hand: string | null;
  /** The button that moves on (e.g. "Done"); none while there's a choice to make. */
  readonly skip?: string;
  /** Whether tapping players swaps them (setting the lineup); otherwise the team is only shown. */
  readonly swappable: boolean;
}

/** What a card face shows. */
export interface CardFace {
  readonly name: string;
  readonly blurb: string;
}

export class Hud {
  private readonly top: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly downs: HTMLElement;
  private readonly message: HTMLElement;
  private readonly bottom: HTMLElement;
  private readonly hand: HTMLElement;
  private readonly flipButton: HTMLButtonElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly popEl: HTMLElement;
  private readonly noticeEl: HTMLButtonElement;
  private readonly backButton: HTMLButtonElement;
  private readonly draft: HTMLElement;
  private popTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly bigEl: HTMLElement;
  private bigTimer: ReturnType<typeof setTimeout> | undefined;
  private handKey = '';
  private draftKey = '';

  constructor(
    root: HTMLElement,
    private readonly handlers: HudHandlers,
  ) {
    root.innerHTML = `
      <div class="hud-top">
        <button class="hud-back interactive" hidden>‹ Sketch</button>
        <div class="hud-banner"></div>
        <div class="hud-downs"></div>
      </div>
      <div class="hud-message"></div>
      <div class="hud-pop"></div>
      <div class="hud-big"></div>
      <div class="hud-bottom">
        <div class="hud-hand"></div>
        <div class="hud-controls">
          <button class="hud-flip interactive">⇄ Flip</button>
          <button class="hud-action interactive"></button>
        </div>
      </div>
      <div class="hud-draft interactive" hidden></div>
      <button class="hud-notice interactive" hidden></button>`;
    const q = <T extends HTMLElement>(sel: string): T => {
      const el = root.querySelector<T>(sel);
      if (!el) throw new Error(`HUD is missing ${sel}`);
      return el;
    };
    this.top = q('.hud-top');
    this.banner = q('.hud-banner');
    this.downs = q('.hud-downs');
    this.message = q('.hud-message');
    this.bottom = q('.hud-bottom');
    this.hand = q('.hud-hand');
    this.flipButton = q<HTMLButtonElement>('.hud-flip');
    this.actionButton = q<HTMLButtonElement>('.hud-action');
    this.popEl = q('.hud-pop');
    this.noticeEl = q<HTMLButtonElement>('.hud-notice');
    this.noticeEl.addEventListener('click', () => this.notice(null));
    this.backButton = q<HTMLButtonElement>('.hud-back');
    this.backButton.addEventListener('click', () => handlers.onBack?.());
    this.bigEl = q('.hud-big');
    this.draft = q('.hud-draft');

    this.actionButton.addEventListener('click', () => handlers.onAction());
    this.flipButton.addEventListener('click', () => handlers.onFlip());
  }

  /** Space the HUD takes at the top and bottom, so the camera can fit the field between. */
  /** The drive banner ("Drive 2 of 4 · Challenge") and down and distance ("3rd & 4"). */
  setTop(banner: string, downs: string | null): void {
    this.banner.textContent = banner;
    this.banner.hidden = !banner;
    this.downs.textContent = downs ?? '';
    this.downs.hidden = !downs;
  }

  /** A note across the top that stays until it's tapped, such as a link the game couldn't use. Null hides it. */
  notice(text: string | null): void {
    this.noticeEl.textContent = text ?? '';
    this.noticeEl.hidden = text === null;
  }

  /** Practice: what the back button says (‹ Sketch, or ‹ Events for the event editor's Try it). */
  setBackLabel(text: string): void {
    this.backButton.textContent = text;
  }

  /**
   * Practice: the back button, shown between reps. Hidden mid-play, it keeps
   * its place, so down and distance doesn't jump across the top.
   */
  setBack(show: boolean): void {
    this.backButton.hidden = false;
    this.backButton.classList.toggle('held', !show);
  }

  /** The big centre message and the context button. Null hides them. */
  setPrompt(message: string | null, action: string | null): void {
    this.message.textContent = message ?? '';
    this.message.classList.toggle('show', !!message);
    this.actionButton.textContent = action ?? '';
    this.actionButton.hidden = !action;
  }

  /** The hand of play cards (null hides it), which one is called (Flip shows once one is). */
  setHand(
    cards: readonly CardFace[] | null,
    called: number | null,
    /** Flip is on (shown once a card is called). */
    flipped = false,
    /** The card the Queen's Royal Decree bans this down (stamped with her seal), or null. */
    banned: number | null = null,
  ): void {
    this.flipButton.hidden = !cards || called === null;
    this.flipButton.classList.toggle('on', flipped);
    const key = cards ? `${cards.map((c) => c.name + c.blurb).join('|')}#${called}#${banned}` : '';
    if (key === this.handKey) return;
    this.handKey = key;
    this.hand.classList.toggle('show', !!cards);
    this.hand.replaceChildren(
      ...(cards ?? []).map((c, i) => {
        const b = cardButton(
          c,
          `hud-card interactive${i === called ? ' called' : ''}${i === banned ? ' banned' : ''}`,
          () => this.handlers.onCard(i),
        );
        if (i === banned) {
          const seal = document.createElement('em');
          seal.className = 'hud-seal';
          seal.textContent = 'BANNED';
          b.append(seal);
        }
        return b;
      }),
    );
  }

  /**
   * The draft after a won drive: the offers to take (or skip), and the
   * roster panel with your players' numbers and your team's hand. Null hides it.
   */
  setDraft(draft: DraftView | null): void {
    this.draft.hidden = !draft;
    const key = draft ? JSON.stringify(draft) : '';
    if (key === this.draftKey) return;
    this.draftKey = key;
    if (!draft) return;
    const heading = (text: string): HTMLElement => {
      const h = document.createElement('h2');
      h.textContent = text;
      return h;
    };
    const offer = document.createElement('div');
    offer.className = 'hud-draft-row';
    offer.append(...draft.offer.map((c, i) => offerButton(c, () => this.handlers.onDraft(i))));
    const onRoster = this.handlers.onRoster;
    const tap = (row: RosterRow) =>
      onRoster && draft.swappable ? () => onRoster(row.spot) : undefined;
    // Left: the field, one group per position in lineup order. Right: the bench.
    const field = document.createElement('div');
    field.className = 'hud-roster-col';
    let group: HTMLElement | null = null;
    let groupName = '';
    for (const row of draft.roster) {
      if (!group || row.position !== groupName) {
        groupName = row.position;
        group = document.createElement('section');
        group.className = 'hud-roster-group';
        const label = document.createElement('h3');
        label.textContent = `${row.position}s`;
        if (row.fits) {
          const star = document.createElement('span');
          star.className = 'hud-fits';
          star.textContent = ' ★';
          label.append(star);
        }
        group.append(label);
        field.append(group);
      }
      group.append(rosterRow(row, tap(row)));
    }
    const bench = document.createElement('div');
    bench.className = 'hud-roster-col hud-bench';
    const benchGroup = document.createElement('section');
    benchGroup.className = 'hud-roster-group';
    const benchLabel = document.createElement('h3');
    benchLabel.textContent = 'Bench';
    benchGroup.append(
      benchLabel,
      ...(draft.bench.length > 0
        ? draft.bench.map((row) => rosterRow(row, tap(row)))
        : [emptyBench()]),
    );
    bench.append(benchGroup);
    const roster = document.createElement('div');
    roster.className = 'hud-roster';
    roster.append(field, bench);
    const hand = document.createElement('p');
    hand.className = 'hud-roster-hand';
    hand.textContent = draft.hand ?? '';
    const skip = document.createElement('button');
    skip.className = 'hud-skip';
    skip.textContent = draft.skip ?? '';
    skip.hidden = !draft.skip;
    skip.addEventListener('click', () => this.handlers.onSkip());
    const top: HTMLElement[] = draft.offer.length > 0 ? [offer] : [];
    const lead: HTMLElement[] = [];
    if (draft.lead) {
      const p = document.createElement('p');
      p.className = 'hud-draft-lead';
      p.textContent = draft.lead;
      lead.push(p);
    }
    this.draft.replaceChildren(
      heading(draft.title),
      ...lead,
      ...top,
      skip,
      heading('Your team'),
      hand,
      roster,
    );
  }

  /** A big word in the middle of the screen, for a moment: how a Break it! went. */
  big(text: string, tone: 'good' | 'ok' | 'bad'): void {
    this.bigEl.textContent = text;
    this.bigEl.className = `hud-big show ${tone}`;
    clearTimeout(this.bigTimer);
    this.bigTimer = setTimeout(() => (this.bigEl.className = 'hud-big'), 1000);
  }

  /** A short pop above the controls: a catch rating, a block, a tackle. */
  pop(text: string, tone: 'good' | 'bad'): void {
    this.popEl.textContent = text;
    this.popEl.className = `hud-pop show ${tone}`;
    clearTimeout(this.popTimer);
    this.popTimer = setTimeout(() => (this.popEl.className = 'hud-pop'), 900);
  }
}

function cardButton(face: CardFace, className: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = className;
  const name = document.createElement('strong');
  name.textContent = face.name;
  const blurb = document.createElement('span');
  blurb.textContent = face.blurb;
  b.append(name, blurb);
  b.addEventListener('click', onClick);
  return b;
}

function rosterRow(row: RosterRow, onTap?: () => void): HTMLElement {
  const el = document.createElement(onTap ? 'button' : 'div');
  el.className = `hud-roster-row${onTap ? ' interactive' : ''}${row.selected ? ' selected' : ''}`;
  if (onTap) el.addEventListener('click', onTap);
  el.append(header(row.name, row.form, row.icon), statBars(row.stats));
  if (row.note) {
    const note = document.createElement('em');
    note.textContent = row.note;
    el.append(note);
  }
  return el;
}

/** The bench before anyone sits on it. */
function emptyBench(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hud-roster-row empty';
  el.textContent = 'Nobody yet';
  return el;
}

/** An offer card: its big title, then the player card; tap to take it. */
function offerButton(card: OfferCard, onTap: () => void): HTMLElement {
  const el = document.createElement('button');
  el.className = 'hud-offer interactive';
  el.addEventListener('click', onTap);
  const title = document.createElement('strong');
  title.className = 'hud-offer-title';
  title.textContent = card.title;
  const p = card.player;
  el.append(title, header(p.name, p.form, p.icon), statBars(p.stats));
  if (p.note) {
    const note = document.createElement('em');
    note.textContent = p.note;
    el.append(note);
  }
  return el;
}

/** The photo box, then the name with its kind under it. */
function header(name: string, form: string, icon: string): HTMLElement {
  const head = document.createElement('div');
  head.className = 'hud-player-head';
  const photo = document.createElement('span');
  photo.className = 'hud-photo';
  photo.innerHTML = icon;
  const text = document.createElement('span');
  text.className = 'hud-name';
  const n = document.createElement('strong');
  n.textContent = name;
  const kind = document.createElement('small');
  kind.textContent = form;
  text.append(n, kind);
  head.append(photo, text);
  return head;
}

/** The highest stat a bar shows full (50, ordinary, fills half). */
const BAR_MAX = 100;

function statBars(stats: readonly StatBar[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hud-stats';
  for (const s of stats) {
    const row = document.createElement('div');
    row.className = `hud-stat${s.key ? ' key' : ''}`;
    const label = document.createElement('span');
    label.className = 'hud-stat-label';
    label.textContent = s.label;
    const bar = document.createElement('span');
    bar.className = 'hud-stat-bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.max(0, Math.min(1, s.value / BAR_MAX)) * 100}%`;
    bar.append(fill);
    const value = document.createElement('span');
    value.className = 'hud-stat-value';
    value.textContent = String(s.value);
    row.append(label, bar, value);
    if (s.delta) {
      const delta = document.createElement('span');
      delta.className = `hud-stat-delta ${s.delta > 0 ? 'up' : 'down'}`;
      delta.textContent = `${s.delta > 0 ? '+' : '−'}${Math.abs(s.delta)}`;
      row.append(delta);
    }
    el.append(row);
  }
  return el;
}
