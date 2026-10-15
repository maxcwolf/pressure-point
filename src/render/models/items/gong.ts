// The Gong model: a great bronze gong hanging in a wooden frame, with its beater.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, sph, torus, WOOD_DARK } from '../parts';

/** Build the Gong model. */
export function buildGong(g: THREE.Group) {
  const wood = mat(WOOD_DARK);
  // two feet, two posts and a beam across the top
  for (const x of [-0.78, 0.78]) {
    put(g, rbox(0.12, 0.08, 0.6, 0.03), wood, x, 0.04, 0);
    put(g, rbox(0.09, 1.55, 0.09, 0.02), wood, x, 0.8, 0);
  }
  put(g, rbox(1.75, 0.1, 0.12, 0.03), wood, 0, 1.6, 0);
  // the gong itself, facing the front, on two cords
  const bronze = mat(0xc9963f, 0.28, 0.08);
  const disc = put(g, cyl(0.6, 0.6, 0.04, 32), bronze, 0, 0.88, 0);
  disc.rotation.x = Math.PI / 2;
  put(g, torus(0.6, 0.03), mat(0x8a6420, 0.3), 0, 0.88, 0);
  put(g, cyl(0.16, 0.16, 0.05, 24), mat(0xa77a2c, 0.3), 0, 0.88, 0.02).rotation.x = Math.PI / 2;
  for (const x of [-0.32, 0.32]) put(g, cyl(0.01, 0.01, 0.2, 6), mat(0x5b3f6e), x, 1.5, 0);
  // the beater, leaning on a post
  const beater = put(g, cyl(0.02, 0.02, 0.6, 8), mat(0x6b4a2a), 0.68, 0.32, 0.2);
  beater.rotation.z = 0.25;
  put(g, sph(0.07, 12), mat(0xe8dcc0), 0.6, 0.6, 0.2);
}
