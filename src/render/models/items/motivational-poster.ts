// The Motivational Poster model.

import type * as THREE from 'three';

import { DARK, mat, put, rbox, sph, WHITE } from '../parts';
import { HANG_Y } from './wall';

/**
 * Build the Motivational Poster model: a big orange kitten hanging from a branch against a square of blue sky, over a
 * line of caption.
 */
export function buildMotivationalPoster(g: THREE.Group) {
  const y = HANG_Y;
  put(g, rbox(0.6, 0.8, 0.03, 0.008), mat(DARK, 0.5), 0, y, 0.015);
  put(g, rbox(0.53, 0.73, 0.012, 0.004), mat(WHITE, 0.9), 0, y, 0.034);
  put(g, rbox(0.46, 0.5, 0.012, 0.004), mat(0x7cc4e8, 0.9), 0, y + 0.07, 0.038);
  // the branch, across the top of the picture
  put(g, rbox(0.44, 0.045, 0.012, 0.012), mat(0x7a5a3c, 0.9), 0, y + 0.26, 0.046).rotation.z = -0.08;
  // the kitten, clinging on by its front paws
  const fur = mat(0xf0a24a, 0.95);
  put(g, sph(0.085, 14), fur, 0.02, y + 0.03, 0.05).scale.set(1, 1.25, 0.4);
  put(g, sph(0.07, 14), fur, 0.02, y + 0.17, 0.054).scale.set(1, 1, 0.4);
  for (const x of [-0.035, 0.075]) put(g, rbox(0.028, 0.1, 0.012, 0.012), fur, x, y + 0.23, 0.058);
  for (const x of [-0.025, 0.065]) put(g, sph(0.03, 10), fur, x, y + 0.24, 0.054).scale.z = 0.4;
  // "Hang in there", as a bar of type under the picture
  put(g, rbox(0.36, 0.05, 0.012, 0.006), mat(DARK, 0.9), 0, y - 0.26, 0.04);
}
