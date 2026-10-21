// The Espresso Machine model.

import type * as THREE from 'three';

import { CHROME, CREAM, cyl, DARK, mat, put, soft, WHITE, WOOD_DARK } from '../parts';

/** Build the Espresso Machine model. */
export function buildCoffeeMachine(g: THREE.Group) {
  put(g, soft(0.9, 0.8, 0.6), mat(WOOD_DARK), 0, 0.4, -0.12);
  put(g, soft(0.96, 0.06, 0.68), mat(CREAM), 0, 0.83, -0.12);
  put(g, soft(0.5, 0.42, 0.36), mat(CHROME, 0.25), 0, 1.07, -0.2);
  put(g, soft(0.52, 0.06, 0.38), mat(DARK), 0, 1.31, -0.2);
  for (const x of [-0.12, 0.12]) {
    put(g, cyl(0.04, 0.05, 0.08), mat(DARK), x, 0.98, 0.0);
    put(g, cyl(0.05, 0.04, 0.08), mat(WHITE, 0.4), x, 0.9, 0.04);
  }
  put(g, cyl(0.07, 0.07, 0.2), mat(0x6b4f33, 0.6), 0.34, 0.96, -0.12);
}
