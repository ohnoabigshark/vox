/**
 * The event editor's page (dev/events.html; docs/FIELD_EVENTS.md). It draws
 * the state editor.ts keeps and passes taps in; the rules of editing live
 * there, tested, and not here.
 *
 * Two views: the list of events, and the editor for one. The open event's id
 * is the page's hash, so Back from Try it returns to it.
 */
import {
  eventKind,
  fieldEventDefaults,
  type EventArea,
  type FieldEvent,
  type Who,
} from '../../arcade/content/fieldEvents';
import { DRIVES, eventPracticeQuery } from '../../arcade/content/eventLink';
import { bossDrive } from '../../arcade/sim/run';
import { checkSavedEvents, eventProblem, layerEvents } from '../../arcade/content/savedEvents';
import savedFile from '../../arcade/content/saved-events.json' with { type: 'json' };
import { LINEUP } from '../../arcade/content/team';
import type { BossName } from '../../arcade/sim/types';
import { now } from '../../clock';
import { fractionOf } from '../bench/row';
import { httpSaver, saveStatus, type SaveServer } from '../bench/save';
import { slider, type Shown } from '../bench/slider';
import { fieldBase, fieldSvg, yardsAt, type Yards } from '../fieldSvg';
import { el, required, statusLine } from '../pageKit';
import {
  areaReadout,
  circleAcross,
  dragNumber,
  eventNumbers,
  eventTimeline,
  numberText,
  timelineText,
  type EventTimeline,
  replaceEvent,
  startingValues,
  setNumber,
  type NumberKey,
  type SliderDrag,
  handlesOf,
  moveArea,
  newEvent,
  rectAcross,
  savedWith,
  sameEvent,
  savedWithout,
  setAcross,
  setCall,
  setName,
  setOn,
  setShape,
  sizeArea,
  startEditing,
  undo,
  type EditorState,
  type Handle,
  type SavedEvents,
} from './editor';
import { EVENTS_SAVE_PATH } from './endpoints';

const app = required('events.html', '#app');
const { say, attempt } = statusLine(required('events.html', '#status'));

// ── What's saved ──────────────────────────────────────────────────────────────

const loaded = checkSavedEvents(savedFile);
/** saved-events.json as this page last saved it (or as the game loaded it). */
let saved: SavedEvents = Object.fromEntries(loaded.events.map((e) => [e.id, e]));
const events = (): FieldEvent[] => layerEvents(fieldEventDefaults, Object.values(saved));
const isDefault = (id: string): boolean => fieldEventDefaults.some((d) => d.id === id);

const saver = httpSaver<SavedEvents>(`${import.meta.env.BASE_URL}${EVENTS_SAVE_PATH}`);
let server: SaveServer = { kind: 'checking' };
let saveError: string | null = null;
void saver.probe().then((s) => {
  server = s;
  draw();
});

const BOSS_NAMES: Readonly<Record<BossName, string>> = {
  misterFrog: "Mister Frog's",
  queen: "the Queen's",
  king: "the King's",
};
const whose = (e: FieldEvent): string => (e.boss ? BOSS_NAMES[e.boss] : 'generic');

/** An event's state on the list: as the code has it, saved off that, or one you made. */
function stateOf(e: FieldEvent): string {
  if (!isDefault(e.id)) return 'yours';
  return saved[e.id] ? 'saved' : 'default';
}

// ── Try it ────────────────────────────────────────────────────────────────────

// Kept in the browser, each a convenience that falls back if it can't be read
// (a private window): Two-tap, and the event tried last (its unsaved changes,
// so ‹ Events comes back to what was tried, x2).
const TRY_KEY = 'getJackBack.eventEditor.twoTap';
const DRAFT_KEY = 'getJackBack.eventEditor.draft';

function loadTwoTap(): boolean {
  try {
    return localStorage.getItem(TRY_KEY) !== 'false';
  } catch {
    return true;
  }
}
let twoTap = loadTwoTap();

/** The drive Try it plays at: the Boss's own drive for a Boss's event, else the second. */
const driveFor = (e: FieldEvent): number => (e.boss ? bossDrive(e.boss) : 2);
const tryDrives = new Map<string, number>();

function tryIt(event: FieldEvent): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(event));
  } catch {
    say(
      "This browser isn't keeping the draft: unsaved changes won't be here when you come back.",
      true,
    );
  }
  const drive = tryDrives.get(event.id) ?? driveFor(event);
  location.href = `${new URL('../', location.href).href}?${eventPracticeQuery(event, drive, twoTap)}`;
}

/** The event tried last, if it's this one and can still be read. */
function draftOf(id: string): FieldEvent | null {
  try {
    const draft: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null');
    return eventProblem(id, draft) === null ? (draft as FieldEvent) : null;
  } catch {
    return null;
  }
}

// ── The list ──────────────────────────────────────────────────────────────────

let confirming: string | null = null;

function showList(): void {
  history.replaceState(null, '', location.pathname + location.search);
  editing = null;
  const rows = el('div', { className: 'rows' });
  for (const e of events()) {
    if (confirming === e.id) {
      rows.append(
        el(
          'div',
          { className: 'confirm' },
          el('span', { text: `Delete ${e.name}? This can't be undone.` }),
          el('button', { className: 'small', text: 'Delete', onClick: () => void remove(e) }),
          el('button', {
            className: 'small',
            text: 'Keep',
            onClick: () => {
              confirming = null;
              showList();
            },
          }),
        ),
      );
      continue;
    }
    rows.append(
      el(
        'div',
        { className: 'row' },
        el(
          'button',
          { className: 'open', onClick: () => open(e) },
          e.name,
          el('span', { className: 'sub', text: `${whose(e)} · ${eventKind(e)} · ${stateOf(e)}` }),
        ),
        ...(isDefault(e.id)
          ? []
          : [
              el('button', {
                className: 'del',
                text: '✕',
                onClick: () => {
                  confirming = e.id;
                  showList();
                },
              }),
            ]),
      ),
    );
  }
  const back = el('a', { text: '← dev' });
  back.href = './';
  app.className = 'list';
  app.replaceChildren(
    el('header', { className: 'bar' }, back, el('h1', { text: 'Events' })),
    ...loaded.warnings.map((w) => el('p', { className: 'note bad', text: w })),
    el('h2', { className: 'head', text: 'Field events' }),
    rows,
    el(
      'div',
      { className: 'rows' },
      el('button', {
        className: 'btn go',
        text: 'New event',
        onClick: () =>
          open(
            newEvent(
              'New event',
              events().map((e) => e.id),
            ),
          ),
      }),
    ),
  );
}

async function remove(e: FieldEvent): Promise<void> {
  const ok = await attempt(() => write(savedWithout(saved, e.id)));
  confirming = null;
  if (ok) say(`Deleted ${e.name}.`);
  showList();
}

/** Save the whole file; on success it's what's saved. */
async function write(next: SavedEvents): Promise<void> {
  try {
    const r = await saver.save(next);
    saved = next;
    saveError = null;
    server = { kind: 'up', inServedGame: r.inServedGame, savedAt: now() };
  } catch (err) {
    saveError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

// ── The editor ────────────────────────────────────────────────────────────────

/** What a drag moves: the area, or one of its handles. */
type Dragged = { kind: 'area' } | { kind: 'handle'; handle: Handle };

interface Editing {
  ed: EditorState;
  drag: { from: EditorState; at: Yards; moved: boolean; what: Dragged } | null;
  field: SVGSVGElement;
  name: HTMLInputElement;
  kind: HTMLElement;
  readout: HTMLElement;
  /** The shape and side chips, above the sliders. */
  top: HTMLElement;
  /** The sliders and the timeline: kept between draws, so a drag keeps its grip. */
  numbers: HTMLElement;
  timeline: HTMLElement;
  sliders: Map<NumberKey, SliderRow>;
  sliderKeys: string;
  /** The slider being dragged, until its knob is let go. */
  sliding: SliderDrag | null;
  /** The rest, drawn again each change… */
  parts: HTMLElement;
  /** …Try it, kept (its drive slider keeps its grip)… */
  tryBox: HTMLElement;
  /** …and the buttons and the save status, drawn again. */
  actions: HTMLElement;
}

let editing: Editing | null = null;

function open(event: FieldEvent): void {
  history.replaceState(null, '', `#${event.id}`);
  const name = el('input');
  name.id = 'event-name';
  name.value = event.name;
  name.setAttribute('aria-label', 'Event name');
  const field = fieldSvg('The field: drag the area to move it, and its handles to size it');
  const e: Editing = {
    ed: startEditing(event),
    drag: null,
    field,
    name,
    kind: el('span', { className: 'kind' }),
    readout: el('div', { className: 'note-bar' }),
    top: el('div', { className: 'controls' }),
    numbers: el('div', { className: 'numbers' }),
    timeline: el('div', { className: 'timeline' }),
    sliders: new Map(),
    sliderKeys: '',
    sliding: null,
    parts: el('div', { className: 'controls' }),
    actions: el('div', { className: 'controls' }),
    // Try it plays the event as it is when tapped.
    tryBox: tryRow(event, () => e.ed.event),
  };
  e.timeline.setAttribute('role', 'img');
  editing = e;
  name.addEventListener('change', () =>
    change(setName(e.ed, name.value.trim() || e.ed.event.name)),
  );
  field.addEventListener('pointerdown', onDown);
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerup', onUp);
  field.addEventListener('pointercancel', onUp);
  app.className = 'event-editor';
  app.replaceChildren(
    el(
      'header',
      { className: 'bar' },
      el('button', { className: 'back', text: '‹ Events', onClick: showList }),
      name,
      e.kind,
    ),
    el('div', { className: 'field-box' }, field),
    e.readout,
    e.top,
    e.numbers,
    e.parts,
    e.tryBox,
    e.actions,
  );
  draw();
}

function change(next: EditorState): void {
  if (!editing) return;
  editing.ed = next;
  draw();
}

function draw(): void {
  const e = editing;
  if (!e) return;
  const ev = e.ed.event;
  e.kind.textContent = eventKind(ev);
  // The name follows Undo, Restore defaults and Revert to saved, unless it's being typed in (review b3).
  if (document.activeElement !== e.name) e.name.value = ev.name;
  drawField(e.field, ev.area);
  e.readout.textContent = areaReadout(ev.area);
  e.top.replaceChildren(...topOf(e));
  syncSliders(e);
  e.parts.replaceChildren(...partsOf(e));
  e.actions.replaceChildren(...actionsOf(e));
}

/** Where the area is drawn: a box (a lane or band) or a circle, "either" on the right. */
function drawField(f: SVGSVGElement, area: EventArea): void {
  const parts = fieldBase({ reach: false });
  for (const spot of LINEUP) {
    parts.push(`<circle class="f-spot" cx="${spot.x}" cy="${-spot.y}" r="0.55"/>`);
  }
  if (area.shape === 'circle') {
    parts.push(
      `<circle class="f-area" data-area="1" cx="${circleAcross(area)}" cy="${-area.at}" r="${area.radius}"/>`,
    );
  } else {
    const { x0, x1 } = rectAcross(area);
    parts.push(
      `<rect class="f-area" data-area="1" x="${x0}" y="${-area.to}" width="${x1 - x0}" height="${area.to - area.from}"/>`,
    );
  }
  for (const h of handlesOf(area)) {
    parts.push(
      `<g data-handle="${h.handle}"><circle class="f-hit" cx="${h.at.x}" cy="${-h.at.y}" r="1.3"/>` +
        `<circle class="f-handle" cx="${h.at.x}" cy="${-h.at.y}" r="0.55"/></g>`,
    );
  }
  f.innerHTML = parts.join('');
}

function onDown(ev: PointerEvent): void {
  const e = editing;
  if (!e) return;
  const target = ev.target as Element;
  const handle = target.closest('[data-handle]')?.getAttribute('data-handle') as Handle | null;
  const what: Dragged | null = handle
    ? { kind: 'handle', handle }
    : target.closest('[data-area]')
      ? { kind: 'area' }
      : null;
  if (!what) return;
  e.drag = { from: e.ed, at: yardsAt(e.field, ev), moved: false, what };
  e.field.setPointerCapture(ev.pointerId);
}

function onMove(ev: PointerEvent): void {
  const e = editing;
  const d = e?.drag;
  if (!e || !d) return;
  const at = yardsAt(e.field, ev);
  d.moved = true;
  e.ed =
    d.what.kind === 'handle'
      ? sizeArea(d.from, d.what.handle, at)
      : moveArea(d.from, { x: at.x - d.at.x, y: at.y - d.at.y });
  draw();
}

function onUp(): void {
  const e = editing;
  if (!e?.drag) return;
  // A touch that didn't move changes nothing, and isn't a step for Undo.
  if (!e.drag.moved) e.ed = e.drag.from;
  e.drag = null;
  draw();
}

// ── The parts under the field ─────────────────────────────────────────────────

function chips<T extends string>(
  label: string,
  options: readonly { value: T; text: string; off?: string }[],
  current: T,
  pick: (value: T) => void,
): HTMLElement {
  return el(
    'div',
    { className: 'part' },
    el('span', { className: 'label', text: label }),
    el(
      'div',
      { className: 'chips' },
      ...options.map((o) => {
        const b = el('button', {
          className: `chip${o.value === current ? ' on' : ''}`,
          text: o.text,
          onClick: () => pick(o.value),
        });
        // Greyed: the game can't play it yet (x1); it says which branch brings it.
        if (o.off) {
          b.disabled = true;
          b.title = o.off;
        }
        return b;
      }),
    ),
  );
}

// ── The sliders: the bench's own (round 4, e1, e2) ──────────────────────────

/** A slider row, and how to show it. */
interface SliderRow {
  readonly el: HTMLElement;
  show(view: Shown): void;
}

/** What ↺ and the tick on the track go back to: a built-in event's code, or yours as saved (or as it started, if never saved). */
function baselineOf(e: Editing): FieldEvent {
  const ev = e.ed.event;
  return fieldEventDefaults.find((d) => d.id === ev.id) ?? saved[ev.id] ?? startingValues(ev);
}

/** The event as the game has it now (its default, or as saved), or undefined for one never saved. */
const savedVersion = (id: string): FieldEvent | undefined => events().find((x) => x.id === id);

/** Two of a slider's numbers that read the same. */
const sameNumber = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/** The sliders for this event's numbers: built when the numbers change shape, otherwise shown again in place, so a drag keeps its grip. */
function syncSliders(e: Editing): void {
  const numbers = eventNumbers(e.ed.event);
  const keys = numbers.map((n) => n.key).join();
  if (keys !== e.sliderKeys) {
    e.sliderKeys = keys;
    e.sliders = new Map(
      numbers.map((n) => [
        n.key,
        slider(n.label, n.range, {
          onMove: (v) => slide(e, n.key, v),
          onLetGo: () => {
            e.sliding = null;
          },
          onReset: () => {
            const back = eventNumbers(baselineOf(e)).find((b) => b.key === n.key);
            if (back) change(setNumber(e.ed, n.key, back.value));
          },
        }),
      ]),
    );
    const times = numbers.filter((n) => n.unit === 's').map((n) => e.sliders.get(n.key)?.el);
    const places = numbers.filter((n) => n.unit === 'yd').map((n) => e.sliders.get(n.key)?.el);
    e.numbers.replaceChildren(
      ...times.filter((x) => x !== undefined),
      e.timeline,
      ...places.filter((x) => x !== undefined),
    );
  }
  const baseline = baselineOf(e);
  const base = eventNumbers(baseline);
  const builtIn = isDefault(e.ed.event.id);
  const kept = savedVersion(e.ed.event.id);
  const keptNumbers = kept ? eventNumbers(kept) : null;
  // A built-in event saved off its code says what's saved too, as the bench's rows do (review d1).
  const savedCopy = builtIn ? saved[e.ed.event.id] : undefined;
  const savedOff = savedCopy ? eventNumbers(savedCopy) : null;
  for (const n of numbers) {
    const b = base.find((x) => x.key === n.key);
    const k = keptNumbers?.find((x) => x.key === n.key);
    const s = savedOff?.find((x) => x.key === n.key);
    const word = builtIn ? 'default' : kept ? 'saved' : 'starts at';
    // The default may be another shape, with no such number: then ↺ has nothing to go back to (review b2).
    const note = b
      ? `${word} ${numberText(b)}${s && !sameNumber(s.value, b.value) ? ` · saved ${numberText(s)}` : ''}`
      : `${word}: a ${baseline.area.shape}`;
    e.sliders.get(n.key)?.show({
      value: n.value,
      shown: numberText(n),
      at: fractionOf(n.value, n.range),
      ...(b ? { tick: fractionOf(b.value, n.range) } : {}),
      note,
      atDefault: b === undefined || sameNumber(b.value, n.value),
      unsaved: k === undefined || !sameNumber(k.value, n.value),
    });
  }
  drawTimeline(e.timeline, eventTimeline(e.ed.event));
}

/** A slider moved: one drag of one slider is one step for Undo, as a drag of the area is (editor.ts, dragNumber). */
function slide(e: Editing, key: NumberKey, value: number): void {
  const { state, drag } = dragNumber(e.ed, e.sliding, key, value);
  e.sliding = drag;
  change(state);
}

/** The event's down as one line (e4): the outline from the snap, its warning, the moment it goes off, and how long its effect lasts. */
function drawTimeline(box: HTMLElement, t: EventTimeline): void {
  const span = Math.max(t.ends, 1);
  const pct = (s: number): string => `${(s / span) * 100}%`;
  box.innerHTML =
    `<span class="tl-seg faint" style="left:0;width:${pct(t.warning)}"></span>` +
    `<span class="tl-seg warn" style="left:${pct(t.warning)};width:${pct(t.goesOff - t.warning)}"></span>` +
    `<span class="tl-seg hit" style="left:${pct(t.goesOff)};width:${pct(t.ends - t.goesOff)}"></span>` +
    `<span class="tl-mark" style="left:${pct(t.goesOff)}"></span>`;
  const words = timelineText(t);
  box.setAttribute('aria-label', words.join(', '));
  box.title = words.join(', ');
  box.append(el('div', { className: 'tl-words' }, ...words.map((w) => el('span', { text: w }))));
}

/** The area's shape and side, as chips. */
function topOf(e: Editing): HTMLElement[] {
  const ev = e.ed.event;
  return [
    chips(
      'Area',
      [
        { value: 'lane', text: 'Lane' },
        { value: 'band', text: 'Band' },
        { value: 'circle', text: 'Circle' },
      ],
      ev.area.shape,
      (shape) => change(setShape(e.ed, shape)),
    ),
    chips(
      'Side',
      [
        { value: 'left', text: 'Left' },
        { value: 'middle', text: 'Middle' },
        { value: 'right', text: 'Right' },
        { value: 'either', text: 'Either side' },
      ],
      ev.area.across,
      (across) => change(setAcross(e.ed, across)),
    ),
  ];
}

/** How it goes off, its effect, who it hits, and its call. */
function partsOf(e: Editing): HTMLElement[] {
  const ev = e.ed.event;
  return [
    chips(
      'Goes off as',
      [
        { value: 'burst', text: 'Burst' },
        { value: 'spell', text: 'Spell', off: 'Comes with the taffy flood' },
      ],
      'burst',
      () => undefined,
    ),
    chips(
      'Effect',
      [
        { value: 'flatten', text: 'Flatten' },
        { value: 'slow', text: 'Slow', off: 'Comes with the taffy flood' },
        { value: 'ethereal', text: 'Ethereal', off: 'Comes with the wisps' },
      ],
      ev.effect.kind,
      () => undefined,
    ),
    chips<Who>(
      'On',
      [
        { value: 'everyone', text: 'Everyone' },
        { value: 'yours', text: 'Your players' },
        { value: 'theirs', text: 'Defenders' },
      ],
      ev.effect.on,
      (on) => change(setOn(e.ed, on)),
    ),
    callRow(e),
  ];
}

/** Undo, Save, Restore defaults (or Revert to saved), and how saving stands. */
function actionsOf(e: Editing): HTMLElement[] {
  const ev = e.ed.event;
  const current = savedVersion(ev.id);
  const unsaved = !current || !sameEvent(current, ev);
  const status = saveStatus({ server, error: saveError }, { page: 'events.html', what: 'events' });
  return [
    el(
      'div',
      { className: 'controls' },
      el('button', {
        className: 'btn plain',
        text: 'Undo',
        onClick: () => change(undo(e.ed)),
      }),
      saveButton(ev, unsaved),
      backButton(e),
    ),
    el('p', { className: `note${status.bad ? ' bad' : ''}`, text: status.text }),
  ];
}

/** The call when it tackles a carrier: a word box, kept when it's left. */
function callRow(e: Editing): HTMLElement {
  const input = el('input');
  input.id = 'event-call';
  input.value = e.ed.event.call ?? '';
  input.placeholder = 'Nothing';
  input.setAttribute('aria-label', 'Call when it tackles a carrier');
  input.addEventListener('change', () => change(setCall(e.ed, input.value)));
  return el(
    'div',
    { className: 'part' },
    el('span', { className: 'label', text: 'Call when it tackles a carrier' }),
    input,
  );
}

/**
 * Try it: the drive to try at, the bench's slider (↺ back to the event's own
 * drive), and the throwing. Built once per event, so the drive's drag keeps
 * its grip; Try it takes the event as it is when tapped.
 */
function tryRow(event: FieldEvent, now: () => FieldEvent): HTMLElement {
  const id = event.id;
  const range = { min: 1, max: DRIVES, step: 1 };
  const own = driveFor(event);
  const drive = slider('Try at drive', range, {
    onMove: (v) => {
      tryDrives.set(id, v);
      showDrive();
    },
    onReset: () => {
      tryDrives.delete(id);
      showDrive();
    },
  });
  const showDrive = (): void => {
    const v = tryDrives.get(id) ?? own;
    drive.show({
      value: v,
      shown: String(v),
      at: fractionOf(v, range),
      tick: fractionOf(own, range),
      note: event.boss ? `its Boss's drive is ${own}` : `default ${own}`,
      atDefault: v === own,
    });
  };
  showDrive();
  const tap = el('button', { className: `tog${twoTap ? ' on' : ''}`, text: 'Two-tap' });
  tap.addEventListener('click', () => {
    twoTap = !twoTap;
    tap.classList.toggle('on', twoTap);
    try {
      localStorage.setItem(TRY_KEY, String(twoTap));
    } catch {
      say("This browser isn't keeping settings; they'll reset next time.", true);
    }
  });
  return el(
    'div',
    { className: 'numbers' },
    drive.el,
    el(
      'div',
      { className: 'chips' },
      el('button', { className: 'btn go', text: 'Try it', onClick: () => tryIt(now()) }),
      tap,
    ),
  );
}

function saveButton(ev: FieldEvent, unsaved: boolean): HTMLElement {
  const b = el('button', {
    className: 'btn go',
    text: unsaved ? 'Save' : 'Saved',
    onClick: () =>
      void attempt(() => write(savedWith(saved, ev))).then((ok) => {
        if (ok) say(`Saved ${ev.name}.`);
        draw();
      }),
  });
  b.disabled = !unsaved;
  return b;
}

/**
 * Restore defaults (a built-in event: every setting back to the code's), or
 * Revert to saved (one of yours). As on the bench, it changes the editor;
 * Save makes it so (round 4, e3).
 */
function backButton(e: Editing): HTMLElement {
  const builtIn = isDefault(e.ed.event.id);
  const to = builtIn ? baselineOf(e) : saved[e.ed.event.id];
  const b = el('button', {
    className: 'btn plain',
    text: builtIn ? 'Restore defaults' : 'Revert to saved',
    onClick: () => {
      if (to) change(replaceEvent(e.ed, to));
    },
  });
  b.disabled = !to || sameEvent(to, e.ed.event);
  return b;
}

// ── Start ─────────────────────────────────────────────────────────────────────

// Back from Try it (or a link): the event in the hash, as it was tried if that's still here.
const fromHash = location.hash.slice(1);
const known = events().find((e) => e.id === fromHash);
const draft = fromHash ? draftOf(fromHash) : null;
if (draft) open(draft);
else if (known) open(known);
else showList();
