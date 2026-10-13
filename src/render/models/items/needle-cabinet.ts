// The Needle Cabinet model.

import type * as THREE from 'three';

import { CREAM, cyl, GLASS, LACQUER, mat, put, rbox, sph, WOOD } from '../parts';

/** Build the Needle Cabinet model. */
export function buildNeedleCabinet(g: THREE.Group) {
  put(g, rbox(0.88, 1.3, 0.5, 0.04), mat(LACQUER), 0, 0.65, -0.18);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const x = -0.3 + col * 0.2;
      const y = 0.2 + row * 0.23;
      put(g, rbox(0.17, 0.19, 0.03, 0.01), mat(WOOD), x, y, 0.075);
      put(g, sph(0.018, 6), mat(0xf2c14e, 0.4), x, y, 0.1);
    }
  }
  put(g, cyl(0.07, 0.07, 0.16, 12), GLASS, 0.24, 1.38, -0.18);
  const scroll = put(g, cyl(0.045, 0.045, 0.5, 10), mat(CREAM), -0.12, 1.35, -0.18);
  scroll.rotation.z = Math.PI / 2;
}
