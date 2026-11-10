import { changedSwitches, readLink, runOptionsFor } from './arcade/content/runOptions';
import { setupNotices, setupQuery, setupStore } from './arcade/content/savedSetup';
import { readPractice } from './arcade/content/playCode';
import { isPracticeLink, readEventPractice } from './arcade/content/eventLink';
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

// ?try=…&sketch=… is practice, from the play editor's Try it (dev/plays.html): that
// one play on the field, rep after rep, with ‹ Sketch back to the editor.
const practice = readPractice(location.search);
// ?event=…&series=… is event practice, from the event editor's Try it (dev/events.html):
// that field event every rep at that series, with ‹ Events back to the editor.
const eventPractice = readEventPractice(location.search);
// The run options (docs/DEV_SETUP.md), switch by switch: what the link names (?hard=0,
// ?aim=1, ?snag=off… all in `readLink`), else the dev setup saved on this phone (the
// setup page, dev/setup.html), else the defaults file. Practice ignores the setup (d5).
// The link-only ?win=1, ?video=1 and ?farmSong=2 are the link's alone.
const link = readLink(new URLSearchParams(location.search));
const setups = setupStore(browserStorage());
const setup = await setups.read();
const inPractice = isPracticeLink(location.search);
const run = runOptionsFor(link.run, setup, inPractice);
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
  // The start screen's DEV SETUP tag; its Reset forgets the setup and starts again without it.
  devSetup: {
    changed: setup.kind === 'saved' ? changedSwitches(setup.setup).length : 0,
    query: setupQuery(setup, inPractice),
    // A setup that can't be read (the defaults are played) or values left out, said on screen.
    warnings: setupNotices(setup, inPractice),
    reset: async () => {
      await setups.clear();
      location.reload();
    },
  },
});

// Dev builds expose the game for debugging from the console.
if (import.meta.env.DEV) Object.assign(window, { game });
