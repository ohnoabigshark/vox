import { readModes } from './arcade/content/modeFlags';
import { readPractice } from './arcade/content/playCode';
import { ArcadeGame } from './arcade/game';
import { now } from './clock';
import { browserStorage, inGamePlays, sketchStore } from './dev/playEditor/sketches';
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

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
// ?try=…&sketch=… is practice, from the play editor's Try it (dev/plays.html): that
// one play on the field, rep after rep, with ‹ Sketch back to the editor.
const practice = readPractice(location.search);
// Hard mode (endless zones) and two-tap throwing (aim, then distance) are on unless
// ?hard=0 or ?aim=1 turns them off (readModes).
const modes = readModes(params);
// ?monsters=1 starts with a monster team; ?area=2 or ?area=3 starts at that area.
// ?snag=1 turns on SNAG IT! (a contested catch's dot test) from the first drive, not drive 5.
// ?win=1 goes straight from PLAY to the win cutscene (with ?video=1, frame by frame for
// the sing-along video's capture, tools/video/render.ts); ?farmSong=2 plays the second
// Frederick's Farm song candidate (Spooky Cow) instead of Harvest Moon Hoedown.
const game = new ArcadeGame(canvas, ui, {
  seed,
  monsters: params.has('monsters'),
  area: Number(params.get('area')) || 1,
  win: params.has('win'),
  video: params.has('video'),
  ...modes,
  snagAlways: params.get('snag') === '1',
  tipAlways: params.get('tip') === '1',
  farmSong: Number(params.get('farmSong')) || 1,
  ...(practice ? { practice } : {}),
  // The play editor's sketches in the game join the plays dealt, read at every PLAY and
  // AGAIN. If they can't be read the game stays quiet: the editor's list says why (n4).
  sketchesInGame: async () =>
    inGamePlays((await sketchStore(browserStorage(), now).list()).sketches),
});

// Dev builds expose the game for debugging from the console.
if (import.meta.env.DEV) Object.assign(window, { game });
