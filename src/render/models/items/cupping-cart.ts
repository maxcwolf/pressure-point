// The Cupping Cart model.

import type * as THREE from 'three';

import { cyl, DARK, GLASS, LACQUER, mat, put, rbox, sph, WHITE, WOOD_DARK } from '../parts';

/** Build the Cupping Cart model. */
export function buildCuppingCart(g: THREE.Group) {
  for (const [x, z] of [
    [-0.26, -0.18],
    [0.26, -0.18],
    [-0.26, 0.18],
    [0.26, 0.18],
  ]) {
    put(g, cyl(0.02, 0.02, 0.66, 8), mat(LACQUER), x, 0.4, z);
    put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
  }
  put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(WOOD_DARK), 0, 0.3, 0);
  put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(WOOD_DARK), 0, 0.72, 0);
  for (let i = 0; i < 6; i++) {
    const cup = put(g, sph(0.075, 12), GLASS, -0.19 + (i % 3) * 0.19, 0.8, -0.09 + Math.floor(i / 3) * 0.18);
    cup.scale.y = 0.85;
  }
  put(g, rbox(0.4, 0.1, 0.3, 0.03), mat(WHITE), 0, 0.37, 0);
}
