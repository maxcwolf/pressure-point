// The Crystal Bowls model: frosted quartz bowls on a low wooden stand.

import type * as THREE from 'three';

import { bowl, mat, put, soft, WOOD } from '../parts';

/** Build the Crystal Bowls model. */
export function buildCrystalBowls(g: THREE.Group) {
  put(g, soft(0.82, 0.16, 0.66), mat(WOOD), 0, 0.08, 0);
  const quartz = mat(0xf4f6fb, 0.18, 0.12);
  // open bowls, so their hollows show from above, each about half as deep as it is wide
  for (const [x, z, r] of [
    [-0.19, -0.11, 0.17],
    [0.2, -0.1, 0.15],
    [0, 0.17, 0.12],
  ] as const) {
    put(g, bowl(r, r * 0.95, 0.025, 28), quartz, x, 0.16, z);
  }
}
