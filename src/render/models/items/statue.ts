// The Serenity Statue model.

import type * as THREE from 'three';

import { capsule, cyl, mat, put, rbox, sph } from '../parts';

/** Build the Serenity Statue model. */
export function buildStatue(g: THREE.Group) {
  const stone = mat(0xb9b2a4, 0.85);
  put(g, rbox(0.7, 0.2, 0.7, 0.04), stone, 0, 0.1, 0);
  put(g, cyl(0.26, 0.32, 0.3, 14), stone, 0, 0.35, 0);
  put(g, capsule(0.19, 0.2), stone, 0, 0.72, 0);
  put(g, sph(0.17, 14), stone, 0, 1.08, 0);
  put(g, sph(0.07, 10), stone, 0, 1.26, 0);
  for (const x of [-0.24, 0.24]) put(g, sph(0.09, 10), stone, x, 0.5, 0.14);
}
