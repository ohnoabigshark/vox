/**
 * Where the hot-reload server takes the test bench's log lines and saves
 * (tools/benchLog.ts, tools/benchSave.ts), under the page's base URL. The
 * page and the plugins both read these. It imports nothing: the plugins
 * load with Vite's config, and a file the config loads must not reach
 * tuning.ts (docs/BENCH.md, as built).
 */
export const BENCH_LOG_PATH = '__bench-log';
export const BENCH_SAVE_PATH = '__bench-save';
