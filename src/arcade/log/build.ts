/**
 * What the build tells the game (vite.config.ts, `define`): where the play
 * log goes, blank in the release build (docs/PLAY_LOG.md, l5), and the
 * commit it was built from.
 */
declare const __PLAY_LOG_URL__: string;
declare const __BUILD__: string;

export const PLAY_LOG_URL: string = __PLAY_LOG_URL__;
export const BUILD: string = __BUILD__;
