// The Pool Table model.

import type * as THREE from 'three';

import { capsule, cyl, DARK, mat, put, soft, sph, WHITE, WOOD, WOOD_DARK } from '../parts';

/** The balls left on the table: where each sits and its color. */
const BALLS: readonly (readonly [x: number, z: number, color: number])[] = [
  [0.45, 0.0, WHITE],
  [-0.3, 0.05, 0xe5484d],
  [-0.38, -0.05, 0xf2c14e],
  [-0.38, 0.12, 0x4a9fe0],
  [-0.46, 0.02, DARK],
  [0.1, -0.2, 0x3bb273],
];

/** Build the Pool Table model. */
export function buildPoolTable(g: THREE.Group) {
  for (const [x, z] of [
    [-0.8, -0.3],
    [0.8, -0.3],
    [-0.8, 0.3],
    [0.8, 0.3],
  ] as const)
    put(g, cyl(0.06, 0.05, 0.62), mat(WOOD_DARK), x, 0.31, z);
  put(g, soft(1.9, 0.14, 0.9), mat(WOOD_DARK), 0, 0.68, 0);
  put(g, soft(1.72, 0.03, 0.72), mat(0x3a8a5c, 0.9), 0, 0.76, 0);
  for (const x of [-0.86, 0, 0.86])
    for (const z of [-0.36, 0.36]) put(g, cyl(0.055, 0.055, 0.02), mat(DARK), x, 0.77, z);
  for (const [x, z, color] of BALLS) put(g, sph(0.045, 12), mat(color, 0.3), x, 0.82, z);
  put(g, capsule(0.025, 1.15), mat(WOOD), 0.15, 0.805, 0.27).rotation.z = Math.PI / 2;
}
