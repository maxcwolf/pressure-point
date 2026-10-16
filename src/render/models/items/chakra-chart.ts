// The Chakra Chart model.

import type * as THREE from 'three';

import { capsule, mat, put, rbox, sph, WHITE } from '../parts';
import { HANG_Y } from './wall';

/** The seven chakras, root to crown, in their colors. */
const CHAKRAS = [0xd8433f, 0xf08a3c, 0xf2cf3e, 0x5cb85c, 0x4aa3df, 0x4b5fc4, 0x9b59b6];

/** Build the Chakra Chart model: a pale figure sitting cross-legged, a glowing dot of each color up its middle. */
export function buildChakraChart(g: THREE.Group) {
  const y = HANG_Y;
  put(g, rbox(0.44, 0.62, 0.02, 0.005), mat(0x6b4a2e, 0.6), 0, y, 0.01);
  put(g, rbox(0.4, 0.58, 0.02, 0.004), mat(WHITE, 0.9), 0, y, 0.016);
  const figure = mat(0xc9d8ee, 0.9);
  put(g, sph(0.05, 12), figure, 0, y + 0.19, 0.024).scale.z = 0.3;
  put(g, capsule(0.06, 0.16), figure, 0, y + 0.03, 0.024).scale.z = 0.3;
  // crossed legs, as a broad base under the body
  put(g, rbox(0.26, 0.06, 0.01, 0.03), figure, 0, y - 0.11, 0.024);
  CHAKRAS.forEach((color, i) => {
    put(g, sph(0.016, 8), mat(color, 0.5, 0.35), 0, y - 0.09 + i * 0.047, 0.046).scale.z = 0.5;
  });
}
