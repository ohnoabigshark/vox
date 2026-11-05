import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { toScreen } from '../../src/arcade/render/world';

/** toScreen (review x9): the one way a point in the world becomes a spot on the canvas. */
describe('toScreen', () => {
  const camera = new THREE.PerspectiveCamera(50, 2, 0.5, 200);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const canvas = { clientWidth: 400, clientHeight: 200 };

  it('the point the camera looks at is the middle of the canvas', () => {
    const p = toScreen(new THREE.Vector3(0, 0, 0), camera, canvas);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(100);
  });

  it('right in the world is right on the screen, and up is up (y counts down from the top)', () => {
    const right = toScreen(new THREE.Vector3(1, 0, 0), camera, canvas);
    const up = toScreen(new THREE.Vector3(0, 1, 0), camera, canvas);
    expect(right.x).toBeGreaterThan(200);
    expect(up.y).toBeLessThan(100);
  });

  it('leaves the point it was given where it was', () => {
    const at = new THREE.Vector3(1, 2, 3);
    toScreen(at, camera, canvas);
    expect(at.toArray()).toEqual([1, 2, 3]);
  });
});
