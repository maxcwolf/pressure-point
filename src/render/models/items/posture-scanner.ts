// The Posture Scanner model.

import type * as THREE from 'three';

import { CHROME, cyl, DARK, mat, partsOf, put, rbox, torus } from '../parts';

/** Build the Posture Scanner model. */
export function buildPostureScanner(g: THREE.Group) {
  // console on the left tile, scanning platform on the right
  put(g, rbox(0.7, 0.9, 0.5, 0.06), mat(0x4f66b0), -0.5, 0.45, -0.15);
  const screen = put(g, rbox(0.56, 0.36, 0.05, 0.02), mat(0x9fe8ff, 0.3, 0.5), -0.5, 1.0, 0.02);
  screen.rotation.x = -0.35;
  put(g, rbox(0.5, 0.04, 0.2, 0.02), mat(DARK), -0.5, 0.92, 0.22);
  put(g, cyl(0.42, 0.45, 0.08, 28), mat(0x8d99ae, 0.5), 0.5, 0.04, 0);
  put(g, cyl(0.36, 0.36, 0.02, 28), mat(0x9fe8ff, 0.3, 0.35), 0.5, 0.09, 0);
  for (const x of [0.08, 0.92]) put(g, cyl(0.035, 0.035, 1.5, 10), mat(CHROME, 0.3), x, 0.75, -0.3);
  put(g, rbox(0.9, 0.07, 0.07, 0.02), mat(CHROME, 0.3), 0.5, 1.5, -0.3);
  // the ring sweeps up and down while a scan is running
  const ring = put(g, torus(0.4, 0.03), mat(0x4aa8ff, 0.3, 0.9), 0.5, 0.8, 0);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  partsOf(g).ring = ring;
}
