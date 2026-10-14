// The Fire Extinguisher model.

import type * as THREE from 'three';

import { capsule, cyl, DARK, mat, put, rbox, sph } from '../parts';

/** Build the Fire Extinguisher model. */
export function buildFireExtinguisher(g: THREE.Group) {
  const red = mat(0xd7263d, 0.4);
  put(g, cyl(0.13, 0.14, 0.05), mat(DARK), 0, 0.025, 0);
  put(g, cyl(0.1, 0.1, 0.5, 18), red, 0, 0.32, 0);
  put(g, sph(0.1, 16), red, 0, 0.57, 0);
  put(g, cyl(0.03, 0.03, 0.08), mat(DARK), 0, 0.68, 0);
  put(g, rbox(0.16, 0.03, 0.04, 0.01), mat(DARK), 0.05, 0.72, 0);
  const hose = put(g, capsule(0.018, 0.3), mat(DARK), 0.12, 0.45, 0.03);
  hose.rotation.z = 0.15;
  put(g, rbox(0.14, 0.1, 0.01, 0.01), mat(0xfbfaf6, 0.5), 0, 0.33, 0.1);
}
