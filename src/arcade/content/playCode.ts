/**
 * A play written as text, for the play editor (docs/PLAY_EDITOR.md): in a
 * link, so Try it can hand a play to practice. The link is compact JSON
 * (`i` id, `n` name, `s` slots, each "b" to block or a list of [x, y]
 * waypoints, `h` the handoff slot, `l` the line-up as [x, y] spots), and anything read back from one is
 * checked, since a link can be edited by hand.
 */
import type { Assignment, Play } from './plays';
import { runsRoutes, takesHandoff } from './playRules';
import { LINEUP, ROSTER_ROLES, SLOT_NAMES, isStandardSpot } from './team';

type SlotCode = 'b' | (readonly [number, number])[];

interface LinkCode {
  readonly i: string;
  readonly n: string;
  readonly s: readonly SlotCode[];
  readonly h?: number;
  readonly l?: readonly (readonly [number, number])[];
}

/** A play as the text of a link parameter. */
export function playToLink(play: Play): string {
  const code: LinkCode = {
    i: play.id,
    n: play.name,
    s: play.slots.map((a) => (a.kind === 'block' ? 'b' : a.to.map((w) => [w.x, w.y] as const))),
    ...(play.handoff === undefined ? {} : { h: play.handoff }),
    ...(play.lineup === undefined ? {} : { l: play.lineup.map((p) => [p.x, p.y] as const) }),
  };
  return JSON.stringify(code);
}

export type FromLink =
  { readonly ok: true; readonly play: Play } | { readonly ok: false; readonly reason: string };

const unreadable: FromLink = { ok: false, reason: "The play in this link can't be read." };
const refuse = (why: string): FromLink => ({ ok: false, reason: `The play in this link ${why}` });

/** A waypoint or a spot in a link: [x, y], both finite numbers. */
const isPair = (w: unknown): w is [number, number] =>
  Array.isArray(w) && w.length === 2 && w.every((c) => typeof c === 'number' && Number.isFinite(c));

/** The play in a link parameter, or why there isn't one. */
export function playFromLink(text: string): FromLink {
  let code: unknown;
  try {
    code = JSON.parse(text);
  } catch {
    return unreadable;
  }
  if (typeof code !== 'object' || code === null || Array.isArray(code)) return unreadable;
  const { i, n, s, h, l } = code as Record<string, unknown>;
  if (typeof i !== 'string' || typeof n !== 'string' || !Array.isArray(s)) return unreadable;
  if (s.length !== ROSTER_ROLES.length) {
    return refuse(`has ${s.length} slots; a play has ${ROSTER_ROLES.length}.`);
  }
  const slots: Assignment[] = [];
  for (const [slot, a] of s.entries()) {
    const name = SLOT_NAMES[slot] ?? `slot ${slot}`;
    if (a === 'b') {
      slots.push({ kind: 'block' });
      continue;
    }
    if (!Array.isArray(a)) return unreadable;
    if (!runsRoutes(slot)) return refuse(`gives ${name} a route; Blockers always block.`);
    const to: { x: number; y: number }[] = [];
    for (const w of a as unknown[]) {
      if (!isPair(w)) return refuse(`has a waypoint for ${name} that isn't a pair of numbers.`);
      to.push({ x: w[0], y: w[1] });
    }
    slots.push({ kind: 'route', to });
  }
  let lineup: { x: number; y: number }[] | undefined;
  if (l !== undefined) {
    if (!Array.isArray(l) || l.length !== ROSTER_ROLES.length || !l.every(isPair)) {
      return refuse("has a line-up that isn't seven pairs of numbers.");
    }
    lineup = (l as [number, number][]).map(([x, y]) => ({ x, y }));
  }
  const play = { id: i, name: n, slots, ...(lineup ? { lineup } : {}) };
  if (h === undefined) return { ok: true, play };
  if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h >= slots.length)
    return unreadable;
  if (!takesHandoff(h)) {
    return refuse(`hands off to ${SLOT_NAMES[h] ?? h}; only a Runner can take a handoff.`);
  }
  return { ok: true, play: { ...play, handoff: h } };
}

/** A string as a single-quoted TypeScript literal. */
const quote = (text: string): string => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** What a practice link holds: its play (or why it can't be read), and which sketch it is. */
export interface Practice {
  readonly play: FromLink;
  /** The sketch's key in the editor, for ‹ Sketch; null if the link has none. */
  readonly sketch: string | null;
}

/**
 * The query of a practice link (Try it, round 4 of the map): `try` the play,
 * `sketch` its key in the editor, and `aim=2` for two-tap throwing.
 */
export function practiceQuery(play: Play, sketch: string, twoTap: boolean): string {
  const params = new URLSearchParams({ try: playToLink(play), sketch });
  if (twoTap) params.set('aim', '2');
  return params.toString();
}

/** A page's query read as a practice link, or null if it has no play (an ordinary game). */
export function readPractice(search: string): Practice | null {
  const params = new URLSearchParams(search);
  const text = params.get('try');
  if (text === null) return null;
  return { play: playFromLink(text), sketch: params.get('sketch') };
}

/** Whether a play's line-up is the standard one, so Copy code can leave it out (map item l2). */
const isStandard = (lineup: readonly { x: number; y: number }[]): boolean =>
  lineup.length === LINEUP.length && lineup.every((spot, slot) => isStandardSpot(slot, spot));

/**
 * A play as an entry for the list in `ourPlays.ts`, written the way
 * `plays.ts` writes them (Copy code, map items e2 and e16).
 */
export function playToSource(play: Play): string {
  const slot = (a: Assignment): string =>
    a.kind === 'block' ? 'block' : `route(${a.to.map((w) => `[${w.x}, ${w.y}]`).join(', ')})`;
  return [
    '  {',
    `    id: ${quote(play.id)},`,
    `    name: ${quote(play.name)},`,
    '    slots: [',
    ...play.slots.map((a) => `      ${slot(a)},`),
    '    ],',
    ...(play.handoff === undefined ? [] : [`    handoff: ${play.handoff},`]),
    ...(play.lineup === undefined || isStandard(play.lineup)
      ? []
      : ['    lineup: [', ...play.lineup.map((p) => `      { x: ${p.x}, y: ${p.y} },`), '    ],']),
    '  },',
    '',
  ].join('\n');
}
