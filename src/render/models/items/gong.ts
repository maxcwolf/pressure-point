// The Gong model: a great bronze gong hanging in a wooden frame, with its beater.

import type * as THREE from 'three';

import { capsule, cyl, mat, put, soft, sph, torus, WOOD_DARK } from '../parts';

/** Build the Gong model. */
export function buildGong(g: THREE.Group) {
  const wood = mat(WOOD_DARK);
  // two feet, two posts and a beam across the top
  for (const x of [-0.78, 0.78]) {
    put(g, soft(0.14, 0.09, 0.6), wood, x, 0.045, 0);
    put(g, soft(0.1, 1.5, 0.1), wood, x, 0.8, 0);
  }
  put(g, soft(1.78, 0.11, 0.13), wood, 0, 1.55, 0);
  // the gong itself, facing the front, on two cords
  const bronze = mat(0xc9963f, 0.28, 0.08);
  const disc = put(g, cyl(0.6, 0.6, 0.05, 40), bronze, 0, 0.86, 0);
  disc.rotation.x = Math.PI / 2;
  put(g, torus(0.6, 0.035), mat(0x8a6420, 0.3), 0, 0.86, 0);
  put(g, cyl(0.16, 0.16, 0.06, 28), mat(0xa77a2c, 0.3), 0, 0.86, 0.02).rotation.x = Math.PI / 2;
  for (const x of [-0.32, 0.32]) put(g, cyl(0.014, 0.014, 0.12, 8), mat(0x5b3f6e), x, 1.44, 0);
  // the beater, leaning on a post
  const beater = put(g, capsule(0.026, 0.56), mat(0x6b4a2a), 0.68, 0.32, 0.2);
  beater.rotation.z = 0.25;
  put(g, sph(0.08, 16), mat(0xe8dcc0), 0.6, 0.62, 0.2);
}
