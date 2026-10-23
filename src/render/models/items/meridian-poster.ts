// The Meridian Poster model.

import type * as THREE from 'three';

import { capsule, CREAM, DARK, mat, put, rbox, sph } from '../parts';
import { HANG_Y } from './wall';

/**
 * Build the Meridian Poster model: a figure standing with arms and legs spread on cream paper, so its star of a
 * silhouette fills the sheet, with red lines running down it dotted with points.
 */
export function buildMeridianPoster(g: THREE.Group) {
  const y = HANG_Y;
  put(g, rbox(0.6, 0.8, 0.03, 0.008), mat(DARK, 0.5), 0, y, 0.015);
  put(g, rbox(0.53, 0.73, 0.012, 0.004), mat(CREAM, 0.9), 0, y, 0.034);
  const skin = mat(0xe8c4a0, 0.9);
  put(g, sph(0.065, 14), skin, 0, y + 0.25, 0.042).scale.z = 0.3;
  put(g, capsule(0.085, 0.18), skin, 0, y + 0.06, 0.042).scale.z = 0.3;
  for (const s of [-1, 1]) {
    put(g, rbox(0.065, 0.3, 0.012, 0.03), skin, s * 0.07, y - 0.19, 0.042).rotation.z = s * 0.2;
    put(g, rbox(0.05, 0.25, 0.012, 0.025), skin, s * 0.14, y + 0.09, 0.042).rotation.z = s * 0.9;
  }
  // the meridians, down each side of the body and along each arm, and the points along them
  const red = mat(0xc0392b, 0.6);
  for (const s of [-1, 1]) {
    put(g, rbox(0.016, 0.5, 0.004, 0.002), red, s * 0.04, y - 0.03, 0.05).rotation.z = s * 0.08;
    put(g, rbox(0.014, 0.22, 0.004, 0.002), red, s * 0.14, y + 0.09, 0.05).rotation.z = s * 0.9;
    // the points sit on the line, which leans out toward the feet
    for (let i = 0; i < 5; i++)
      put(g, sph(0.018, 8), red, s * (0.057 - i * 0.008), y - 0.24 + i * 0.1, 0.052).scale.z = 0.5;
  }
}
