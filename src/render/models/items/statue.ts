// The Serenity Statue model.

import type * as THREE from 'three';

import { capsule, mat, put, soft, sph, torus } from '../parts';

/**
 * Build the Serenity Statue model: a stone figure sitting cross-legged on a plinth, with broad shoulders, hands in its
 * lap and a gold halo standing behind its head, so it reads as a seated figure and not a pile of stones.
 */
export function buildStatue(g: THREE.Group) {
  const stone = mat(0xb9b2a4, 0.85);
  put(g, soft(0.7, 0.16, 0.7), stone, 0, 0.08, 0);
  put(g, soft(0.56, 0.08, 0.56), stone, 0, 0.2, 0);
  // the crossed legs, a wide soft roll, with a knee at each end
  put(g, capsule(0.12, 0.3), stone, 0, 0.33, 0.04).rotation.z = Math.PI / 2;
  for (const x of [-0.2, 0.2]) put(g, sph(0.12, 14), stone, x, 0.33, 0.1);
  // a body narrowing to the waist, under a line of shoulders
  const body = put(g, capsule(0.15, 0.18), stone, 0, 0.56, -0.03);
  body.scale.set(1.1, 1, 0.8);
  put(g, capsule(0.075, 0.26), stone, 0, 0.7, -0.04).rotation.z = Math.PI / 2;
  // arms falling from the shoulders to the hands, cupped in the lap
  for (const side of [-1, 1])
    put(g, capsule(0.055, 0.24), stone, side * 0.2, 0.53, 0.03).rotation.set(0.45, 0, side * 0.2);
  put(g, sph(0.07, 12), stone, 0, 0.42, 0.14).scale.set(1.5, 0.7, 1);
  put(g, capsule(0.05, 0.06), stone, 0, 0.78, -0.03);
  put(g, sph(0.13, 16), stone, 0, 0.92, -0.02);
  put(g, sph(0.055, 10), stone, 0, 1.06, -0.03);
  // the halo, standing up behind the head
  put(g, torus(0.2, 0.028), mat(0xd4a94a, 0.35), 0, 0.93, -0.14);
}
