// The Singing Bowls model: bowls of every size set out on a cloth on the floor, with the healer's cushion in front.

import type * as THREE from 'three';

import { capsule, cyl, mat, put, soft, sph, torus } from '../parts';

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
  put(g, soft(0.9, 0.03, 0.8), mat(0x3f7f8c, 0.85), 0, 0.015, 0);
  const bronze = mat(0xc9963f, 0.3);
  const rim = mat(0x8a6420, 0.3);
  for (const [x, z, r] of BOWLS) {
    put(g, cyl(r * 0.85, r * 0.85, 0.03, 16), mat(0xa8323e), x, 0.045, z);
    const bowl = put(g, sph(r, 18), bronze, x, 0.06 + r * 0.45, z);
    bowl.scale.y = 0.55;
    put(g, torus(r, 0.01), rim, x, 0.06 + r * 0.7, z).rotation.x = Math.PI / 2;
  }
  // the mallet, lying by the smallest bowls
  put(g, capsule(0.025, 0.32), mat(0x6b4a2a), 0, 0.055, 0.34).rotation.z = Math.PI / 2;
  // the healer's cushion, just past the front of the cloth
  put(g, sph(0.23, 18), mat(0xe8b04a, 0.85), 0, 0.06, 0.62).scale.y = 0.4;
}
