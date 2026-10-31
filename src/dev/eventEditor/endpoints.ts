/**
 * Where the hot-reload server takes the event editor's saves
 * (tools/eventsSave.ts), under the page's base URL. It imports nothing: the
 * plugin loads with Vite's config, and a file the config loads must not
 * reach the saved events (tools/savedFile.ts).
 */
export const EVENTS_SAVE_PATH = '__events-save';
