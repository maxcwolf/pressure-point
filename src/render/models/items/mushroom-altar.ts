// The Mushroom Altar model: a low table with a teapot, two small cups and a jar of dried mushrooms.

import type * as THREE from 'three';

import { CREAM, cyl, mat, put, rbox, sph, WOOD_DARK } from '../parts';

/** Build the Mushroom Altar model. */
export function buildMushroomAltar(g: THREE.Group) {
  const wood = mat(WOOD_DARK);
  put(g, rbox(0.8, 0.06, 0.6, 0.02), wood, 0, 0.32, -0.05);
  for (const [x, z] of [
    [-0.33, -0.28],
    [0.33, -0.28],
    [-0.33, 0.18],
    [0.33, 0.18],
  ])
    put(g, rbox(0.06, 0.3, 0.06, 0.015), wood, x, 0.15, z);
  put(g, rbox(0.7, 0.01, 0.4, 0.005), mat(0x5b3f6e, 0.8), 0, 0.355, -0.05);
  // the teapot and its cups
  const clay = mat(0x9b5a3a, 0.6);
  put(g, sph(0.1, 14), clay, -0.18, 0.43, -0.08).scale.y = 0.8;
  put(g, cyl(0.015, 0.02, 0.1, 8), clay, -0.07, 0.46, -0.08).rotation.z = -1;
  for (const x of [0.02, 0.12]) put(g, cyl(0.035, 0.03, 0.05, 10), mat(CREAM), x, 0.385, 0.08);
  // a jar of dried mushrooms, and one fresh red one with white spots on the side
  put(g, cyl(0.07, 0.07, 0.16, 12), mat(0xd9e8e8, 0.15), 0.22, 0.44, -0.15);
  put(g, cyl(0.072, 0.072, 0.03, 12), mat(0x6b4a2a), 0.22, 0.535, -0.15);
  put(g, cyl(0.02, 0.025, 0.07, 8), mat(CREAM), -0.28, 0.395, 0.12);
  put(g, sph(0.05, 12), mat(0xd9362f, 0.5), -0.28, 0.44, 0.12).scale.y = 0.6;
  for (const [x, z] of [
    [-0.3, 0.1],
    [-0.26, 0.14],
  ])
    put(g, sph(0.01, 6), mat(0xffffff), x, 0.465, z);
}
