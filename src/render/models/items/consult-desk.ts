// The Consultation Desk model.

import type * as THREE from 'three';

import { chair, cyl, DARK, mat, put, rbox, WHITE, WOOD, WOOD_DARK } from '../parts';

/** Build the Consultation Desk model. */
export function buildConsultDesk(g: THREE.Group) {
  put(g, rbox(1.8, 0.66, 0.72, 0.06), mat(WOOD_DARK), 0, 0.33, 0);
  put(g, rbox(1.9, 0.08, 0.82, 0.04), mat(WOOD), 0, 0.7, 0);
  put(g, rbox(0.5, 0.34, 0.05, 0.02), mat(DARK), 0.45, 1.0, -0.05);
  put(g, cyl(0.03, 0.06, 0.12), mat(DARK), 0.45, 0.8, -0.05);
  put(g, rbox(0.3, 0.02, 0.4, 0.01), mat(WHITE), -0.5, 0.75, 0.05);
  put(g, cyl(0.05, 0.04, 0.12), mat(0xe76f51), 0.05, 0.8, 0.2);
  chair(g, -0.5, -0.88, -1, 0x3f7fb5);
  chair(g, -0.5, 0.88, 1, 0xe9a23b);
}
