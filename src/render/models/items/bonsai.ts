// The Bonsai model.

import type * as THREE from 'three';

import { cyl, ico, LACQUER, mat, put, rbox } from '../parts';

/** Each pad of foliage: where it sits on the branches and how big it is. */
const PADS: readonly (readonly [x: number, y: number, z: number, r: number])[] = [
  [0.02, 0.98, 0, 0.17],
  [-0.2, 0.84, 0.04, 0.13],
  [0.22, 0.8, -0.02, 0.12],
  [0.08, 0.86, 0.16, 0.1],
];

/** Build the Bonsai model. */
export function buildBonsai(g: THREE.Group) {
  put(g, rbox(0.6, 0.12, 0.42, 0.03), mat(LACQUER, 0.5), 0, 0.28, 0);
  put(g, rbox(0.5, 0.04, 0.32, 0.02), mat(0x6b5136), 0, 0.35, 0);
  put(g, rbox(0.62, 0.22, 0.46, 0.02), mat(0x8f5f38, 0.8), 0, 0.11, 0);
  const bark = mat(0x6b4f33, 0.9);
  // a trunk that leans one way and then the other, as bonsai do
  put(g, cyl(0.04, 0.06, 0.32, 8), bark, -0.04, 0.5, 0).rotation.z = 0.35;
  put(g, cyl(0.03, 0.04, 0.3, 8), bark, -0.02, 0.76, 0).rotation.z = -0.45;
  put(g, cyl(0.02, 0.025, 0.24, 6), bark, -0.12, 0.78, 0.02).rotation.z = 0.9;
  const leaf = mat(0x4f8f4a, 0.85);
  for (const [x, y, z, r] of PADS) put(g, ico(r), leaf, x, y, z).scale.y = 0.55;
}
