// The Study Desk model.

import type * as THREE from 'three';

import { clay, MEMBER } from '../clay';
import { chair, cyl, DARK, mat, put, WHITE, WOOD } from '../parts';

/** Build the Study Desk model: a wooden desk on square legs with books and a mug on it, and a chair pulled up. */
export function buildStudyDesk(g: THREE.Group) {
  put(g, clay(0.86, 0.07, 0.56), mat(WOOD), 0, 0.62, -0.02);
  for (const [x, z] of [
    [-0.36, -0.24],
    [0.36, -0.24],
    [-0.36, 0.18],
    [0.36, 0.18],
  ])
    put(g, clay(MEMBER, 0.6, MEMBER), mat(DARK), x, 0.3, z);
  put(g, clay(0.3, 0.05, 0.22), mat(0x5f9440), -0.12, 0.68, 0);
  put(g, clay(0.26, 0.04, 0.2), mat(0xe76f51), -0.1, 0.725, 0.01).rotation.y = 0.3;
  put(g, cyl(0.045, 0.04, 0.1, 12), mat(WHITE, 0.4), 0.26, 0.705, -0.08);
  chair(g, 0, 0.82, 1, 0x5f9440);
}
