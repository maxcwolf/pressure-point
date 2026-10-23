// Sprites that stay readable as the camera pulls back. A speech bubble or a marker has a size in the world, which is
// right close up; from where the game starts on a plain screen it would be a 20-pixel smudge, and further out smaller
// still. So each is drawn at least so many pixels across, and at its own size when nearer, but never more than half as
// big again as its own size: far out, a bubble bigger than a head would hide the people it is about.

import * as THREE from 'three';

/** The least a speech bubble's sprite covers on screen, in pixels of the page: the bubble itself about 28 of them. */
export const BUBBLE_PX = 32;
/** The least a marker's sprite covers, over furniture or the squares it is used from: its icon about 24 pixels. */
export const MARKER_PX = 26;
/** The most a sprite grows to stay readable, as a share of its own size. */
export const MAX_GROWTH = 1.5;

/** How many pixels a meter covers on screen this far from a camera with this field of view, in a picture this tall. */
export const pixelsPerMeter = (fovDegrees: number, distance: number, height: number) =>
  height / (2 * distance * Math.tan(THREE.MathUtils.degToRad(fovDegrees / 2)));

/**
 * How much bigger than its size something `meters` across is drawn so that it covers at least `px` pixels, up to
 * `MAX_GROWTH`.
 */
export const floorScale = (meters: number, perMeter: number, px: number) =>
  Math.min(Math.max(1, px / (meters * perMeter)), MAX_GROWTH);

const eye = new THREE.Vector3();
const at = new THREE.Vector3();
const page = new THREE.Vector2();

/**
 * Give a sprite its size, `meters` across, and keep it at least `px` pixels across on screen. It is made bigger only
 * while it is drawn, so whatever else scales it from frame to frame (a pop, a pulse) still does, and picking still sees
 * its own size.
 */
export function readable(sprite: THREE.Sprite, meters: number, px: number) {
  sprite.scale.setScalar(meters);
  let grown = 1;
  /** Grow the sprite, just before it is drawn, to the least size it may be on screen. */
  sprite.onBeforeRender = (renderer, _scene, camera) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    eye.setFromMatrixPosition(camera.matrixWorld);
    at.setFromMatrixPosition(sprite.matrixWorld);
    const across = meters * (sprite.parent?.matrixWorld.getMaxScaleOnAxis() ?? 1);
    grown = floorScale(across, pixelsPerMeter(camera.fov, eye.distanceTo(at), renderer.getSize(page).y), px);
    if (grown === 1) return;
    sprite.scale.multiplyScalar(grown);
    sprite.updateMatrixWorld();
  };
  /** Shrink it back once drawn. */
  sprite.onAfterRender = () => {
    if (grown === 1) return;
    sprite.scale.divideScalar(grown);
    sprite.updateMatrixWorld();
    grown = 1;
  };
}
