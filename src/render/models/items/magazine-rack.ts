// The Magazine Rack model.

import type * as THREE from 'three';

import { at } from '../../../core/util';
import { CREAM, mat, put, rbox, soft } from '../parts';

/** Build the Magazine Rack model: a cream-painted stand of slanted shelves, its covers facing out like a newsstand's. */
export function buildMagazineRack(g: THREE.Group) {
  const paint = mat(CREAM, 0.6);
  put(g, soft(0.72, 0.9, 0.08), paint, 0, 0.5, -0.25);
  for (const x of [-0.33, 0.33]) put(g, soft(0.06, 0.9, 0.4), paint, x, 0.5, -0.07);
  const covers = [0xe76f51, 0x5fa8d3, 0xe9c46a, 0x8ab17d, 0xb56576, 0xf4a261];
  for (let row = 0; row < 3; row++) {
    put(g, soft(0.6, 0.04, 0.28), paint, 0, 0.2 + row * 0.28, -0.07);
    for (let c = 0; c < 2; c++) {
      const mag = put(
        g,
        rbox(0.28, 0.25, 0.03, 0.01),
        mat(at(covers, (row * 2 + c) % covers.length)),
        -0.15 + c * 0.3,
        0.33 + row * 0.28,
        -0.02,
      );
      mag.rotation.x = -0.25;
    }
  }
}
