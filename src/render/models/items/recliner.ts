// The Recliner model: a deep padded lounger in tan leather, with rolled arms, a raised headrest, a pillow at the head
// and a blanket to lie on.

import type * as THREE from 'three';

import { linensMaterial } from '../linens';
import { capsule, CREAM, mat, partsOf, put, soft, WOOD_DARK } from '../parts';

/** The leather it is upholstered in, warm against the treatment tables' mint and white. */
const LEATHER = 0xc4895a;

/** Build the Recliner model. */
export function buildRecliner(g: THREE.Group) {
  // a low skirted base rather than legs, so it reads as an armchair grown long and not as a table
  put(g, soft(0.8, 0.14, 1.84), mat(WOOD_DARK), 0, 0.07, 0);
  const leather = mat(LEATHER, 0.6);
  put(g, soft(0.66, 0.16, 1.7), leather, 0, 0.22, 0.02);
  // rolled arms along both sides, and the head end raised and tilted up, with a pillow on it
  for (const x of [-0.34, 0.34]) put(g, capsule(0.1, 0.96), leather, x, 0.36, 0.1).rotation.x = Math.PI / 2;
  const back = put(g, soft(0.78, 0.18, 0.56), leather, 0, 0.4, -0.66);
  back.rotation.x = 0.45;
  put(g, capsule(0.065, 0.36), mat(CREAM, 0.85), 0, 0.53, -0.72).rotation.set(0.45, 0, Math.PI / 2);
  const blanket = linensMaterial(0xe8d9b5);
  put(g, soft(0.5, 0.04, 0.9), blanket, 0, 0.32, 0.38);
  partsOf(g).linens = blanket;
}
