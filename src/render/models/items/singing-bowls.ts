// The Singing Bowls model: bowls of every size set out on a cloth on the floor, with the healer's cushion in front.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, sph, torus } from '../parts';

/** Where each bowl sits on the cloth and how big it is, from the biggest at the back. */
const BOWLS = [
  [0, -0.22, 0.17],
  [-0.27, -0.06, 0.13],
  [0.27, -0.06, 0.13],
  [-0.15, 0.16, 0.09],
  [0.15, 0.16, 0.09],
] as const;

/** Build the Singing Bowls model. */
export function buildSingingBowls(g: THREE.Group) {
  put(g, rbox(0.9, 0.03, 0.8, 0.01), mat(0x3f7f8c), 0, 0.015, 0);
  const bronze = mat(0xc9963f, 0.3);
  const rim = mat(0x8a6420, 0.3);
  for (const [x, z, r] of BOWLS) {
    put(g, cyl(r * 0.85, r * 0.85, 0.03, 14), mat(0xa8323e), x, 0.045, z);
    const bowl = put(g, sph(r, 18), bronze, x, 0.06 + r * 0.45, z);
    bowl.scale.y = 0.55;
    put(g, torus(r, 0.01), rim, x, 0.06 + r * 0.7, z).rotation.x = Math.PI / 2;
  }
  // the mallet, lying by the smallest bowls
  const mallet = put(g, cyl(0.018, 0.018, 0.34, 8), mat(0x6b4a2a), 0, 0.05, 0.34);
  mallet.rotation.z = Math.PI / 2;
  // the healer's cushion, just past the front of the cloth
  put(g, cyl(0.2, 0.22, 0.08, 16), mat(0xe8b04a), 0, 0.04, 0.62);
}
