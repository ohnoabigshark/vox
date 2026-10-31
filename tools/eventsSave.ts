/**
 * The event editor's Save (docs/FIELD_EVENTS.md, k1): the saved events at
 * `…/__events-save` into src/arcade/content/saved-events.json, through the
 * shared saved file (tools/savedFile.ts).
 */
import type { Plugin } from 'vite';
import { EVENTS_SAVE_PATH } from '../src/dev/eventEditor/endpoints';
// savedEvents imports only types, so the config never reaches the saved file.
import { checkSavedEvents } from '../src/arcade/content/savedEvents';
import { savedFilePlugin, sortedKeys, type Checked } from './savedFile';

/** A save's events checked, by id in order. */
export function eventsCheck(saved: unknown): Checked {
  const { events, warnings } = checkSavedEvents(saved);
  return { value: sortedKeys(Object.fromEntries(events.map((e) => [e.id, e]))), warnings };
}

export function eventsSavePlugin(file: string): Plugin {
  return savedFilePlugin({
    name: 'events-save',
    path: EVENTS_SAVE_PATH,
    file,
    check: () => eventsCheck,
  });
}
