// The Linen Hamper model.

import * as THREE from 'three';

import { cyl, mat, partsOf, put, rbox, torus } from '../parts';

/** Build the Linen Hamper model: a wicker basket with a stack of fresh towels on top and soiled ones heaped inside. */
export function buildLinenHamper(g: THREE.Group) {
  const wicker = mat(0xc49a5c, 0.95);
  put(g, cyl(0.3, 0.25, 0.62, 16), wicker, 0, 0.31, -0.1);
  for (const y of [0.12, 0.3, 0.48]) {
    const band = put(g, torus(0.285, 0.018), mat(0x9a7442, 0.95), 0, y, -0.1);
    band.rotation.x = Math.PI / 2;
  }
  const rim = put(g, torus(0.3, 0.03), mat(0x9a7442, 0.95), 0, 0.62, -0.1);
  rim.rotation.x = Math.PI / 2;
  // the soiled linens, rising out of the basket as it fills
  const heap = new THREE.Group();
  for (const [x, z, color] of [
    [-0.08, 0.04, 0xd8d0bf],
    [0.09, -0.05, 0xb9a1e0],
    [0, 0.08, 0xe8e2d4],
  ] as const) {
    const lump = put(heap, rbox(0.22, 0.12, 0.18, 0.06), mat(color, 0.95), x, 0, z);
    lump.rotation.y = x * 6;
  }
  heap.position.set(0, 0.2, -0.1);
  g.add(heap);
  partsOf(g).heap = heap;
  // a stack of fresh, folded towels on the floor in front of it
  for (let i = 0; i < 3; i++) put(g, rbox(0.3, 0.06, 0.14, 0.02), mat(0xf5ecdb, 0.9), 0, 0.03 + i * 0.065, 0.36);
}
