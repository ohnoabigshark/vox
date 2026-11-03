/**
 * Estimate a recorded track's tempo and where its beats fall (for timing the
 * sing-along video's dance): decodes it in headless Chrome, takes an onset
 * envelope (rises in loudness, 10 ms frames), and finds the tempo between 80
 * and 160 BPM whose beat grid lines up best with it, and that grid's phase.
 *   npx tsx tools/video/tempo.ts [media/weGotJackBack.mp3]
 */
import { createServer } from 'vite';
import { launchToolBrowser } from '../browser';

const ROOT = new URL('../..', import.meta.url).pathname;
const file = process.argv[2] ?? 'media/weGotJackBack.mp3';

export interface Tempo {
  readonly bpm: number;
  /** Seconds to the first beat. */
  readonly offset: number;
  readonly seconds: number;
}

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === 'object' && address ? address.port : 5173;
const browser = await launchToolBrowser([]);
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/dev/index.html`);
  const tempo = await page.evaluate(async (url): Promise<Tempo> => {
    const bytes = await (await fetch(url)).arrayBuffer();
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buf = await ctx.decodeAudioData(bytes);
    const rate = buf.sampleRate;
    const hop = Math.round(rate * 0.01);
    const chans = [...Array(buf.numberOfChannels).keys()].map((c) => buf.getChannelData(c));
    const frames = Math.floor(buf.length / hop);
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let e = 0;
      for (const ch of chans) for (let i = f * hop; i < (f + 1) * hop; i++) e += (ch[i] ?? 0) ** 2;
      energy[f] = Math.log(1e-9 + e);
    }
    const onset = new Float32Array(frames);
    for (let f = 1; f < frames; f++)
      onset[f] = Math.max(0, (energy[f] ?? 0) - (energy[f - 1] ?? 0));
    // Score every tempo (0.1 BPM steps) and phase by the onsets on its beats.
    let best = { bpm: 120, offset: 0, score: -Infinity };
    for (let bpm = 80; bpm <= 160; bpm += 0.1) {
      const period = 6000 / bpm; // frames per beat
      for (let ph = 0; ph < period; ph += 1) {
        let score = 0;
        for (let t = ph; t < frames; t += period) {
          const k = Math.round(t);
          score += Math.max(onset[k] ?? 0, onset[k - 1] ?? 0, onset[k + 1] ?? 0);
        }
        score /= frames / period;
        if (score > best.score) best = { bpm, offset: ph / 100, score };
      }
    }
    return { bpm: Math.round(best.bpm * 10) / 10, offset: best.offset, seconds: buf.duration };
  }, `/${file}`);
  console.log(JSON.stringify(tempo));
} finally {
  await browser.close();
  await server.close();
}
