// The Reception Desk model.

import type * as THREE from 'three';

import { CHROME, CREAM, cyl, DARK, joined, mat, partsOf, put, soft, sph, WOOD } from '../parts';

/** The most slips the spike holds, one for each complaint still waiting for an answer. */
export const SLIPS = 5;

/** The pink of a complaint slip. */
const SLIP_PINK = 0xff7aa8;

/**
 * Build the Reception Desk model: a cream desk under a wooden top, the center's teal band and gold logo on its front,
 * and a spike at one end with a pink slip on it for each complaint waiting for an answer.
 */
export function buildReceptionDesk(g: THREE.Group) {
  put(g, soft(2.8, 0.84, 0.66), mat(CREAM), 0, 0.42, 0);
  put(g, soft(2.92, 0.08, 0.8), mat(WOOD), 0, 0.88, 0);
  put(g, soft(2.3, 0.26, 0.04), mat(0x2fa8a0), 0, 0.46, 0.33);
  const gold = mat(0xf2c14e, 0.4);
  const logo = put(g, cyl(0.19, 0.19, 0.05, 24), gold, 0, 0.46, 0.35);
  logo.rotation.x = Math.PI / 2;
  // a screen and keyboard where the receptionist stands, at the middle behind the desk, the screen turned to them so the
  // camera sees its pale back; a bell for the guests, and a little plant
  put(g, soft(0.4, 0.26, 0.05), mat(0xd9dde3, 0.5), 0.12, 1.12, -0.14).rotation.y = 0.25;
  put(g, cyl(0.04, 0.06, 0.12, 12), mat(DARK), 0.12, 0.97, -0.14);
  put(g, soft(0.34, 0.025, 0.12), mat(DARK), -0.02, 0.935, -0.33);
  put(g, sph(0.07, 14), gold, 0.55, 0.96, 0.18).scale.y = 0.8;
  put(g, cyl(0.09, 0.07, 0.14), mat(0xc8744f), 1.12, 1.0, 0);
  put(g, sph(0.15, 14), mat(0x5fae5a, 0.8), 1.12, 1.2, 0);
  // the spike, a steel pin on a round foot, at the end of the desk away from the plant; the slips go on it from the
  // bottom up, each turned a little from the last, so a fat stack reads as a bad week
  const spike = put(
    g,
    joined('complaint spike', [
      [cyl(0.06, 0.07, 0.025, 16), 0, 0.0125, 0],
      [cyl(0.007, 0.009, 0.32, 8), 0, 0.185, 0],
    ]),
    mat(CHROME, 0.3),
    -1.05,
    0.92,
    0.1,
  );
  spike.castShadow = false;
  const pink = mat(SLIP_PINK, 0.85);
  partsOf(g).slips = Array.from({ length: SLIPS }, (_, i) => {
    const slip = put(g, soft(0.28, 0.008, 0.2), pink, -1.05, 0.95 + i * 0.04, 0.1);
    slip.rotation.set(0.12 * (i % 2 ? 1 : -1), 0.5 + i * 0.7, 0.08 * (i % 3 ? 1 : -1));
    slip.castShadow = false;
    return slip;
  });
}
