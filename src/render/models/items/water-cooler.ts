// The Water Cooler model.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, WHITE } from '../parts';

/** Build the Water Cooler model. */
export function buildWaterCooler(g: THREE.Group) {
  const water = mat(0x7cc4e8, 0.15);
  put(g, rbox(0.42, 0.8, 0.42, 0.05), mat(WHITE), 0, 0.4, -0.1);
  put(g, cyl(0.05, 0.05, 0.08), water, 0, 0.84, -0.1);
  put(g, cyl(0.17, 0.17, 0.42, 20), water, 0, 1.08, -0.1);
  put(g, cyl(0.17, 0.12, 0.06, 20), water, 0, 1.32, -0.1);
  put(g, rbox(0.05, 0.06, 0.08, 0.01), mat(0x4a9fe0), -0.08, 0.62, 0.13);
  put(g, rbox(0.05, 0.06, 0.08, 0.01), mat(0xe5484d), 0.08, 0.62, 0.13);
  put(g, rbox(0.2, 0.02, 0.1, 0.01), mat(0x9aa3ad), 0, 0.5, 0.14);
  put(g, cyl(0.04, 0.04, 0.26), mat(WHITE, 0.4), 0.27, 0.55, -0.02);
}
