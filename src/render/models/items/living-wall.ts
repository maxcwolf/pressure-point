// The Living Wall model.

import type * as THREE from 'three';

import { mat, partsOf, put, rbox, sph, WOOD_DARK } from '../parts';
import { HANG_Y } from './wall';

/** Build the Living Wall model: a wooden frame packed with moss and ferns, which brown as it dries out. */
export function buildLivingWall(g: THREE.Group) {
  const y = HANG_Y + 0.05;
  put(g, rbox(0.84, 0.8, 0.06, 0.02), mat(WOOD_DARK, 0.7), 0, y, 0.03);
  const moss = mat(0x5f9e4a, 0.95);
  put(g, rbox(0.74, 0.7, 0.04, 0.02), moss, 0, y, 0.05);
  // ferns and tufts standing out of the moss, in a pattern that looks like none
  const spots = [
    [-0.25, 0.22, 0.09],
    [0.05, 0.25, 0.07],
    [0.27, 0.16, 0.08],
    [-0.12, 0.02, 0.1],
    [0.18, -0.05, 0.09],
    [-0.28, -0.17, 0.07],
    [0.02, -0.22, 0.08],
    [0.28, -0.25, 0.06],
  ] as const;
  for (const [x, dy, r] of spots) put(g, sph(r, 10), moss, x, y + dy, 0.07).scale.z = 0.45;
  partsOf(g).moss = moss;
}
