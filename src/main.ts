import { readLink, runOptionsFrom } from './arcade/content/runOptions';
import { readPractice } from './arcade/content/playCode';
import { readEventPractice } from './arcade/content/eventLink';
import { ArcadeGame } from './arcade/game';
import { now } from './clock';
import { browserStorage, inGamePlays, sketchStore } from './dev/playEditor/sketches';
import { statsStore } from './arcade/record/store';
import { applyPaletteVars } from './ui/paletteVars';

applyPaletteVars();

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('index.html is missing #game or #ui');

/** How long to wait for the font before starting anyway (a slow or failed load). */
const FONT_TIMEOUT_MS = 3000;

// Build the game only once Creepster is ready, so no text ever shows in a fallback font.
await Promise.race([
  document.fonts.load("1em 'Creepster'").catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
]);

// The run options: the defaults file with what the link names over it (docs/DEV_SETUP.md):
// ?hard=0, ?aim=1, ?area=N, ?seed=N, ?snag=1, ?tip=1, ?perks=1, ?monsters; and the
// link-only ?win=1, ?video=1 and ?farmSong=2 (all in `readLink`).
const link = readLink(new URLSearchParams(location.search));
const run = runOptionsFrom(link.run);
// ?try=…&sketch=… is practice, from the play editor's Try it (dev/plays.html): that
// one play on the field, rep after rep, with ‹ Sketch back to the editor.
const practice = readPractice(location.search);
// ?event=…&series=… is event practice, from the event editor's Try it (dev/events.html):
// that field event every rep at that series, with ‹ Events back to the editor.
const eventPractice = readEventPractice(location.search);
const game = new ArcadeGame(canvas, ui, {
  // A random seed unless the link names one.
  run: { ...run, seed: run.seed ?? Math.floor(Math.random() * 1e9) },
  win: link.win,
  video: link.video,
  farmSong: link.farmSong,
  ...(practice ? { practice } : {}),
  ...(eventPractice ? { eventPractice } : {}),
  // The play editor's sketches in the game join the plays dealt, read at every PLAY and
  // AGAIN. If they can't be read the game stays quiet: the editor's list says why (n4).
  sketchesInGame: async () =>
    inGamePlays((await sketchStore(browserStorage(), now).list()).sketches),
  // The run's record, kept on this phone (docs/STATS.md).
  stats: statsStore(browserStorage(), now),
});

// Dev builds expose the game for debugging from the console.
if (import.meta.env.DEV) Object.assign(window, { game });
