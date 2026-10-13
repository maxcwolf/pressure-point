// The Massage Table model.

import * as THREE from 'three';

import { CREAM, cyl, mat, partsOf, put, rbox, sph, torus, WOOD, WOOD_DARK } from '../parts';

/** Build the Massage Table model. */
export function buildMassageTable(g: THREE.Group) {
  for (const [x, z] of [
    [-0.3, -0.75],
    [0.3, -0.75],
    [-0.3, 0.75],
    [0.3, 0.75],
  ])
    put(g, cyl(0.045, 0.045, 0.5), mat(WOOD_DARK), x, 0.25, z);
  put(g, rbox(0.78, 0.06, 1.8, 0.03), mat(WOOD), 0, 0.5, 0);
  put(g, rbox(0.74, 0.12, 1.76, 0.06), mat(CREAM), 0, 0.58, 0);
  put(g, rbox(0.76, 0.03, 0.6, 0.015), mat(0xb9a1e0), 0, 0.645, 0.5);
  const cradle = put(g, torus(0.13, 0.055), mat(CREAM), 0, 0.58, -1.0);
  cradle.rotation.x = Math.PI / 2;
  // hot stones, shown along the guest's back during a Hot Stone session
  const stones = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const stone = put(stones, sph(0.075, 10), mat(0x2f3136, 0.55), i % 2 ? 0.03 : -0.03, 0.95, -0.2 + i * 0.15);
    stone.scale.y = 0.5;
  }
  stones.visible = false;
  g.add(stones);
  // props laid on the guest during a session, keyed by the modality that uses them
  partsOf(g).session = { stone: stones };
}
