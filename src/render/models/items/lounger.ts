// The Lounger model: a padded lounger on a low wooden frame, its cushion in pads like a sun lounger's with the head
// pad lifted, a pillow at the head and a blanket folded over the foot.

import type * as THREE from 'three';

import { linensMaterial } from '../linens';
import { capsule, CREAM, cyl, mat, partsOf, put, soft, WOOD_DARK } from '../parts';

/** The cushion's dusty blue, well clear of the Acupuncture Table's mint. */
const CUSHION = 0x7f9bb3;

/** Build the Lounger model. */
export function buildLounger(g: THREE.Group) {
  const wood = mat(WOOD_DARK);
  for (const [x, z] of [
    [-0.29, -0.8],
    [0.29, -0.8],
    [-0.29, 0.8],
    [0.29, 0.8],
  ])
    put(g, cyl(0.045, 0.034, 0.18, 12), wood, x, 0.09, z);
  put(g, soft(0.78, 0.07, 1.84), wood, 0, 0.21, 0);
  const cushion = mat(CUSHION, 0.85);
  for (const z of [-0.08, 0.36, 0.78]) put(g, soft(0.72, 0.14, 0.41), cushion, 0, 0.31, z);
  // the head pad tilts up, with a pillow on it
  const back = put(g, soft(0.72, 0.14, 0.58), cushion, 0, 0.38, -0.6);
  back.rotation.x = 0.32;
  put(g, capsule(0.07, 0.38), mat(CREAM, 0.85), 0, 0.5, -0.7).rotation.set(0.32, 0, Math.PI / 2);
  // the blanket lies over the foot pad and folds down over its end
  const blanket = linensMaterial(0xece2cc);
  put(g, soft(0.76, 0.05, 0.46), blanket, 0, 0.4, 0.66);
  put(g, soft(0.76, 0.18, 0.05), blanket, 0, 0.32, 0.9);
  partsOf(g).linens = blanket;
}
