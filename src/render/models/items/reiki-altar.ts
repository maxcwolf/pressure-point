// The Reiki Altar model.

import type * as THREE from 'three';

import { CREAM, cyl, mat, put, rbox, sph, WOOD_DARK } from '../parts';

/** Build the Reiki Altar model. */
export function buildReikiAltar(g: THREE.Group) {
  put(g, rbox(0.86, 0.62, 0.48, 0.04), mat(WOOD_DARK), 0, 0.31, -0.16);
  put(g, rbox(0.9, 0.04, 0.52, 0.02), mat(0x7a5aa8), 0, 0.64, -0.16);
  // candles, the tallest lit
  for (const [x, h] of [
    [-0.32, 0.18],
    [-0.22, 0.12],
  ] as const) {
    put(g, cyl(0.04, 0.04, h, 14), mat(CREAM), x, 0.66 + h / 2, -0.1);
    put(g, sph(0.026, 10), mat(0xffb347, 0.4, 1.6), x, 0.69 + h, -0.1).scale.y = 1.5;
  }
  // a crystal on a little stand, and a framed photo
  put(g, cyl(0.06, 0.07, 0.04, 10), mat(WOOD_DARK), 0.04, 0.68, -0.14);
  put(g, cyl(0.002, 0.05, 0.2, 6), mat(0xd9c8f5, 0.2, 0.4), 0.04, 0.8, -0.14);
  put(g, rbox(0.2, 0.26, 0.03, 0.01), mat(0xc9963f, 0.4), 0.28, 0.79, -0.3);
  put(g, rbox(0.15, 0.2, 0.01, 0.005), mat(0xa9c4d8), 0.28, 0.79, -0.285);
}
