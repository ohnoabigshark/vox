import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

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

export default defineConfig({
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
        ...(process.env.RELEASE === '1'
          ? {}
          : {
              devIndex: resolve(import.meta.dirname, 'dev/index.html'),
              devBeat: resolve(import.meta.dirname, 'dev/beat.html'),
              devModels: resolve(import.meta.dirname, 'dev/models.html'),
              devAudio: resolve(import.meta.dirname, 'dev/audio.html'),
              devLyrics: resolve(import.meta.dirname, 'dev/lyrics.html'),
            }),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
