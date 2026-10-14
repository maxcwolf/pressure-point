// The Singing Bowls model.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, sph, torus, WOOD_DARK } from '../parts';

/** Build the Singing Bowls model. */
export function buildSingingBowls(g: THREE.Group) {
  put(g, rbox(0.8, 0.42, 0.6, 0.04), mat(WOOD_DARK), 0, 0.21, 0);
  put(g, rbox(0.84, 0.04, 0.64, 0.02), mat(0x7a5aa8), 0, 0.44, 0);
  const bronze = mat(0xc9963f, 0.3);
  for (const [x, z, r] of [
    [-0.2, -0.08, 0.15],
    [0.17, -0.1, 0.12],
    [0.05, 0.16, 0.09],
  ] as const) {
    put(g, cyl(r * 0.9, r * 0.9, 0.02, 14), mat(0xa8323e), x, 0.47, z);
    const bowl = put(g, sph(r, 18), bronze, x, 0.48 + r * 0.45, z);
    bowl.scale.y = 0.55;
    put(g, torus(r, 0.01), mat(0x8a6420, 0.3), x, 0.48 + r * 0.7, z).rotation.x = Math.PI / 2;
  }
  // the mallet, lying across the front
  const mallet = put(g, cyl(0.018, 0.018, 0.36, 8), mat(0x6b4a2a), 0.12, 0.48, 0.24);
  mallet.rotation.z = Math.PI / 2;
  put(g, cyl(0.03, 0.03, 0.08, 10), mat(0x5b3f6e, 0.9), -0.07, 0.48, 0.24).rotation.z = Math.PI / 2;
}
