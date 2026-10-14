// The Trophy Cabinet model.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, WOOD, WOOD_DARK } from '../parts';

/** Build one gold cup on a plinth, standing on a shelf at a height. */
function trophy(g: THREE.Object3D, x: number, y: number, size: number) {
  const gold = mat(0xf2c14e, 0.25, 0.45);
  put(g, rbox(0.12 * size, 0.04, 0.12 * size, 0.01), mat(0x3b3f4a), x, y + 0.02, -0.24);
  put(g, cyl(0.015, 0.02, 0.08 * size), gold, x, y + 0.04 + 0.04 * size, -0.24);
  put(g, cyl(0.07 * size, 0.035 * size, 0.12 * size), gold, x, y + 0.08 * size + 0.1 * size, -0.24);
}

/** Build the Trophy Cabinet model. */
export function buildTrophyCabinet(g: THREE.Group) {
  const frame = mat(WOOD_DARK);
  put(g, rbox(0.8, 1.6, 0.06, 0.02), mat(0x7a4a2c), 0, 0.8, -0.44);
  for (const x of [-0.38, 0.38]) put(g, rbox(0.06, 1.6, 0.44, 0.02), frame, x, 0.8, -0.24);
  for (const y of [0.04, 0.55, 1.05, 1.57]) put(g, rbox(0.8, 0.05, 0.44, 0.02), mat(WOOD), 0, y, -0.24);
  trophy(g, -0.15, 0.58, 1.2);
  trophy(g, 0.17, 0.58, 0.9);
  trophy(g, 0, 1.08, 1.4);
  trophy(g, -0.2, 0.07, 0.8);
  trophy(g, 0.2, 0.07, 1);
}
