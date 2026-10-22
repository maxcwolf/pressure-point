// The Stretch Rack model.

import type * as THREE from 'three';

import { cyl, mat, put, soft, torus, WOOD, WOOD_DARK } from '../parts';

/** Build the Stretch Rack model. */
export function buildStretchRack(g: THREE.Group) {
  for (const x of [-0.37, 0.37]) put(g, soft(0.06, 1.2, 0.42), mat(WOOD_DARK), x, 0.6, -0.1);
  for (const y of [0.22, 0.6, 0.98]) put(g, soft(0.76, 0.04, 0.42), mat(WOOD), 0, y, -0.1);
  const rolls: [number, number, number, number][] = [
    [0.33, -0.18, 0x8a6fd1, 0.09],
    [0.33, 0, 0x2fa8a0, 0.09],
    [0.71, -0.16, 0xe76f51, 0.09],
    [0.71, 0.02, 0xe9c46a, 0.09],
    [1.1, -0.1, 0x4a9fe0, 0.1],
  ];
  for (const [y, z, c, r] of rolls) {
    const roll = put(g, cyl(r, r, 0.62, 14), mat(c, 0.85), 0, y, z);
    roll.rotation.z = Math.PI / 2;
  }
  for (const [y, c] of [
    [0.85, 0xe5484d],
    [0.62, 0x3bb273],
  ] as [number, number][]) {
    const band = put(g, torus(0.085, 0.024), mat(c), 0.42, y, 0);
    band.rotation.y = Math.PI / 2;
  }
}
