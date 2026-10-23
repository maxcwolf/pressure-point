// The Chakra Chart model.

import type * as THREE from 'three';

import { capsule, mat, put, rbox, sph } from '../parts';
import { HANG_Y } from './wall';

/** The seven chakras, root to crown, in their colors. */
const CHAKRAS = [0xd8433f, 0xf08a3c, 0xf2cf3e, 0x5cb85c, 0x4aa3df, 0x4b5fc4, 0x9b59b6];

/**
 * Build the Chakra Chart model: a pale figure sitting cross-legged on a night-blue sheet, a column of seven glowing
 * dots up its middle, the only dark chart on a wall and the only rainbow.
 */
export function buildChakraChart(g: THREE.Group) {
  const y = HANG_Y;
  put(g, rbox(0.6, 0.8, 0.03, 0.008), mat(0x6b4a2e, 0.6), 0, y, 0.015);
  put(g, rbox(0.53, 0.73, 0.012, 0.004), mat(0x2f3a5e, 0.9), 0, y, 0.034);
  const figure = mat(0xc9d8ee, 0.9);
  put(g, sph(0.065, 14), figure, 0, y + 0.25, 0.042).scale.z = 0.3;
  put(g, capsule(0.085, 0.2), figure, 0, y + 0.05, 0.042).scale.z = 0.3;
  // crossed legs, as a broad base under the body
  put(g, rbox(0.4, 0.1, 0.012, 0.05), figure, 0, y - 0.17, 0.042);
  CHAKRAS.forEach((color, i) => {
    put(g, sph(0.03, 10), mat(color, 0.5, 0.35), 0, y - 0.13 + i * 0.065, 0.058).scale.z = 0.5;
  });
}
