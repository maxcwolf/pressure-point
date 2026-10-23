// The Certificate of Excellence model.

import type * as THREE from 'three';

import { CREAM, cyl, DARK, LACQUER, mat, put, rbox } from '../parts';
import { HANG_Y } from './wall';

/**
 * Build the Certificate of Excellence model: a framed scroll of lettering, wider than it is tall, with a big gold seal
 * and two red ribbons, which is what tells it from the posters at a glance.
 */
export function buildCertificate(g: THREE.Group) {
  const y = HANG_Y + 0.05;
  put(g, rbox(0.7, 0.52, 0.035, 0.012), mat(LACQUER, 0.5), 0, y, 0.018);
  put(g, rbox(0.62, 0.44, 0.012, 0.004), mat(CREAM, 0.9), 0, y, 0.04);
  // the heading, and lines of lettering under it
  const ink = mat(DARK, 0.9);
  put(g, rbox(0.36, 0.045, 0.004, 0.002), ink, 0, y + 0.14, 0.048);
  for (const [dy, w] of [
    [0.06, 0.48],
    [0.01, 0.42],
    [-0.04, 0.26],
  ] as const)
    put(g, rbox(w, 0.016, 0.004, 0.002), ink, w === 0.26 ? -0.11 : 0, y + dy, 0.048);
  // the seal, with its ribbons hanging below it
  const ribbon = mat(0xc0392b, 0.6);
  for (const x of [-0.03, 0.03])
    put(g, rbox(0.04, 0.13, 0.004, 0.002), ribbon, 0.17 + x, y - 0.15, 0.049).rotation.z = x * 8;
  put(g, cyl(0.085, 0.085, 0.012, 20), mat(0xd4a94a, 0.3), 0.17, y - 0.09, 0.053).rotation.x = Math.PI / 2;
}
