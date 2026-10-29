/**
 * A play written as text, for the play editor (docs/PLAY_EDITOR.md): in a
 * link, so Try it can hand a play to practice. The link is compact JSON
 * (`i` id, `n` name, `s` slots, each "b" to block or a list of [x, y]
 * waypoints, `h` the handoff slot), and anything read back from one is
 * checked, since a link can be edited by hand.
 */
import type { Assignment, Play } from './plays';
import { runsRoutes, takesHandoff } from './playRules';
import { ROSTER_ROLES, SLOT_NAMES } from './team';

type SlotCode = 'b' | (readonly [number, number])[];

interface LinkCode {
  readonly i: string;
  readonly n: string;
  readonly s: readonly SlotCode[];
  readonly h?: number;
}

/** A play as the text of a link parameter. */
export function playToLink(play: Play): string {
  const code: LinkCode = {
    i: play.id,
    n: play.name,
    s: play.slots.map((a) => (a.kind === 'block' ? 'b' : a.to.map((w) => [w.x, w.y] as const))),
    ...(play.handoff === undefined ? {} : { h: play.handoff }),
  };
  return JSON.stringify(code);
}

export type FromLink =
  { readonly ok: true; readonly play: Play } | { readonly ok: false; readonly reason: string };

const unreadable: FromLink = { ok: false, reason: "The play in this link can't be read." };
const refuse = (why: string): FromLink => ({ ok: false, reason: `The play in this link ${why}` });

/** The play in a link parameter, or why there isn't one. */
export function playFromLink(text: string): FromLink {
  let code: unknown;
  try {
    code = JSON.parse(text);
  } catch {
    return unreadable;
  }
  if (typeof code !== 'object' || code === null || Array.isArray(code)) return unreadable;
  const { i, n, s, h } = code as Record<string, unknown>;
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
      if (
        !Array.isArray(w) ||
        w.length !== 2 ||
        !w.every((c) => typeof c === 'number' && Number.isFinite(c))
      ) {
        return refuse(`has a waypoint for ${name} that isn't a pair of numbers.`);
      }
      to.push({ x: w[0] as number, y: w[1] as number });
    }
    slots.push({ kind: 'route', to });
  }
  if (h === undefined) return { ok: true, play: { id: i, name: n, slots } };
  if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h >= slots.length)
    return unreadable;
  if (!takesHandoff(h)) {
    return refuse(`hands off to ${SLOT_NAMES[h] ?? h}; only a Runner can take a handoff.`);
  }
  return { ok: true, play: { id: i, name: n, slots, handoff: h } };
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
    '  },',
    '',
  ].join('\n');
}
