// The Wall Fountain model.

import type * as THREE from 'three';

import { cyl, mat, put, soft } from '../parts';
import { HANG_Y } from './wall';

/** Build the Wall Fountain model: a slate panel with a copper spout, water running down it into a stone trough. */
export function buildWallFountain(g: THREE.Group) {
  const y = HANG_Y + 0.05;
  put(g, soft(0.62, 0.92, 0.06), mat(0x4a5058, 0.85), 0, y, 0.03);
  put(g, soft(0.54, 0.84, 0.02), mat(0x3a3f46, 0.6), 0, y, 0.065);
  const spout = put(g, cyl(0.025, 0.025, 0.1, 10), mat(0xb87333, 0.35), 0, y + 0.36, 0.11);
  spout.rotation.x = Math.PI / 2;
  // the sheet of water, glossy, from the spout to the trough
  put(g, soft(0.16, 0.76, 0.012), mat(0x9fd3ec, 0.1), 0, y - 0.03, 0.08);
  put(g, soft(0.66, 0.1, 0.2), mat(0x9aa0a8, 0.8), 0, HANG_Y - 0.43, 0.1);
  put(g, soft(0.58, 0.02, 0.15), mat(0x7fbfe0, 0.1), 0, HANG_Y - 0.375, 0.1);
}
