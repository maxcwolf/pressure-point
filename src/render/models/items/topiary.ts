// The Topiary model.

import type * as THREE from 'three';

import { MEMBER_MIN } from '../clay';
import { cyl, mat, put, sph } from '../parts';

/** Build the Topiary model: a stone urn, a bare stem, and a bay tree clipped into three balls up it. */
export function buildTopiary(g: THREE.Group) {
  const stone = mat(0xd9d2c5, 0.9);
  put(g, cyl(0.17, 0.24, 0.08), stone, 0, 0.04, 0);
  put(g, cyl(0.24, 0.15, 0.24), stone, 0, 0.2, 0);
  put(g, cyl(0.27, 0.27, 0.05), stone, 0, 0.34, 0);
  put(g, cyl(MEMBER_MIN / 2, MEMBER_MIN / 2 + 0.01, 0.7), mat(0x6b4f33, 0.9), 0, 0.7, 0);
  const leaf = mat(0x3f7f45, 0.85);
  for (const [y, r] of [
    [0.58, 0.21],
    [0.86, 0.16],
    [1.06, 0.11],
  ] as const)
    put(g, sph(r, 18), leaf, 0, y, 0);
}
