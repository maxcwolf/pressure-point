// The Fireplace model.

import type * as THREE from 'three';

import { cyl, mat, partsOf, put, rbox } from '../parts';

/** Build the Fireplace model: a stone hearth with a mantel, logs in the grate and flames that flicker. */
export function buildFireplace(g: THREE.Group) {
  const stone = mat(0xb9ada0, 0.95);
  const dark = mat(0x2a2422, 0.95);
  // the chimney breast, with an opening for the fire
  put(g, rbox(1.7, 1.25, 0.42, 0.04), stone, 0, 0.63, -0.26);
  put(g, rbox(0.9, 0.62, 0.1, 0.03), dark, 0, 0.4, -0.04);
  put(g, rbox(1.9, 0.1, 0.56, 0.03), mat(0x7a5a3c, 0.6), 0, 1.25, -0.2);
  put(g, rbox(1.4, 0.08, 0.5, 0.03), mat(0x8f857a, 0.9), 0, 0.04, 0.1);
  // logs in the grate
  const bark = mat(0x6b4a32, 0.9);
  for (const [x, turn] of [
    [-0.12, 0.25],
    [0.12, -0.25],
  ] as const) {
    const log = put(g, cyl(0.06, 0.06, 0.52, 10), bark, x, 0.17, 0.02);
    log.rotation.set(0, turn, Math.PI / 2);
  }
  // the flames, each its own glowing cone
  const flames = [
    [0, 0.34, 0.14, 0.32, 0xff9a3c],
    [-0.15, 0.3, 0.1, 0.24, 0xffb347],
    [0.15, 0.3, 0.1, 0.26, 0xff7a2f],
    [0, 0.27, 0.07, 0.16, 0xffe08a],
  ] as const;
  partsOf(g).flames = flames.map(([x, y, r, h, color]) => {
    const flame = put(g, cyl(0.001, r, h, 8), mat(color, 0.4, 1.4), x, y, 0.04);
    flame.castShadow = false;
    return flame;
  });
}
