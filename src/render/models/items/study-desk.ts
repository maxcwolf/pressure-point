// The Study Desk model.

import type * as THREE from 'three';

import { chair, cyl, DARK, mat, put, rbox, WHITE, WOOD } from '../parts';

/** Build the Study Desk model. */
export function buildStudyDesk(g: THREE.Group) {
  put(g, rbox(0.84, 0.06, 0.54, 0.03), mat(WOOD), 0, 0.62, -0.02);
  for (const [x, z] of [
    [-0.36, -0.22],
    [0.36, -0.22],
    [-0.36, 0.18],
    [0.36, 0.18],
  ])
    put(g, cyl(0.03, 0.03, 0.6, 8), mat(DARK), x, 0.3, z);
  put(g, rbox(0.3, 0.05, 0.22, 0.02), mat(0x5f9440), -0.12, 0.68, 0);
  put(g, rbox(0.26, 0.04, 0.2, 0.02), mat(0xe76f51), -0.1, 0.725, 0.01).rotation.y = 0.3;
  put(g, cyl(0.045, 0.04, 0.1, 10), mat(WHITE, 0.4), 0.26, 0.7, -0.08);
  chair(g, 0, 0.82, 1, 0x5f9440);
}
