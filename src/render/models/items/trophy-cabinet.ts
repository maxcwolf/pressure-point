// The Trophy Cabinet model.

import * as THREE from 'three';

import { soft } from '../clay';
import { cyl, mat, partsOf, put, WOOD, WOOD_DARK } from '../parts';

/** Build one gold cup on a plinth, standing on a shelf at a height. */
function trophy(g: THREE.Object3D, x: number, y: number, size: number): THREE.Group {
  const cup = new THREE.Group();
  const gold = mat(0xf2c14e, 0.25, 0.45);
  put(cup, soft(0.12 * size, 0.04, 0.12 * size), mat(0x3b3f4a), x, y + 0.02, -0.24);
  put(cup, cyl(0.022, 0.028, 0.08 * size, 10), gold, x, y + 0.04 + 0.04 * size, -0.24);
  put(cup, cyl(0.07 * size, 0.035 * size, 0.12 * size), gold, x, y + 0.08 * size + 0.1 * size, -0.24);
  g.add(cup);
  return cup;
}

/** Build the Trophy Cabinet model, its cups in the order they fill up as awards are won. */
export function buildTrophyCabinet(g: THREE.Group) {
  const frame = mat(WOOD_DARK);
  put(g, soft(0.8, 1.6, 0.06), mat(0x7a4a2c), 0, 0.8, -0.44);
  for (const x of [-0.38, 0.38]) put(g, soft(0.06, 1.6, 0.44), frame, x, 0.8, -0.24);
  for (const y of [0.04, 0.55, 1.05, 1.57]) put(g, soft(0.8, 0.05, 0.44), mat(WOOD), 0, y, -0.24);
  partsOf(g).cups = [
    trophy(g, 0, 1.08, 1.4),
    trophy(g, -0.15, 0.58, 1.2),
    trophy(g, 0.17, 0.58, 0.9),
    trophy(g, -0.2, 0.07, 0.8),
    trophy(g, 0.2, 0.07, 1),
  ];
}
