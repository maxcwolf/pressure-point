// The Reception Desk model.

import type * as THREE from 'three';

import { clay } from '../clay';
import { CREAM, cyl, DARK, mat, put, sph, WOOD } from '../parts';

/** Build the Reception Desk model: a cream desk under a wooden top, the center's teal band and gold logo on its front. */
export function buildReceptionDesk(g: THREE.Group) {
  put(g, clay(2.8, 0.84, 0.66), mat(CREAM), 0, 0.42, 0);
  put(g, clay(2.92, 0.08, 0.8), mat(WOOD), 0, 0.88, 0);
  put(g, clay(2.3, 0.26, 0.04), mat(0x2fa8a0), 0, 0.46, 0.33);
  const gold = mat(0xf2c14e, 0.4);
  const logo = put(g, cyl(0.19, 0.19, 0.05, 24), gold, 0, 0.46, 0.35);
  logo.rotation.x = Math.PI / 2;
  // a screen for the receptionist, a bell for the guests, and a little plant
  put(g, clay(0.44, 0.3, 0.05), mat(DARK), -0.75, 1.14, -0.12);
  put(g, cyl(0.04, 0.06, 0.12, 12), mat(DARK), -0.75, 0.97, -0.12);
  put(g, sph(0.07, 14), gold, 0.55, 0.96, 0.18).scale.y = 0.8;
  put(g, cyl(0.09, 0.07, 0.14), mat(0xc8744f), 1.12, 1.0, 0);
  put(g, sph(0.15, 14), mat(0x5fae5a, 0.8), 1.12, 1.2, 0);
}
