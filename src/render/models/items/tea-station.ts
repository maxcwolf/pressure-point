// The Herbal Tea Station model.

import type * as THREE from 'three';

import { soft } from '../clay';
import { CREAM, cyl, DARK, mat, put, sph, WHITE } from '../parts';

/** Build the Herbal Tea Station model. */
export function buildTeaStation(g: THREE.Group) {
  put(g, soft(0.9, 0.8, 0.6), mat(0x5b8c6e), 0, 0.4, -0.12);
  put(g, soft(0.96, 0.06, 0.68), mat(CREAM), 0, 0.83, -0.12);
  put(g, cyl(0.16, 0.17, 0.34), mat(0xc77d4a, 0.35), -0.2, 1.03, -0.16);
  put(g, sph(0.15), mat(0xc77d4a, 0.35), -0.2, 1.2, -0.16);
  put(g, sph(0.04, 10), mat(DARK), -0.2, 1.36, -0.16);
  for (let i = 0; i < 3; i++)
    put(g, cyl(0.055, 0.045, 0.1), mat(WHITE, 0.4), 0.14 + (i % 2) * 0.16, 0.91, -0.22 + i * 0.12);
  put(g, soft(0.7, 0.3, 0.04), mat(0x3f6b52), 0, 0.42, 0.19);
}
