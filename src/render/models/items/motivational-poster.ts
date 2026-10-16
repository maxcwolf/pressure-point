// The Motivational Poster model.

import type * as THREE from 'three';

import { DARK, mat, put, rbox, sph, WHITE } from '../parts';
import { HANG_Y } from './wall';

/** Build the Motivational Poster model: a kitten hanging from a branch against a blue sky, over a line of caption. */
export function buildMotivationalPoster(g: THREE.Group) {
  const y = HANG_Y;
  put(g, rbox(0.46, 0.6, 0.02, 0.005), mat(DARK, 0.5), 0, y, 0.01);
  put(g, rbox(0.42, 0.56, 0.02, 0.005), mat(WHITE, 0.9), 0, y, 0.016);
  put(g, rbox(0.36, 0.38, 0.02, 0.004), mat(0x7cc4e8, 0.9), 0, y + 0.06, 0.02);
  // the branch, across the top of the picture
  put(g, rbox(0.34, 0.03, 0.02, 0.01), mat(0x7a5a3c, 0.9), 0, y + 0.2, 0.026).rotation.z = -0.08;
  // the kitten, clinging on by its front paws
  const fur = mat(0xf0a24a, 0.95);
  put(g, sph(0.055, 12), fur, 0.02, y + 0.06, 0.03).scale.set(1, 1.25, 0.4);
  put(g, sph(0.045, 12), fur, 0.02, y + 0.15, 0.032).scale.set(1, 1, 0.4);
  for (const x of [-0.015, 0.055]) put(g, rbox(0.018, 0.07, 0.01, 0.008), fur, x, y + 0.19, 0.034);
  // "Hang in there", as a bar of type under the picture
  put(g, rbox(0.26, 0.035, 0.01, 0.004), mat(DARK, 0.9), 0, y - 0.2, 0.024);
}
