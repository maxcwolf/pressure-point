// The Toilet Stall model.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, torus, WHITE } from '../parts';

/** Build the Toilet Stall model. */
export function buildToilet(g: THREE.Group) {
  const wall = mat(0x8fd3c1);
  put(g, rbox(1.0, 1.2, 0.06, 0.02), wall, 0, 0.6, -0.46);
  for (const x of [-0.47, 0.47]) put(g, rbox(0.06, 1.2, 0.96, 0.02), wall, x, 0.6, 0);
  // the bowl sits back, so a sitter's legs hang in front of it
  put(g, cyl(0.17, 0.14, 0.34), mat(WHITE, 0.3), 0, 0.17, -0.1);
  const seat = put(g, torus(0.155, 0.045), mat(WHITE, 0.3), 0, 0.35, -0.1);
  seat.rotation.x = Math.PI / 2;
  put(g, rbox(0.44, 0.34, 0.16, 0.04), mat(WHITE, 0.3), 0, 0.5, -0.33);
}
