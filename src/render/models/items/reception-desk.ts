// The Reception Desk model.

import type * as THREE from 'three';

import { CREAM, cyl, DARK, ico, mat, put, rbox, sph } from '../parts';

/** Build the Reception Desk model. */
export function buildReceptionDesk(g: THREE.Group) {
  put(g, rbox(2.8, 0.84, 0.66, 0.08), mat(CREAM), 0, 0.42, 0);
  put(g, rbox(2.92, 0.09, 0.8, 0.04), mat(0x2fa8a0), 0, 0.88, 0);
  put(g, rbox(2.3, 0.26, 0.04, 0.02), mat(0x2fa8a0), 0, 0.46, 0.33);
  const logo = put(g, cyl(0.19, 0.19, 0.05, 24), mat(0xf2c14e, 0.5), 0, 0.46, 0.35);
  logo.rotation.x = Math.PI / 2;
  put(g, rbox(0.42, 0.3, 0.05, 0.02), mat(DARK), -0.75, 1.14, -0.12);
  put(g, cyl(0.03, 0.05, 0.1), mat(DARK), -0.75, 0.97, -0.12);
  put(g, sph(0.07), mat(0xf2c14e, 0.35), 0.55, 0.96, 0.18);
  put(g, cyl(0.09, 0.07, 0.14), mat(0xc8744f), 1.12, 1.0, 0);
  put(g, ico(0.15), mat(0x5fae5a), 1.12, 1.2, 0);
}
