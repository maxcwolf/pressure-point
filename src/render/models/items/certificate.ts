// The Certificate of Excellence model.

import type * as THREE from 'three';

import { CREAM, cyl, DARK, LACQUER, mat, put, rbox } from '../parts';
import { HANG_Y } from './wall';

/** Build the Certificate of Excellence model: a framed scroll of lettering, sealed in gold with two red ribbons. */
export function buildCertificate(g: THREE.Group) {
  const y = HANG_Y + 0.05;
  put(g, rbox(0.46, 0.36, 0.03, 0.008), mat(LACQUER, 0.5), 0, y, 0.015);
  put(g, rbox(0.4, 0.3, 0.01, 0.004), mat(CREAM, 0.9), 0, y, 0.035);
  // the heading, and lines of lettering under it
  const ink = mat(DARK, 0.9);
  put(g, rbox(0.24, 0.025, 0.004, 0.002), ink, 0, y + 0.1, 0.042);
  for (const [dy, w] of [
    [0.05, 0.3],
    [0.02, 0.26],
    [-0.01, 0.3],
  ] as const)
    put(g, rbox(w, 0.008, 0.004, 0.002), ink, 0, y + dy, 0.042);
  // the seal, with its ribbons hanging below it
  const ribbon = mat(0xc0392b, 0.6);
  for (const x of [-0.015, 0.015])
    put(g, rbox(0.022, 0.07, 0.004, 0.002), ribbon, 0.11 + x, y - 0.1, 0.043).rotation.z = x * 12;
  put(g, cyl(0.035, 0.035, 0.01, 16), mat(0xd4a94a, 0.3), 0.11, y - 0.07, 0.046).rotation.x = Math.PI / 2;
}
