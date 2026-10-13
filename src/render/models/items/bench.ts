// The Bench model.

import type * as THREE from 'three';

import { DARK, mat, put, rbox, WOOD } from '../parts';

/** Build the Bench model. */
export function buildBench(g: THREE.Group) {
  put(g, rbox(1.9, 0.07, 0.5, 0.03), mat(WOOD), 0, 0.37, 0.05);
  put(g, rbox(1.9, 0.26, 0.06, 0.03), mat(WOOD), 0, 0.7, -0.2);
  for (const x of [-0.8, 0.8]) {
    put(g, rbox(0.08, 0.36, 0.5, 0.02), mat(DARK), x, 0.18, 0.05);
    put(g, rbox(0.08, 0.5, 0.06, 0.02), mat(DARK), x, 0.6, -0.2);
  }
}
