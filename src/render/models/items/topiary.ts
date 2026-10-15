// The Topiary model.

import type * as THREE from 'three';

import { cyl, ico, mat, put } from '../parts';

/** Build the Topiary model: a stone urn, a bare stem, and a bay tree clipped into three spheres up it. */
export function buildTopiary(g: THREE.Group) {
  const stone = mat(0xd9d2c5, 0.9);
  put(g, cyl(0.17, 0.26, 0.08), stone, 0, 0.04, 0);
  put(g, cyl(0.24, 0.14, 0.3), stone, 0, 0.23, 0);
  put(g, cyl(0.27, 0.27, 0.05), stone, 0, 0.4, 0);
  put(g, cyl(0.025, 0.035, 1.05), mat(0x6b4f33, 0.9), 0, 0.92, 0);
  const leaf = mat(0x3f7f45, 0.85);
  for (const [y, r] of [
    [0.68, 0.24],
    [1.08, 0.19],
    [1.4, 0.14],
  ] as const)
    put(g, ico(r), leaf, 0, y, 0);
}
