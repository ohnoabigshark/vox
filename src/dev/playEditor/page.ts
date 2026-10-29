/**
 * The play editor's page (dev/plays.html; docs/PLAY_EDITOR.md). It draws
 * the state that editor.ts and sketches.ts keep and passes taps in; the rules
 * of editing live there, tested, and not here.
 *
 * Two views: the sketches list, and the editor for one sketch. The open sketch's
 * key is the page's hash, so Back from Try it returns to it.
 */
import { playToLink, playToSource } from '../../arcade/content/playCode';
import { PLAY_POOL } from '../../arcade/content/playPool';
import { DEEPEST, playProblems, runsRoutes, takesHandoff } from '../../arcade/content/playRules';
import type { Assignment, Play } from '../../arcade/content/plays';
import { ROSTER_ROLES, SLOT_NAMES } from '../../arcade/content/team';
import { arcadeTuning } from '../../arcade/content/tuning';
import { sketchStore, idFromName, type Sketch, type SketchList } from './sketches';
import {
  addPoint,
  fieldView,
  movePoint,
  removePoint,
  select,
  selectPoint,
  setHandoff,
  setName,
  startEditing,
  toggleFlip,
  undo,
  type EditorState,
  type Yards,
} from './editor';

function required(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`plays.html is missing ${selector}`);
  return found;
}
const app = required('#app');
const statusEl = required('#status');

// The only place the page reads the time: when a sketch was saved, and "how long ago".
const now = (): number => Date.now();
/** The browser's localStorage, or, where even reaching it throws, a stand-in that always refuses. */
function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return localStorage;
  } catch {
    const refuse = (): never => {
      throw new Error('localStorage is unavailable');
    };
    return { getItem: refuse, setItem: refuse };
  }
}
const storage = browserStorage();
const store = sketchStore(storage, now);

// ── Status line ─────────────────────────────────────────────────────────────

let statusTimer = 0;
function say(text: string, bad = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('bad', bad);
  statusEl.hidden = false;
  window.clearTimeout(statusTimer);
  // A problem stays until tapped; good news goes by itself.
  if (!bad) statusTimer = window.setTimeout(() => (statusEl.hidden = true), 2600);
}
statusEl.addEventListener('click', () => (statusEl.hidden = true));

/** Run a store call; a failure is shown, never swallowed. */
async function attempt(work: () => Promise<void>): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (e) {
    say(e instanceof Error ? e.message : String(e), true);
    return false;
  }
}

// ── Try with: the game's settings for Try it ────────────────────────────────

// Kept synchronously, unlike sketches: a two-switch convenience for this one
// page, read once at load, where a failure only means the defaults come back.
const TRY_KEY = 'getJackBack.playEditor.tryWith';
const TRY_VERSION = 1;
interface TryWith {
  hard: boolean;
  twoTap: boolean;
}
function loadTryWith(): TryWith {
  // How the Coach plays: hard mode, two-tap throwing (vox CLAUDE.md).
  const fallback = { hard: true, twoTap: true };
  try {
    const saved = JSON.parse(storage.getItem(TRY_KEY) ?? 'null') as
      (Partial<TryWith> & { version?: unknown }) | null;
    if (saved?.version !== TRY_VERSION) return fallback;
    return {
      hard: typeof saved?.hard === 'boolean' ? saved.hard : fallback.hard,
      twoTap: typeof saved?.twoTap === 'boolean' ? saved.twoTap : fallback.twoTap,
    };
  } catch {
    return fallback;
  }
}
const tryWith = loadTryWith();
function saveTryWith(): void {
  try {
    storage.setItem(TRY_KEY, JSON.stringify({ version: TRY_VERSION, ...tryWith }));
  } catch {
    say("This browser isn't keeping settings; they'll reset next time.", true);
  }
}

// ── Small DOM helpers ───────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
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

function ago(edited: number): string {
  const minutes = Math.round((now() - edited) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function stateOf(play: Play): { text: string; bad: boolean } {
  const n = playProblems(play).length;
  return n === 0
    ? { text: 'ready to copy', bad: false }
    : { text: `${n} ${n === 1 ? 'problem' : 'problems'}`, bad: true };
}

// ── The sketches list ─────────────────────────────────────────────────────────

let confirming: string | null = null;

async function showList(): Promise<void> {
  history.replaceState(null, '', location.pathname + location.search);
  const list: SketchList = await store.list();
  const hard = el('button', { className: `tog${tryWith.hard ? ' on' : ''}`, text: 'Hard' });
  const twoTap = el('button', { className: `tog${tryWith.twoTap ? ' on' : ''}`, text: 'Two-tap' });
  hard.addEventListener('click', () => {
    tryWith.hard = !tryWith.hard;
    hard.classList.toggle('on', tryWith.hard);
    saveTryWith();
  });
  twoTap.addEventListener('click', () => {
    tryWith.twoTap = !tryWith.twoTap;
    twoTap.classList.toggle('on', tryWith.twoTap);
    saveTryWith();
  });

  const rows = el('div', { className: 'rows' });
  for (const d of list.sketches) rows.append(sketchRow(d));
  if (list.sketches.length === 0) {
    rows.append(el('p', { className: 'empty', text: 'No sketches yet. Start one below.' }));
  }

  const starts = el('div', { className: 'rows' });
  starts.append(startRow('Blank play', blankPlay()));
  for (const p of PLAY_POOL) starts.append(startRow(`Copy of ${p.name}`, copyOf(p)));

  app.className = 'list';
  const back = el('a', { text: '← dev' });
  back.href = './';
  app.replaceChildren(
    el('header', { className: 'bar' }, back, el('h1', { text: 'Plays' })),
    el('div', { className: 'try-with' }, 'Try with:', hard, twoTap),
    ...(list.problem ? [el('p', { className: 'note bad', text: list.problem })] : []),
    el('h2', { className: 'head', text: 'Your sketches · on this phone' }),
    rows,
    el('h2', { className: 'head', text: 'Start a play' }),
    starts,
  );
}

function sketchRow(d: Sketch): HTMLElement {
  if (confirming === d.key) {
    return el(
      'div',
      { className: 'confirm' },
      el('span', { text: `Delete ${d.play.name}? This can't be undone.` }),
      el('button', {
        className: 'small',
        text: 'Delete',
        onClick: () =>
          void attempt(() => store.remove(d.key)).then((ok) => {
            confirming = null;
            if (ok) say(`Deleted ${d.play.name}.`);
            return showList();
          }),
      }),
      el('button', {
        className: 'small',
        text: 'Keep',
        onClick: () => {
          confirming = null;
          void showList();
        },
      }),
    );
  }
  const st = stateOf(d.play);
  return el(
    'div',
    { className: 'row' },
    el(
      'button',
      { className: 'open', onClick: () => openSketch(d) },
      d.play.name || 'Untitled',
      el('span', {
        className: `sub${st.bad ? ' bad' : ''}`,
        text: `${st.text} · edited ${ago(d.edited)}`,
      }),
    ),
    el('button', {
      className: 'del',
      text: '✕',
      onClick: () => {
        confirming = d.key;
        void showList();
      },
    }),
  );
}

function startRow(label: string, play: Play): HTMLElement {
  return el(
    'div',
    { className: 'row' },
    el('button', {
      className: 'open',
      text: label,
      onClick: () => {
        const sketch: Sketch = { key: `d${now()}`, play, edited: now() };
        void attempt(() => store.save(sketch.key, play)).then((ok) => ok && openSketch(sketch));
      },
    }),
  );
}

const BLOCK: Assignment = { kind: 'block' };
function blankPlay(): Play {
  return {
    id: 'newPlay',
    name: 'New play',
    slots: ROSTER_ROLES.map((_, slot) => (runsRoutes(slot) ? { kind: 'route', to: [] } : BLOCK)),
  };
}

function copyOf(p: Play): Play {
  const name = `${p.name} 2`;
  return { ...p, id: idFromName(name), name };
}

// ── The editor ──────────────────────────────────────────────────────────────

const SVG = 'http://www.w3.org/2000/svg';
const HALF = arcadeTuning.field.halfWidth;
/** The field shown: a little past each sideline, from 6 yards behind the line to just past a throw's reach. */
const VIEW = { left: -HALF - 0.7, right: HALF + 0.7, back: -6.6, deep: DEEPEST + 1.4 };

interface Editing {
  key: string;
  ed: EditorState;
  /** A waypoint being dragged: the state where the drag began, and whether it has moved. */
  drag: { from: EditorState; index: number; at: Yards; moved: boolean } | null;
  parts: {
    name: HTMLInputElement;
    flip: HTMLButtonElement;
    field: SVGSVGElement;
    note: HTMLElement;
    chips: HTMLElement;
    controls: HTMLElement;
    actions: HTMLElement;
    code: HTMLTextAreaElement;
  };
}

let editing: Editing | null = null;

function openSketch(d: Sketch): void {
  history.replaceState(null, '', `#${d.key}`);
  const name = el('input');
  name.id = 'play-name';
  name.value = d.play.name;
  name.setAttribute('aria-label', 'Play name');
  const flip = el('button', { className: 'tog', text: 'Flip' });
  const field = document.createElementNS(SVG, 'svg');
  field.classList.add('field');
  field.setAttribute(
    'viewBox',
    `${VIEW.left} ${-VIEW.deep} ${VIEW.right - VIEW.left} ${VIEW.deep - VIEW.back}`,
  );
  field.setAttribute('role', 'img');
  field.setAttribute('aria-label', 'The field: tap a player, then tap to add waypoints');
  const code = el('textarea', { className: 'code' });
  code.readOnly = true;
  code.hidden = true;
  const parts = {
    name,
    flip,
    field,
    note: el('div', { className: 'note-bar' }),
    chips: el('div', { className: 'chips' }),
    controls: el('div', { className: 'controls' }),
    actions: el('div', { className: 'controls' }),
    code,
  };
  const e: Editing = { key: d.key, ed: startEditing(d.play), drag: null, parts };
  editing = e;

  name.addEventListener('input', () => change(setName(e.ed, name.value)));
  flip.addEventListener('click', () => {
    e.ed = toggleFlip(e.ed);
    draw();
  });
  field.addEventListener('pointerdown', onDown);
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerup', onUp);
  field.addEventListener('pointercancel', onUp);

  app.className = '';
  app.replaceChildren(
    el(
      'header',
      { className: 'bar' },
      el('button', { className: 'back', text: '‹ Sketches', onClick: () => void showList() }),
      name,
      flip,
    ),
    el('div', { className: 'field-box' }, field),
    parts.note,
    parts.chips,
    parts.controls,
    parts.actions,
    code,
  );
  draw();
}

/** A change to the play: draw it and keep it. */
function change(next: EditorState): void {
  const e = editing;
  if (!e) return;
  const changed = next.play !== e.ed.play;
  e.ed = next;
  draw();
  if (changed) void attempt(() => store.save(e.key, next.play));
}

/** A tap's place on the field, in yards from the line of scrimmage. */
function yardsAt(field: SVGSVGElement, ev: PointerEvent): Yards {
  const m = field.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: -p.y };
}

function onDown(ev: PointerEvent): void {
  const e = editing;
  if (!e) return;
  const at = yardsAt(e.parts.field, ev);
  const target = ev.target as Element;
  const point = target.closest('[data-point]')?.getAttribute('data-point');
  const slot = target.closest('[data-slot]')?.getAttribute('data-slot');
  if (point != null && !e.ed.flipped) {
    const index = Number(point);
    e.drag = { from: selectPoint(e.ed, index), index, at, moved: false };
    e.ed = e.drag.from;
    e.parts.field.setPointerCapture(ev.pointerId);
    draw();
  } else if (slot != null) {
    const s = Number(slot);
    if (!runsRoutes(s)) say('Blockers always block.');
    else if (e.ed.flipped) say('Turn Flip off to edit.');
    else change(select(e.ed, s));
  } else if (e.ed.flipped) {
    say('Turn Flip off to edit.');
  } else if (e.ed.selected === null) {
    say('Pick a player first: tap it, or its chip.');
  } else {
    change(addPoint(e.ed, at));
  }
}

function onMove(ev: PointerEvent): void {
  const e = editing;
  if (!e?.drag) return;
  const at = yardsAt(e.parts.field, ev);
  if (!e.drag.moved && Math.hypot(at.x - e.drag.at.x, at.y - e.drag.at.y) < 0.3) return;
  e.drag.moved = true;
  e.ed = movePoint(e.drag.from, e.drag.index, at);
  draw();
}

function onUp(): void {
  const e = editing;
  if (!e?.drag) return;
  const moved = e.drag.moved;
  e.drag = null;
  // A drag is kept once, when it ends; a tap on a waypoint only picks it.
  if (moved) void attempt(() => store.save(e.key, e.ed.play));
  draw();
}

function draw(): void {
  const e = editing;
  if (!e) return;
  const { ed, parts } = e;
  const dragging = e.drag?.moved ?? false;
  const problems = playProblems(ed.play);
  parts.flip.classList.toggle('on', ed.flipped);
  drawField(parts.field, ed);

  // What's wrong, or what to do next.
  const first = problems[0];
  parts.note.className = `note-bar${dragging ? '' : ed.flipped ? '' : first ? ' bad' : ' ok'}`;
  parts.note.textContent = dragging
    ? dragReadout(ed)
    : ed.flipped
      ? 'Flipped: the play as the game runs it mirrored. Turn Flip off to edit.'
      : first
        ? `${first.message}${problems.length > 1 ? ` +${problems.length - 1} more` : ''}`
        : ed.selected === null
          ? 'Ready to copy. Tap a player to change its route.'
          : 'Ready to copy.';

  // One chip per slot.
  const broken = new Set(problems.map((p) => p.slot));
  parts.chips.replaceChildren(
    ...SLOT_NAMES.map((name, slot) => {
      const b = el('button', {
        className: `chip${slot === ed.selected ? ' on' : ''}${broken.has(slot) ? ' bad' : ''}`,
        text: name,
        onClick: () => change(select(ed, slot)),
      });
      b.disabled = !runsRoutes(slot) || ed.flipped;
      return b;
    }),
  );

  // Handoff, Remove, Undo.
  const handoffChip = (label: string, slot: number | null): HTMLButtonElement => {
    const b = el('button', {
      className: `chip${(ed.play.handoff ?? null) === slot ? ' on' : ''}`,
      text: label,
      onClick: () => change(setHandoff(ed, slot)),
    });
    b.disabled = ed.flipped;
    return b;
  };
  const remove = el('button', {
    className: 'small',
    text: 'Remove',
    onClick: () => change(removePoint(ed)),
  });
  remove.disabled = ed.point === null || ed.flipped;
  const undoButton = el('button', {
    className: 'small',
    text: 'Undo',
    onClick: () => change(undo(ed)),
  });
  undoButton.disabled = ed.history.length === 0 || ed.flipped;
  parts.controls.replaceChildren(
    el('span', { className: 'label', text: 'Handoff' }),
    handoffChip('None', null),
    ...SLOT_NAMES.flatMap((name, slot) => (takesHandoff(slot) ? [handoffChip(name, slot)] : [])),
    el('span', { className: 'spacer' }),
    remove,
    undoButton,
  );

  // Try it, Copy code.
  const copy = el('button', {
    className: 'btn plain',
    text: problems.length === 0 ? 'Copy code' : `Copy code · fix ${problems.length}`,
    onClick: () => void copyCode(),
  });
  copy.disabled = problems.length > 0;
  parts.actions.replaceChildren(
    el('button', { className: 'btn go', text: 'Try it', onClick: tryIt }),
    copy,
  );
}

function drawField(f: SVGSVGElement, ed: EditorState): void {
  const parts: string[] = [];
  const line = (y: number, cls: string): string =>
    `<line class="${cls}" x1="${-HALF}" x2="${HALF}" y1="${-y}" y2="${-y}"/>`;
  parts.push(
    `<rect class="f-out" x="${VIEW.left}" y="${-VIEW.deep}" width="${VIEW.right - VIEW.left}" height="${VIEW.deep - VIEW.back}"/>`,
    `<rect class="f-turf" x="${-HALF}" y="${-VIEW.deep}" width="${2 * HALF}" height="${VIEW.deep - VIEW.back}"/>`,
  );
  for (let y = -5; y < VIEW.deep; y += 5) if (y !== 0 && y !== 10) parts.push(line(y, 'f-yard'));
  parts.push(line(0, 'f-los'), line(10, 'f-first'), line(DEEPEST, 'f-reach'));
  const label = (y: number, text: string, cls = ''): string =>
    `<text class="f-text ${cls}" x="${-HALF + 0.12}" y="${-y - 0.3}">${text}</text>`;
  parts.push(
    label(0, 'LINE'),
    label(10, '+10', 'gold'),
    label(DEEPEST, `THROW REACH ${DEEPEST}`, 'bad'),
  );

  const view = fieldView(ed);
  const editSlot = ed.flipped ? null : ed.selected;
  // Routes under players; the picked one on top.
  const order = [...view].sort((a, b) => Number(a.slot === editSlot) - Number(b.slot === editSlot));
  for (const r of order) {
    if (r.kind === 'block' || r.path.length < 2) continue;
    const cls = `${r.kind === 'carry' ? ' carry' : ''}${r.broken ? ' bad' : ''}${r.slot === editSlot ? ' on' : ''}`;
    const pts = r.path.map((p) => `${p.x},${-p.y}`).join(' ');
    parts.push(`<polyline class="f-route${cls}" points="${pts}"/>`);
    const end = r.path.at(-1);
    if (end && r.slot !== editSlot)
      parts.push(`<circle class="f-end${cls}" cx="${end.x}" cy="${-end.y}" r="0.32"/>`);
  }
  // Players where they line up.
  for (const r of view) {
    const start = r.path[0];
    if (!start) continue;
    const role = ROSTER_ROLES[r.slot];
    const on = r.slot === editSlot ? ' on' : '';
    const bad = r.broken ? ' bad' : '';
    const shape =
      role === 'blocker'
        ? `<rect class="f-player f-blocker" x="${start.x - 0.6}" y="${-start.y - 0.6}" width="1.2" height="1.2"/>`
        : `<circle class="f-player f-${role}${on}${bad}" cx="${start.x}" cy="${-start.y}" r="0.72"/>`;
    parts.push(
      `<g data-slot="${r.slot}">${shape}<circle class="f-hit" cx="${start.x}" cy="${-start.y}" r="1.3"/>` +
        `<text class="f-name" x="${start.x}" y="${-start.y + 0.25}" text-anchor="middle">${SLOT_NAMES[r.slot] ?? ''}</text></g>`,
    );
  }
  // The picked route's waypoints, big enough for a thumb.
  const picked = view.find((r) => r.slot === editSlot);
  picked?.path.slice(1).forEach((p, i) => {
    const on = i === ed.point ? ' on' : '';
    parts.push(
      `<g data-point="${i}"><circle class="f-hit" cx="${p.x}" cy="${-p.y}" r="1.4"/>` +
        `<circle class="f-point${on}" cx="${p.x}" cy="${-p.y}" r="0.75"/></g>`,
    );
  });
  f.innerHTML = parts.join('');
}

function tryIt(): void {
  const e = editing;
  if (!e) return;
  const params = new URLSearchParams({ try: playToLink(e.ed.play) });
  if (tryWith.hard) params.set('hard', '1');
  if (tryWith.twoTap) params.set('aim', '2');
  const go = (): void => {
    location.href = `${new URL('../', location.href).href}?${params}`;
  };
  if (tryUnsaved) return go();
  store.save(e.key, e.ed.play).then(go, (err: unknown) => {
    // Going would lose the problem from view, and Back wouldn't find the sketch as it is.
    tryUnsaved = true;
    const why = err instanceof Error ? err.message : String(err);
    say(`${why} This sketch isn't saved. Tap Try it again to go anyway.`, true);
  });
}

/** Try it couldn't save the sketch and said so: the next tap goes without saving. */
let tryUnsaved = false;

/** While a waypoint is dragged: where it is, in yards from where its player lines up. */
function dragReadout(ed: EditorState): string {
  const slot = ed.selected;
  const a = slot === null ? undefined : ed.play.slots[slot];
  const w = a?.kind === 'route' && ed.point !== null ? a.to[ed.point] : undefined;
  if (slot === null || ed.point === null || !w) return '';
  const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
  return `${SLOT_NAMES[slot] ?? ''}, point ${ed.point + 1}: ${signed(w.x)} across, ${signed(w.y)} upfield from where it lines up`;
}

async function copyCode(): Promise<void> {
  const e = editing;
  if (!e) return;
  const source = playToSource({ ...e.ed.play, id: idFromName(e.ed.play.name) });
  try {
    await navigator.clipboard.writeText(source);
    e.parts.code.hidden = true;
    say('Copied. Paste it to Claude to keep the play.');
  } catch {
    // Clipboard refused: show the code to copy by hand.
    e.parts.code.value = source;
    e.parts.code.hidden = false;
    e.parts.code.select();
    say("Couldn't copy by itself: the code is selected below, copy it from there.", true);
  }
}

// ── Start ───────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  const key = location.hash.slice(1);
  if (key) {
    const { sketches } = await store.list();
    const d = sketches.find((x) => x.key === key);
    if (d) return openSketch(d);
  }
  await showList();
}
void start();
