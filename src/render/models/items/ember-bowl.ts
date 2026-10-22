// The Ember Bowl model: a stone bowl of glowing embers on a low wooden stand.

import type * as THREE from 'three';

import { bowl, cyl, mat, partsOf, put, sph, WOOD_DARK } from '../parts';

/** Build the Ember Bowl model. */
export function buildEmberBowl(g: THREE.Group) {
  put(g, cyl(0.24, 0.28, 0.12, 20), mat(WOOD_DARK), 0, 0.06, 0);
  // the bowl, open so its rim stands proud of the bed of ash in it
  put(g, bowl(0.32, 0.22, 0.04, 28), mat(0x6f6a64, 0.95), 0, 0.1, 0);
  put(g, cyl(0.27, 0.27, 0.02, 24), mat(0x2a2422, 0.95), 0, 0.28, 0);
  for (const [x, z] of [
    [-0.1, 0.04],
    [0.08, -0.06],
    [0.02, 0.11],
    [0.12, 0.06],
  ] as const)
    put(g, sph(0.055, 10), mat(0xff6a2a, 0.5, 1.1), x, 0.3, z).castShadow = false;
  // a lick of flame or two over the embers
  const flames = [
    [0, 0.08, 0.16, 0xff9a3c],
    [0.07, 0.06, 0.11, 0xffb347],
  ] as const;
  partsOf(g).flames = flames.map(([x, r, h, color]) => {
    const flame = put(g, cyl(0.001, r, h, 12), mat(color, 0.4, 1.4), x, 0.3 + h / 2, 0);
    flame.castShadow = false;
    return flame;
  });
}
