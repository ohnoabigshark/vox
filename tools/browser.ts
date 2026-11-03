/**
 * The browser the tools drive (the model previews, screenshots, the video
 * capture): the system Chrome where there is one, otherwise the newest
 * Chromium in Playwright's cache. The droplet has no Chrome, but Hermit's
 * end-to-end tests leave a Chromium there, and that one can be a different
 * revision from the one this playwright-core would download, so it's found
 * by looking rather than by asking Playwright.
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';

/** Launch Chrome, or the cached Chromium when Chrome isn't installed. */
export async function launchChrome<B>(
  launch: (opts: { channel?: string; executablePath?: string; args: string[] }) => Promise<B>,
  cachedChromium: () => string | null,
  args: readonly string[],
): Promise<B> {
  try {
    return await launch({ channel: 'chrome', args: [...args] });
  } catch (error) {
    if (!(error instanceof Error) || !/distribution 'chrome' is not found/.test(error.message)) {
      throw error;
    }
    const executablePath = cachedChromium();
    if (!executablePath) {
      throw new Error(
        'No Chrome, and no Chromium in the Playwright cache: install Chrome, or run `npx playwright install chromium`.',
        { cause: error },
      );
    }
    return launch({ executablePath, args: [...args] });
  }
}

/** The newest `chromium-<revision>` in a Playwright cache that has its browser (Linux layout). */
export function newestCachedChromium(
  cache: string,
  readdir: (dir: string) => readonly string[],
  exists: (path: string) => boolean,
): string | null {
  let entries: readonly string[];
  try {
    entries = readdir(cache);
  } catch {
    return null;
  }
  const found = entries
    .map((name) => /^chromium-(\d+)$/.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ revision: Number(m[1]), path: join(cache, m[0], 'chrome-linux64', 'chrome') }))
    .filter((c) => exists(c.path))
    .sort((a, b) => b.revision - a.revision);
  return found[0]?.path ?? null;
}

/** Playwright's cache: PLAYWRIGHT_BROWSERS_PATH, or its default on Linux. */
const playwrightCache = (): string =>
  process.env['PLAYWRIGHT_BROWSERS_PATH'] || join(homedir(), '.cache', 'ms-playwright');

/** What the tools call: Chrome or the cached Chromium, with these command-line switches. */
export function launchToolBrowser(args: readonly string[]): Promise<Browser> {
  return launchChrome(
    (opts) => chromium.launch(opts),
    () => newestCachedChromium(playwrightCache(), (dir) => readdirSync(dir), existsSync),
    args,
  );
}
