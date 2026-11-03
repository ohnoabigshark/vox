/**
 * The event editor's Try it link (docs/FIELD_EVENTS.md, f3, x2): the event
 * itself, so practice plays what's on the editor before Save, the series whose
 * defense it plays, and the throwing. Read back with the same check a saved
 * event gets.
 */
import type { FieldEvent } from './fieldEvents';
import { eventProblem } from './savedEvents';
import { arcadeTuning } from './tuning';

/** An event read from a link, or why it can't be played. */
export type EventFromLink =
  | { readonly ok: true; readonly event: FieldEvent }
  | { readonly ok: false; readonly reason: string };

export interface EventPractice {
  readonly event: EventFromLink;
  /** The series whose defense practice plays (1 to 12). */
  readonly series: number;
}

/** The series of a run (12: three areas of four), the most Try it can pick. */
export const MAX_SERIES = arcadeTuning.run.areas * 4;

/** The query of an event practice link: `event`, `series`, and `aim=2` or `aim=1` (both written, as two-tap is the default). */
export function eventPracticeQuery(event: FieldEvent, series: number, twoTap: boolean): string {
  const params = new URLSearchParams({ event: JSON.stringify(event), series: String(series) });
  params.set('aim', twoTap ? '2' : '1');
  return params.toString();
}

/** A page's query read as an event practice link, or null if it has no event. */
export function readEventPractice(search: string): EventPractice | null {
  const params = new URLSearchParams(search);
  const text = params.get('event');
  if (text === null) return null;
  // Links from before 2026-11-03's rename name the series `drive`.
  const n = Math.round(Number(params.get('series') ?? params.get('drive')));
  const series = Number.isFinite(n) ? Math.max(1, Math.min(MAX_SERIES, n)) : 1;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { event: { ok: false, reason: 'This event link is broken.' }, series };
  }
  const id = (parsed as { id?: unknown } | null)?.id;
  const why = eventProblem(typeof id === 'string' ? id : '', parsed);
  return {
    event: why
      ? { ok: false, reason: `This event link can’t be played: ${why}.` }
      : { ok: true, event: parsed as FieldEvent },
    series,
  };
}

/** ‹ Events: the event editor, with this event open (its id the page's hash). */
export function eventEditorLink(gameHref: string, id: string): string {
  const editor = new URL('dev/events.html', gameHref);
  editor.search = '';
  editor.hash = id;
  return editor.href;
}
