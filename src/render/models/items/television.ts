// The Television model.

import type * as THREE from 'three';

import { soft } from '../clay';
import { DARK, mat, put, sph } from '../parts';
import { HANG_Y } from './wall';

/** Build the Television model: a slim screen on a bracket, showing a hillside and a deer, as it always is. */
export function buildTelevision(g: THREE.Group) {
  const y = HANG_Y + 0.2;
  put(g, soft(0.2, 0.14, 0.04), mat(DARK, 0.5), 0, y, 0.02);
  put(g, soft(0.86, 0.52, 0.05), mat(0x22252b, 0.35), 0, y, 0.065);
  // the picture: sky over a green hill, lit from within
  put(g, soft(0.8, 0.26, 0.01), mat(0x7cc4e8, 0.4, 0.5), 0, y + 0.11, 0.092);
  put(g, soft(0.8, 0.2, 0.01), mat(0x6faa52, 0.4, 0.45), 0, y - 0.12, 0.092);
  put(g, sph(0.05, 10), mat(0xa9744a, 0.6, 0.3), 0.18, y - 0.06, 0.096).scale.set(1.3, 0.8, 0.2);
  put(g, soft(0.07, 0.02, 0.006), mat(0xf5ecdb, 0.6, 0.2), -0.3, y - 0.22, 0.098);
}
