// The Cupping Cart model.

import type * as THREE from 'three';

import { cyl, DARK, GLASS, LACQUER, mat, put, soft, sph, WHITE, WOOD_DARK } from '../parts';

/** Build the Cupping Cart model. */
export function buildCuppingCart(g: THREE.Group) {
  for (const [x, z] of [
    [-0.26, -0.18],
    [0.26, -0.18],
    [-0.26, 0.18],
    [0.26, 0.18],
  ]) {
    put(g, cyl(0.032, 0.032, 0.68, 12), mat(LACQUER), x, 0.41, z);
    put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
  }
  put(g, soft(0.62, 0.05, 0.46), mat(WOOD_DARK), 0, 0.3, 0);
  put(g, soft(0.62, 0.05, 0.46), mat(WOOD_DARK), 0, 0.72, 0);
  // the glass cups on a white cloth, so they show as glass rather than as stones, and folded towels below
  put(g, soft(0.5, 0.02, 0.38), mat(WHITE), 0, 0.755, 0);
  for (let i = 0; i < 6; i++) {
    const cup = put(g, sph(0.072, 14), GLASS, -0.16 + (i % 3) * 0.16, 0.8, -0.08 + Math.floor(i / 3) * 0.16);
    cup.scale.y = 0.85;
  }
  put(g, soft(0.4, 0.1, 0.3), mat(WHITE), 0, 0.375, 0);
}
