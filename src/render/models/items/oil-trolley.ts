// The Oil Cart model.

import type * as THREE from 'three';

import { MEMBER_MIN, soft } from '../clay';
import { capsule, CHROME, cyl, DARK, mat, put, sph, WHITE } from '../parts';

/** The oils on the top shelf: amber and green glass, and a pink and a blue for the guest who wants a choice. */
const OILS = [0xc98a3a, 0x6f9e6b, 0xd99ab0, 0x86b0cf];

/** Build the Oil Cart model: two steel shelves on casters, oils on top and rolled towels below. */
export function buildOilTrolley(g: THREE.Group) {
  const steel = mat(CHROME, 0.35);
  for (const [x, z] of [
    [-0.26, -0.18],
    [0.26, -0.18],
    [-0.26, 0.18],
    [0.26, 0.18],
  ]) {
    put(g, soft(MEMBER_MIN, 0.68, MEMBER_MIN), steel, x, 0.42, z);
    put(g, sph(0.055, 12), mat(DARK), x, 0.055, z);
  }
  put(g, soft(0.64, 0.05, 0.48), steel, 0, 0.3, 0);
  put(g, soft(0.64, 0.05, 0.48), steel, 0, 0.74, 0);
  OILS.forEach((c, i) => {
    const x = -0.2 + i * 0.13;
    const z = -0.06 + (i % 2) * 0.12;
    put(g, cyl(0.05, 0.06, 0.2, 14), mat(c, 0.35), x, 0.86, z);
    put(g, cyl(0.025, 0.025, 0.06, 10), mat(DARK), x, 0.99, z);
  });
  // towels rolled up on the lower shelf
  for (let i = 0; i < 3; i++)
    put(g, capsule(0.07, 0.24), mat(WHITE, 0.85), -0.16 + i * 0.16, 0.395, 0).rotation.x = Math.PI / 2;
}
