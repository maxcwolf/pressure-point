// The Bonsai model.

import type * as THREE from 'three';

import { capsule, cyl, LACQUER, mat, put, soft, sph } from '../parts';

/** Each pad of foliage: where it sits on the branches and how big it is. */
const PADS: readonly (readonly [x: number, y: number, z: number, r: number])[] = [
  [0.02, 0.98, 0, 0.17],
  [-0.2, 0.84, 0.04, 0.13],
  [0.22, 0.8, -0.02, 0.12],
  [0.08, 0.86, 0.16, 0.1],
];

/** Build the Bonsai model. */
export function buildBonsai(g: THREE.Group) {
  put(g, soft(0.6, 0.12, 0.42), mat(LACQUER, 0.5), 0, 0.28, 0);
  put(g, soft(0.5, 0.04, 0.32), mat(0x6b5136), 0, 0.35, 0);
  put(g, soft(0.62, 0.22, 0.46), mat(0x8f5f38, 0.8), 0, 0.11, 0);
  const bark = mat(0x6b4f33, 0.9);
  // a trunk that leans one way and then the other, as bonsai do
  put(g, cyl(0.045, 0.065, 0.32, 12), bark, -0.04, 0.5, 0).rotation.z = 0.35;
  put(g, cyl(0.032, 0.045, 0.3, 12), bark, -0.02, 0.76, 0).rotation.z = -0.45;
  put(g, capsule(0.025, 0.2), bark, -0.12, 0.78, 0.02).rotation.z = 0.9;
  const leaf = mat(0x4f8f4a, 0.85);
  // soft clouds of leaves, smooth like the park's trees
  for (const [x, y, z, r] of PADS) put(g, sph(r, 16), leaf, x, y, z).scale.y = 0.6;
}
