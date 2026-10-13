// The Zen Fountain model.

import type * as THREE from 'three';

import { cyl, mat, partsOf, put, sph } from '../parts';

/** Build the Zen Fountain model. */
export function buildFountain(g: THREE.Group) {
  const stone = mat(0xbdb6aa, 0.9);
  const water = mat(0x6ec6e6, 0.15, 0.25);
  put(g, cyl(0.44, 0.46, 0.24, 24), stone, 0, 0.12, 0);
  put(g, cyl(0.37, 0.37, 0.02, 24), water, 0, 0.245, 0);
  put(g, cyl(0.08, 0.11, 0.5), stone, 0, 0.45, 0);
  put(g, cyl(0.24, 0.1, 0.12, 24), stone, 0, 0.72, 0);
  put(g, cyl(0.2, 0.2, 0.02, 24), water, 0, 0.785, 0);
  const orb = put(g, sph(0.09), water, 0, 0.9, 0);
  partsOf(g).orb = orb;
}
