// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { ArcadeNames } from '../../src/arcade/render/names';
import { Hud } from '../../src/ui/hud';

/**
 * B7 (docs/BUGS.md): the game puts the names layer into the UI root, then
 * builds the Hud there (game.ts). The Hud must add to the root, not replace
 * what it holds, or the names are drawn on a detached element nobody sees.
 */
describe('the UI root (B7)', () => {
  it('keeps the names layer when the Hud is built after it, under the HUD', () => {
    const root = document.createElement('div');
    document.body.append(root);
    new ArcadeNames(root);
    const noop = (): void => {};
    new Hud(root, { onAction: noop, onCard: noop, onFlip: noop, onDraft: noop, onSkip: noop });
    const layer = root.querySelector('.arcade-names');
    expect(layer).not.toBeNull();
    expect(root.firstElementChild).toBe(layer);
    expect(root.querySelector('.hud-top')).not.toBeNull();
  });
});
