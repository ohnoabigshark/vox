/** One step bringing what was saved from its version to the next. */
export type UpgradeStep = (saved: Record<string, unknown>) => Record<string, unknown>;

/**
 * What was saved, brought up to `current` by numbered steps (`steps[n]`
 * turns version n into n + 1), its version read from `key`; or null if it
 * has no version this code knows (a later one, or a step that's missing).
 */
export function upgraded(
  saved: Record<string, unknown>,
  key: string,
  current: number,
  steps: Readonly<Record<number, UpgradeStep>>,
): Record<string, unknown> | null {
  let at = saved;
  while (typeof at[key] === 'number' && (at[key] as number) < current) {
    const step = steps[at[key] as number];
    if (!step) return null;
    at = step(at);
  }
  return at[key] === current ? at : null;
}
