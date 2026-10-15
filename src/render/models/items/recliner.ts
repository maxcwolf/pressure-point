// The Recliner model: a padded lounger on a low wooden frame, with a pillow at the head and a blanket to lie on.

import type * as THREE from 'three';

import { linensMaterial } from '../linens';
import { CREAM, cyl, mat, partsOf, put, rbox, WOOD_DARK } from '../parts';

/** Build the Recliner model. */
export function buildRecliner(g: THREE.Group) {
  for (const [x, z] of [
    [-0.28, -0.78],
    [0.28, -0.78],
    [-0.28, 0.78],
    [0.28, 0.78],
  ])
    put(g, cyl(0.04, 0.04, 0.16), mat(WOOD_DARK), x, 0.08, z);
  put(g, rbox(0.74, 0.07, 1.78, 0.03), mat(WOOD_DARK), 0, 0.19, 0);
  put(g, rbox(0.7, 0.1, 1.72, 0.05), mat(0x7fae8f), 0, 0.27, 0);
  // the head end tilts up a little, with a pillow on it
  const back = put(g, rbox(0.7, 0.1, 0.5, 0.05), mat(0x7fae8f), 0, 0.36, -0.68);
  back.rotation.x = 0.35;
  put(g, rbox(0.46, 0.08, 0.22, 0.04), mat(CREAM), 0, 0.46, -0.74);
  const blanket = linensMaterial(0xe8d9b5);
  put(g, rbox(0.72, 0.03, 0.9, 0.015), blanket, 0, 0.335, 0.38);
  partsOf(g).linens = blanket;
}
