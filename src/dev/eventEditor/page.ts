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
import { eventPracticeQuery } from '../../arcade/content/eventLink';
import { checkSavedEvents, eventProblem, layerEvents } from '../../arcade/content/savedEvents';
import savedFile from '../../arcade/content/saved-events.json' with { type: 'json' };
import { LINEUP } from '../../arcade/content/team';
import { TIME_SCALE } from '../../arcade/content/tuning';
import type { BossName } from '../../arcade/sim/types';
import { now } from '../../clock';
import { httpSaver, saveStatus, type SaveServer } from '../bench/save';
import { fieldBase, fieldSvg, yardsAt, type Yards } from '../fieldSvg';
import { el, required, statusLine } from '../pageKit';
import {
  areaReadout,
  handlesOf,
  moveArea,
  newEvent,
  rectAcross,
  savedWith,
  savedWithout,
  setAcross,
  setBuildUp,
  setGoesOff,
  setLasts,
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
const driveFor = (e: FieldEvent): number => (e.boss === 'misterFrog' ? 4 : 2);
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
  parts: HTMLElement;
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
    parts: el('div', { className: 'controls' }),
  };
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
    e.parts,
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
  drawField(e.field, ev.area);
  e.readout.textContent = areaReadout(ev.area);
  e.parts.replaceChildren(...partsOf(e));
}

/** Where the area is drawn: a box (a lane or band) or a circle, "either" on the right. */
function drawField(f: SVGSVGElement, area: EventArea): void {
  const parts = fieldBase({ reach: false });
  for (const spot of LINEUP) {
    parts.push(`<circle class="f-spot" cx="${spot.x}" cy="${-spot.y}" r="0.55"/>`);
  }
  if (area.shape === 'circle') {
    const sign = area.across === 'left' ? -1 : area.across === 'middle' ? 0 : 1;
    parts.push(
      `<circle class="f-area" data-area="1" cx="${sign * area.out}" cy="${-area.at}" r="${area.radius}"/>`,
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

/** A slider in seconds on screen; the change is kept when the finger lifts (one step for Undo). */
function seconds(
  label: string,
  sim: number,
  range: { min: number; max: number },
  set: (screen: number) => void,
): HTMLElement {
  const value = el('span', { className: 'value' });
  const input = el('input');
  input.type = 'range';
  input.min = String(range.min);
  input.max = String(range.max);
  // Fine enough to show and keep Frog Rain's 0.875 s.
  input.step = '0.025';
  input.value = String(sim / TIME_SCALE);
  input.setAttribute('aria-label', label);
  const show = (): void => {
    value.textContent = `${Number(input.value).toFixed(3).replace(/0$/, '')} s`;
  };
  show();
  input.addEventListener('input', show);
  input.addEventListener('change', () => set(Number(input.value)));
  return el(
    'div',
    { className: 'part' },
    el('span', { className: 'label' }, `${label} `, value),
    input,
  );
}

function partsOf(e: Editing): HTMLElement[] {
  const ev = e.ed.event;
  const now = events().find((x) => x.id === ev.id);
  const unsaved = !now || JSON.stringify(now) !== JSON.stringify(ev);
  const status = saveStatus({ server, error: saveError }, { page: 'events.html', what: 'events' });
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
    seconds('Goes off after the snap', ev.goesOff, { min: 0.25, max: 5 }, (s) =>
      change(setGoesOff(e.ed, s)),
    ),
    chips(
      'Kind',
      [
        { value: 'burst', text: 'Burst' },
        { value: 'spell', text: 'Spell', off: 'Comes with the taffy flood' },
      ],
      'burst',
      () => undefined,
    ),
    seconds('Its effect lasts', ev.lasts, { min: 0.2, max: 4 }, (s) => change(setLasts(e.ed, s))),
    seconds('Build-up before it goes off', ev.warning.buildUp, { min: 0, max: 3 }, (s) =>
      change(setBuildUp(e.ed, s)),
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
    tryRow(ev),
    el(
      'div',
      { className: 'controls' },
      el('button', {
        className: 'btn plain',
        text: 'Undo',
        onClick: () => change(undo(e.ed)),
      }),
      saveButton(ev, unsaved),
      ...(isDefault(ev.id) && saved[ev.id]
        ? [
            el('button', {
              className: 'btn plain',
              text: 'Restore defaults',
              onClick: () => void restore(ev.id),
            }),
          ]
        : []),
    ),
    el('p', { className: `note${status.bad ? ' bad' : ''}`, text: status.text }),
  ];
}

/** Try it, at a drive (its defense) with or without two-tap throwing. */
function tryRow(ev: FieldEvent): HTMLElement {
  const drive = tryDrives.get(ev.id) ?? driveFor(ev);
  const value = el('span', { className: 'value', text: String(drive) });
  const input = el('input');
  input.type = 'range';
  input.min = '1';
  input.max = '12';
  input.step = '1';
  input.value = String(drive);
  input.setAttribute('aria-label', 'Try at drive');
  input.addEventListener('input', () => {
    value.textContent = input.value;
    tryDrives.set(ev.id, Number(input.value));
  });
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
    { className: 'part' },
    el('span', { className: 'label' }, 'Try at drive ', value),
    input,
    el(
      'div',
      { className: 'chips' },
      el('button', { className: 'btn go', text: 'Try it', onClick: () => tryIt(ev) }),
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

async function restore(id: string): Promise<void> {
  const ok = await attempt(() => write(savedWithout(saved, id)));
  const back = fieldEventDefaults.find((d) => d.id === id);
  if (ok && back && editing) {
    say(`${back.name} is back to its default.`);
    change(startEditing(back));
  } else draw();
}

// ── Start ─────────────────────────────────────────────────────────────────────

// Back from Try it (or a link): the event in the hash, as it was tried if that's still here.
const fromHash = location.hash.slice(1);
const known = events().find((e) => e.id === fromHash);
const draft = fromHash ? draftOf(fromHash) : null;
if (draft) open(draft);
else if (known) open(known);
else showList();
