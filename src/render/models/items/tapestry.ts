// The Tapestry model.

import type * as THREE from 'three';

import { soft } from '../clay';
import { cyl, mat, put, WOOD_DARK } from '../parts';
import { HANG_Y } from './wall';

/** Build the Tapestry model: a wide woven mandala hung from a wooden rod, two tiles across, fringed at the foot. */
export function buildTapestry(g: THREE.Group) {
  const top = HANG_Y + 0.35;
  put(g, cyl(0.025, 0.025, 1.6, 12), mat(WOOD_DARK, 0.6), 0, top + 0.03, 0.04).rotation.z = Math.PI / 2;
  put(g, soft(1.44, 0.74, 0.02), mat(0x8e3b46, 0.97), 0, top - 0.37, 0.03);
  put(g, soft(1.32, 0.62, 0.02), mat(0xe9c46a, 0.97), 0, top - 0.37, 0.034);
  put(g, soft(1.24, 0.54, 0.02), mat(0x2a6f73, 0.97), 0, top - 0.37, 0.038);
  // the mandala, rings within rings
  (
    [
      [0.24, 0xe9c46a],
      [0.18, 0x8e3b46],
      [0.12, 0xf4a261],
      [0.05, 0xe9c46a],
    ] as const
  ).forEach(([r, color], i) => {
    const ring = put(g, cyl(r, r, 0.01, 24), mat(color, 0.97), 0, top - 0.37, 0.044 + i * 0.003);
    ring.rotation.x = Math.PI / 2;
  });
  for (const x of [-0.45, 0.45]) {
    const dot = put(g, cyl(0.08, 0.08, 0.01, 16), mat(0xf4a261, 0.97), x, top - 0.37, 0.044);
    dot.rotation.x = Math.PI / 2;
  }
  // the fringe along the bottom
  const fringe = mat(0xe9c46a, 0.97);
  for (let i = 0; i < 12; i++) put(g, soft(0.03, 0.08, 0.01), fringe, -0.66 + i * 0.12, top - 0.78, 0.03);
}
