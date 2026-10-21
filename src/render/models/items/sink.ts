// The Sink model.

import type * as THREE from 'three';

import { CHROME, cyl, mat, put, rbox, WHITE } from '../parts';

/** Build the Sink model. */
export function buildSink(g: THREE.Group) {
  put(g, rbox(0.8, 1.7, 0.06, 0.02), mat(0x8fd3c1), 0, 0.85, -0.45);
  put(g, rbox(0.5, 0.56, 0.03, 0.02), mat(0xcfeaf5, 0.15), 0, 1.3, -0.41);
  put(g, cyl(0.09, 0.12, 0.7), mat(WHITE, 0.3), 0, 0.35, -0.18);
  put(g, rbox(0.62, 0.16, 0.46, 0.06), mat(WHITE, 0.3), 0, 0.78, -0.16);
  put(g, cyl(0.025, 0.025, 0.16, 10), mat(CHROME, 0.3), 0, 0.92, -0.34);
  put(g, cyl(0.022, 0.022, 0.12, 10), mat(CHROME, 0.3), 0, 0.99, -0.29).rotation.x = Math.PI / 2;
}
