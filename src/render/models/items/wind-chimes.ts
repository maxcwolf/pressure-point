// The Wind Chimes model.

import type * as THREE from 'three';

import { cyl, mat, partsOf, put, WOOD_DARK } from '../parts';

/** Build the Wind Chimes model: a little wooden gallows on a base, with brass tubes hanging from a disc that sway. */
export function buildWindChimes(g: THREE.Group) {
  const wood = mat(WOOD_DARK, 0.7);
  put(g, cyl(0.2, 0.22, 0.05), wood, 0, 0.025, 0);
  put(g, cyl(0.025, 0.03, 1.6), wood, -0.14, 0.82, 0);
  const arm = put(g, cyl(0.02, 0.02, 0.32), wood, 0.01, 1.6, 0);
  arm.rotation.z = Math.PI / 2;
  put(g, cyl(0.004, 0.004, 0.12), mat(0xd9d2c5), 0.1, 1.54, 0);
  put(g, cyl(0.09, 0.09, 0.02), mat(0x7a5a3c, 0.6), 0.1, 1.47, 0);
  const brass = mat(0xd4a94a, 0.3);
  const tubes: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const len = 0.22 + (i % 3) * 0.06;
    // each tube hangs from its top, so it swings from there
    const pivot = put(g, cyl(0.003, 0.003, 0.04), mat(0xd9d2c5), 0.1 + Math.cos(a) * 0.065, 1.44, Math.sin(a) * 0.065);
    put(pivot, cyl(0.014, 0.014, len, 10), brass, 0, -0.02 - len / 2, 0);
    tubes.push(pivot);
  }
  put(g, cyl(0.002, 0.002, 0.3), mat(0xd9d2c5), 0.1, 1.3, 0);
  put(g, cyl(0.035, 0.035, 0.012), mat(0x7cc4e8, 0.4), 0.1, 1.14, 0).rotation.x = Math.PI / 2;
  partsOf(g).chimes = tubes;
}
