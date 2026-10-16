// The Meridian Poster model.

import type * as THREE from 'three';

import { capsule, CREAM, DARK, mat, put, rbox, sph } from '../parts';
import { HANG_Y } from './wall';

/** Build the Meridian Poster model: a standing figure on cream paper, red lines running down it dotted with points. */
export function buildMeridianPoster(g: THREE.Group) {
  const y = HANG_Y;
  put(g, rbox(0.44, 0.62, 0.02, 0.005), mat(DARK, 0.5), 0, y, 0.01);
  put(g, rbox(0.4, 0.58, 0.02, 0.004), mat(CREAM, 0.9), 0, y, 0.016);
  const skin = mat(0xe8c4a0, 0.9);
  put(g, sph(0.04, 12), skin, 0, y + 0.21, 0.024).scale.z = 0.3;
  put(g, capsule(0.055, 0.14), skin, 0, y + 0.07, 0.024).scale.z = 0.3;
  for (const x of [-0.035, 0.035]) put(g, rbox(0.04, 0.2, 0.01, 0.015), skin, x, y - 0.14, 0.024);
  for (const x of [-0.09, 0.09]) put(g, rbox(0.03, 0.18, 0.01, 0.012), skin, x, y + 0.06, 0.024).rotation.z = x * 2;
  // the meridians, and the points along them
  const red = mat(0xc0392b, 0.6);
  for (const x of [-0.035, 0.035]) put(g, rbox(0.004, 0.46, 0.004, 0.001), red, x, y + 0.01, 0.031);
  for (let i = 0; i < 6; i++)
    for (const x of [-0.035, 0.035]) put(g, sph(0.008, 6), red, x, y - 0.2 + i * 0.08, 0.032).scale.z = 0.5;
}
