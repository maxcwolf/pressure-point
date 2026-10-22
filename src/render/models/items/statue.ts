// The Serenity Statue model.

import type * as THREE from 'three';

import { capsule, mat, put, soft, sph } from '../parts';

/** Build the Serenity Statue model: a stone figure sitting cross-legged on a plinth, hands in its lap. */
export function buildStatue(g: THREE.Group) {
  const stone = mat(0xb9b2a4, 0.85);
  put(g, soft(0.7, 0.16, 0.7), stone, 0, 0.08, 0);
  put(g, soft(0.56, 0.08, 0.56), stone, 0, 0.2, 0);
  // the crossed legs, a wide soft roll, with a knee at each end
  put(g, capsule(0.12, 0.3), stone, 0, 0.33, 0.04).rotation.z = Math.PI / 2;
  for (const x of [-0.2, 0.2]) put(g, sph(0.12, 14), stone, x, 0.33, 0.1);
  put(g, capsule(0.17, 0.16), stone, 0, 0.56, -0.03);
  // arms falling to the hands, cupped in the lap
  for (const side of [-1, 1])
    put(g, capsule(0.05, 0.2), stone, side * 0.17, 0.5, 0.06).rotation.set(0.5, 0, side * 0.35);
  put(g, sph(0.07, 12), stone, 0, 0.42, 0.14).scale.set(1.5, 0.7, 1);
  put(g, sph(0.15, 16), stone, 0, 0.86, -0.02);
  put(g, sph(0.06, 10), stone, 0, 1.02, -0.03);
}
