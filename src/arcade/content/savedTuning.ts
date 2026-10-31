/**
 * Saved settings (docs/BENCH.md, Saving): the values the Coach saved on the
 * test bench, laid over tuning.ts's defaults. tuning.ts calls `layerSaved`
 * as it loads, so the game, the balance bot and the bench all play the same
 * numbers; the bench calls it again as its sliders move.
 */

type Tree = Record<string, unknown>;

/** The object holding the number at a dotted path, and its key, or null if there's no number there. */
export function numberAt(root: unknown, path: string): { parent: Tree; key: string } | null {
  const keys = path.split('.');
  const key = keys.pop() ?? '';
  let parent: unknown = root;
  for (const part of keys) {
    if (typeof parent !== 'object' || parent === null) return null;
    parent = (parent as Tree)[part];
  }
  if (typeof parent !== 'object' || parent === null) return null;
  return typeof (parent as Tree)[key] === 'number' ? { parent: parent as Tree, key } : null;
}

/** Copy every number in `from` onto the same place in `to` (the same shape). */
function resetNumbers(to: Tree, from: Tree): void {
  for (const [key, v] of Object.entries(from)) {
    if (typeof v === 'number') to[key] = v;
    else if (typeof v === 'object' && v !== null) resetNumbers(to[key] as Tree, v as Tree);
  }
}

/**
 * Set `live` to `defaults` with `saved` on top: each saved path replaces
 * just that default. Returns a warning for each saved entry left out (no
 * such setting, or not a number), so nothing saved is dropped silently.
 */
export function layerSaved(live: object, defaults: object, saved: unknown): string[] {
  resetNumbers(live as Tree, defaults as Tree);
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
    return ['saved-tuning.json is not an object of settings, so nothing saved was played'];
  }
  const warnings: string[] = [];
  for (const [path, v] of Object.entries(saved)) {
    const at = numberAt(live, path);
    if (!at) {
      warnings.push(`saved-tuning.json: ${path} is not a setting in tuning.ts, so it was left out`);
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      warnings.push(
        `saved-tuning.json: ${path} is not a number (${JSON.stringify(v)}), so it was left out`,
      );
    } else {
      at.parent[at.key] = v;
    }
  }
  return warnings;
}
