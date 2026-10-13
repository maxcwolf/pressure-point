// The Chart Cabinet model.

import type * as THREE from 'three';

import { CHROME, cyl, mat, put, rbox, WHITE } from '../parts';

/** Build the Chart Cabinet model. */
export function buildCabinet(g: THREE.Group) {
  put(g, rbox(0.8, 1.1, 0.6, 0.05), mat(0x7fa0b8), 0, 0.55, -0.1);
  for (let i = 0; i < 3; i++) {
    put(g, rbox(0.66, 0.28, 0.04, 0.02), mat(0x9bb9cf), 0, 0.2 + i * 0.34, 0.2);
    put(g, rbox(0.2, 0.04, 0.04, 0.01), mat(CHROME, 0.4), 0, 0.2 + i * 0.34, 0.23);
  }
  const roll = put(g, cyl(0.05, 0.05, 0.6), mat(WHITE), 0, 1.15, -0.1);
  roll.rotation.z = Math.PI / 2;
}
