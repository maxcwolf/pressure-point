// The Trash Can model.

import type * as THREE from 'three';

import { cyl, mat, put, torus } from '../parts';

/** Build the Trash Can model. */
export function buildBin(g: THREE.Group) {
  put(g, cyl(0.21, 0.16, 0.46), mat(0x6c7a89), 0, 0.23, 0);
  const rim = put(g, torus(0.21, 0.03), mat(0x57636f), 0, 0.46, 0);
  rim.rotation.x = Math.PI / 2;
  put(g, cyl(0.18, 0.18, 0.02), mat(0x23272e), 0, 0.455, 0);
}
