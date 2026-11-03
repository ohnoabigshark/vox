import { describe, expect, it } from 'vitest';
import { launchChrome, newestCachedChromium } from '../../tools/browser';

/** TECHNICAL.md §21 (Environment): the tools that drive a browser use Chrome, or the newest Chromium Playwright cached. */

const NOT_FOUND = new Error(
  "browserType.launch: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome",
);

function fakeLaunch(fails: (opts: object) => Error | null) {
  const calls: object[] = [];
  const launch = async (opts: object) => {
    calls.push(opts);
    const error = fails(opts);
    if (error) throw error;
    return { opts };
  };
  return { calls, launch };
}

describe('launchChrome', () => {
  const args = ['--mute-audio'];

  it('launches the system Chrome when there is one', async () => {
    const f = fakeLaunch(() => null);
    const browser = await launchChrome(f.launch, () => '/cache/chromium-9/chrome', args);
    expect(f.calls).toEqual([{ channel: 'chrome', args }]);
    expect(browser).toEqual({ opts: { channel: 'chrome', args } });
  });

  it("falls back to the cached Chromium when Chrome isn't installed", async () => {
    const f = fakeLaunch((opts) => ('channel' in opts ? NOT_FOUND : null));
    await launchChrome(f.launch, () => '/cache/chromium-9/chrome', args);
    expect(f.calls).toEqual([
      { channel: 'chrome', args },
      { executablePath: '/cache/chromium-9/chrome', args },
    ]);
  });

  it('passes any other launch failure straight through, without a fallback', async () => {
    const crash = new Error('Browser closed unexpectedly');
    const f = fakeLaunch(() => crash);
    await expect(launchChrome(f.launch, () => '/cache/chromium-9/chrome', args)).rejects.toBe(
      crash,
    );
    expect(f.calls).toHaveLength(1);
  });

  it('with neither browser, says how to get one', async () => {
    const f = fakeLaunch(() => NOT_FOUND);
    await expect(launchChrome(f.launch, () => null, args)).rejects.toThrow(
      'No Chrome, and no Chromium in the Playwright cache: install Chrome, or run `npx playwright install chromium`.',
    );
    expect(f.calls).toHaveLength(1);
  });
});

describe('newestCachedChromium', () => {
  const cache = '/root/.cache/ms-playwright';
  const binary = (rev: number) => `${cache}/chromium-${rev}/chrome-linux64/chrome`;

  it('picks the highest revision that has its browser', () => {
    const entries = ['chromium-1243', 'chromium-1248', 'chromium-990', 'ffmpeg-1011'];
    const present = new Set([binary(1243), binary(1248), binary(990)]);
    expect(
      newestCachedChromium(
        cache,
        () => entries,
        (p) => present.has(p),
      ),
    ).toBe(binary(1248));
  });

  it('skips the headless shell and a revision whose browser is missing', () => {
    const entries = ['chromium_headless_shell-1300', 'chromium-1250', 'chromium-1243'];
    const present = new Set([binary(1243)]);
    expect(
      newestCachedChromium(
        cache,
        () => entries,
        (p) => present.has(p),
      ),
    ).toBe(binary(1243));
  });

  it('is null when the cache is missing or holds no Chromium', () => {
    const missing = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };
    expect(newestCachedChromium(cache, missing, () => true)).toBeNull();
    expect(
      newestCachedChromium(
        cache,
        () => ['ffmpeg-1011'],
        () => true,
      ),
    ).toBeNull();
  });
});
