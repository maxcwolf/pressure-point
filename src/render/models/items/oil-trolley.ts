// The Oil Cart model.

import type * as THREE from 'three';

import { CHROME, cyl, DARK, mat, put, rbox, sph, WHITE } from '../parts';

/** Build the Oil Cart model. */
export function buildOilTrolley(g: THREE.Group) {
  for (const [x, z] of [
    [-0.26, -0.18],
    [0.26, -0.18],
    [-0.26, 0.18],
    [0.26, 0.18],
  ]) {
    put(g, cyl(0.02, 0.02, 0.66), mat(CHROME, 0.35), x, 0.4, z);
    put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
  }
  put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(CHROME, 0.35), 0, 0.3, 0);
  put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(CHROME, 0.35), 0, 0.72, 0);
  const colors = [0xd98e3a, 0x6fae6b, 0xe58fb0, 0x7fb6d9];
  colors.forEach((c, i) => {
    put(g, cyl(0.05, 0.06, 0.2), mat(c, 0.35), -0.2 + i * 0.13, 0.84, -0.06 + (i % 2) * 0.12);
    put(g, cyl(0.025, 0.025, 0.06), mat(DARK), -0.2 + i * 0.13, 0.97, -0.06 + (i % 2) * 0.12);
  });
  for (let i = 0; i < 3; i++) {
    const towel = put(g, cyl(0.07, 0.07, 0.36), mat(WHITE), -0.16 + i * 0.16, 0.39, 0);
    towel.rotation.x = Math.PI / 2;
  }
}
