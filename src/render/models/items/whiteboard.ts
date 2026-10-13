// The Whiteboard model.

import type * as THREE from 'three';

import { cyl, DARK, mat, put, rbox, torus, WHITE } from '../parts';

/** Build the Whiteboard model. */
export function buildWhiteboard(g: THREE.Group) {
  put(g, rbox(1.82, 1.04, 0.05, 0.03), mat(0x8d99ae), 0, 1.15, -0.29);
  put(g, rbox(1.7, 0.92, 0.04, 0.02), mat(WHITE, 0.35), 0, 1.15, -0.26);
  put(g, rbox(1.3, 0.04, 0.1, 0.02), mat(0x8d99ae), 0, 0.64, -0.22);
  for (const x of [-0.78, 0.78]) {
    put(g, cyl(0.03, 0.03, 1.6, 8), mat(0x8d99ae), x, 0.8, -0.3);
    put(g, rbox(0.08, 0.05, 0.5, 0.02), mat(DARK), x, 0.03, -0.3);
  }
  // a diagram of a shoulder with arrows pointing at it
  const blob = put(g, torus(0.17, 0.02), mat(0xe5484d), -0.4, 1.2, -0.235);
  blob.scale.y = 0.75;
  put(g, rbox(0.3, 0.025, 0.01, 0.005), mat(0x3f7fb5), -0.02, 1.3, -0.235).rotation.z = -0.5;
  put(g, rbox(0.3, 0.025, 0.01, 0.005), mat(0x3f7fb5), -0.02, 1.08, -0.235).rotation.z = 0.5;
  for (let i = 0; i < 4; i++)
    put(g, rbox(0.5 - (i % 2) * 0.14, 0.022, 0.01, 0.005), mat(DARK), 0.45 - (i % 2) * 0.07, 1.36 - i * 0.12, -0.235);
  put(g, rbox(0.1, 0.04, 0.06, 0.01), mat(0xe5484d), -0.3, 0.68, -0.22);
  put(g, rbox(0.1, 0.04, 0.06, 0.01), mat(0x3f7fb5), -0.1, 0.68, -0.22);
}
