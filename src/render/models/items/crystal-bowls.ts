// The Crystal Bowls model: frosted quartz bowls on a low wooden stand.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, WOOD } from '../parts';

/** Build the Crystal Bowls model. */
export function buildCrystalBowls(g: THREE.Group) {
  put(g, rbox(0.82, 0.16, 0.66, 0.04), mat(WOOD), 0, 0.08, 0);
  const quartz = mat(0xf4f6fb, 0.18, 0.12);
  for (const [x, z, r] of [
    [-0.2, -0.12, 0.16],
    [0.2, -0.1, 0.14],
    [0, 0.17, 0.11],
  ] as const) {
    put(g, cyl(r, r * 0.92, r * 1.1, 20), quartz, x, 0.16 + r * 0.55, z);
  }
}
