// The Recliner model: a padded lounger on a low wooden frame, with a pillow at the head and a blanket to lie on.

import type * as THREE from 'three';

import { linensMaterial } from '../linens';
import { capsule, CREAM, cyl, mat, partsOf, put, soft, WOOD_DARK } from '../parts';

/** Build the Recliner model. */
export function buildRecliner(g: THREE.Group) {
  for (const [x, z] of [
    [-0.28, -0.78],
    [0.28, -0.78],
    [-0.28, 0.78],
    [0.28, 0.78],
  ])
    put(g, cyl(0.045, 0.04, 0.16, 12), mat(WOOD_DARK), x, 0.08, z);
  put(g, soft(0.74, 0.07, 1.78), mat(WOOD_DARK), 0, 0.19, 0);
  put(g, soft(0.7, 0.12, 1.72), mat(0x7fae8f, 0.85), 0, 0.27, 0);
  // the head end tilts up a little, with a pillow on it
  const back = put(g, soft(0.7, 0.12, 0.5), mat(0x7fae8f, 0.85), 0, 0.37, -0.68);
  back.rotation.x = 0.35;
  put(g, capsule(0.065, 0.36), mat(CREAM, 0.85), 0, 0.48, -0.74).rotation.set(0.35, 0, Math.PI / 2);
  const blanket = linensMaterial(0xe8d9b5);
  put(g, soft(0.72, 0.04, 0.9), blanket, 0, 0.345, 0.38);
  partsOf(g).linens = blanket;
}
