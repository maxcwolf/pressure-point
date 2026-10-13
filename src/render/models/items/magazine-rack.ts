// The Magazine Rack model.

import type * as THREE from 'three';

import { at } from '../../../core/util';
import { mat, put, rbox, WOOD, WOOD_DARK } from '../parts';

/** Build the Magazine Rack model. */
export function buildMagazineRack(g: THREE.Group) {
  put(g, rbox(0.7, 0.9, 0.08, 0.03), mat(WOOD_DARK), 0, 0.5, -0.25);
  for (const x of [-0.33, 0.33]) put(g, rbox(0.05, 0.9, 0.4, 0.02), mat(WOOD_DARK), x, 0.5, -0.07);
  const covers = [0xe76f51, 0x5fa8d3, 0xe9c46a, 0x8ab17d, 0xb56576, 0xf4a261];
  for (let row = 0; row < 3; row++) {
    put(g, rbox(0.66, 0.04, 0.28, 0.01), mat(WOOD), 0, 0.2 + row * 0.28, -0.07);
    for (let c = 0; c < 2; c++) {
      const mag = put(
        g,
        rbox(0.26, 0.22, 0.03, 0.01),
        mat(at(covers, (row * 2 + c) % covers.length)),
        -0.15 + c * 0.3,
        0.33 + row * 0.28,
        -0.02,
      );
      mag.rotation.x = -0.25;
    }
  }
}
