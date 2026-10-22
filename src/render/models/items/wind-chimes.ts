// The Wind Chimes model.

import type * as THREE from 'three';

import { capsule, cyl, mat, MEMBER_MIN, MEMBER_TALL, partsOf, put, WOOD_DARK } from '../parts';

/** Build the Wind Chimes model: a little wooden gallows on a base, with brass tubes hanging from a disc that sway. */
export function buildWindChimes(g: THREE.Group) {
  const wood = mat(WOOD_DARK, 0.7);
  const top = 1.22;
  put(g, cyl(0.2, 0.23, 0.06), wood, 0, 0.03, 0);
  put(g, cyl(MEMBER_TALL / 2, MEMBER_TALL / 2 + 0.008, top), wood, -0.16, top / 2, 0);
  // the arm ends in the air, so its end is rounded
  put(g, capsule(MEMBER_MIN / 2, 0.3), wood, 0, top, 0).rotation.z = Math.PI / 2;
  const cord = mat(0xd9d2c5);
  put(g, cyl(0.01, 0.01, 0.08), cord, 0.1, top - 0.06, 0);
  put(g, cyl(0.11, 0.11, 0.03), wood, 0.1, top - 0.1, 0);
  const brass = mat(0xd4a94a, 0.3);
  const tubes: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const len = 0.26 + (i % 3) * 0.07;
    // each tube hangs from its top, so it swings from there
    const pivot = put(g, cyl(0.01, 0.01, 0.04), cord, 0.1 + Math.cos(a) * 0.075, top - 0.13, Math.sin(a) * 0.075);
    put(pivot, cyl(0.022, 0.022, len, 12), brass, 0, -0.02 - len / 2, 0);
    tubes.push(pivot);
  }
  // the striker in the middle, and the sail below it that catches the wind
  put(g, cyl(0.01, 0.01, 0.34), cord, 0.1, top - 0.3, 0);
  put(g, cyl(0.045, 0.045, 0.02, 14), wood, 0.1, top - 0.3, 0);
  put(g, cyl(0.06, 0.06, 0.015, 14), mat(0x7cc4e8, 0.4), 0.1, top - 0.5, 0).rotation.x = Math.PI / 2;
  partsOf(g).chimes = tubes;
}
