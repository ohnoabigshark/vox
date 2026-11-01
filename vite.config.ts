import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { benchLogPlugin } from './tools/benchLog';
import { benchSavePlugin } from './tools/benchSave';
import { eventsSavePlugin } from './tools/eventsSave';

// Where the dev and preview servers listen. Loopback unless DEV_BIND says
// otherwise: our droplet has a public address, so `--host`'s every-interface
// default would put the dev server on the internet. On a home machine,
// DEV_BIND=0.0.0.0 restores upstream's reach-it-from-your-phone setup.
const host = process.env.DEV_BIND || '127.0.0.1';

// Behind an https proxy (tailscale serve), the browser reaches the dev server
// by a name Vite can't see. DEV_HOST is that name: Vite accepts requests for
// it, and hot reload dials it over wss on DEV_HMR_PORT (default 443), since a
// plain ws dial from an https page is blocked. Unset, Vite's defaults stand.
const proxiedHost = process.env.DEV_HOST || '';
const hmrPort = Number(process.env.DEV_HMR_PORT || '') || 443;

// The test bench's log (docs/BENCH.md, l1): where the hot-reload server
// appends its lines. vox-dev.sh sets it; blank, the bench says it isn't
// recording.
const benchLog = process.env.BENCH_LOG || '';

// The play log (docs/PLAY_LOG.md, l5): where the game sends its lines, on
// the tailnet's origin. The release (GitHub Pages) gets none, so it sends
// nothing and shows no flag. These two are the only values this config puts
// into the game (src/arcade/log/build.ts reads them).
const release = process.env.RELEASE === '1';
const playLogUrl = release ? '' : '/vox-log/';
function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  define: {
    __PLAY_LOG_URL__: JSON.stringify(playLogUrl),
    __BUILD__: JSON.stringify(commit()),
  },
  // The test bench's Save writes here (docs/BENCH.md, Saving); only the dev server has it.
  plugins: [
    benchLogPlugin(benchLog),
    benchSavePlugin(resolve(import.meta.dirname, 'src/arcade/content/saved-tuning.json')),
    eventsSavePlugin(resolve(import.meta.dirname, 'src/arcade/content/saved-events.json')),
  ],
  server: {
    host,
    ...(proxiedHost
      ? {
          allowedHosts: [proxiedHost],
          hmr: { host: proxiedHost, protocol: 'wss', clientPort: hmrPort },
        }
      : {}),
  },
  preview: { host },
  // Relative base so the build works from any subpath (e.g. GitHub Pages /vox/).
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~520 kB minified (~130 kB gzipped), which is expected.
    chunkSizeWarningLimit: 800,
    // While we're building foundations, the deployed site includes the dev
    // tools (/dev/*) so they can be tested on real phones from a URL.
    // `npm run build:release` leaves them out.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...(release
          ? {}
          : {
              devIndex: resolve(import.meta.dirname, 'dev/index.html'),
              devBeat: resolve(import.meta.dirname, 'dev/beat.html'),
              devModels: resolve(import.meta.dirname, 'dev/models.html'),
              devAudio: resolve(import.meta.dirname, 'dev/audio.html'),
              devLyrics: resolve(import.meta.dirname, 'dev/lyrics.html'),
              devPlays: resolve(import.meta.dirname, 'dev/plays.html'),
              devBench: resolve(import.meta.dirname, 'dev/bench.html'),
              devEvents: resolve(import.meta.dirname, 'dev/events.html'),
            }),
      },
    },
  },
  test: {
    // The long sim tests take 5-6 s on a slow shared CPU (BUGS.md B2).
    testTimeout: 20_000,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    // Every test plays tuning.ts's defaults, not the bench's saved settings.
    setupFiles: ['tests/setup.ts'],
  },
});
