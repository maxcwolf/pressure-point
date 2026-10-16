// What every model hung on a wall shares: how high it hangs, and the chip that stands in for it on a low wall.

import type * as THREE from 'three';

import { mat, put, rbox, WHITE } from '../parts';

/**
 * How high up the wall the middle of a picture hangs, from the floor. A wall item's model is built with the wall's face
 * at z = 0 and its front toward +z, centered along the wall.
 */
export const HANG_Y = 0.8;

/**
 * Build the chip shown in place of something hung on a wall while the wall is cut low: a small tile of its color on
 * top of the wall, so it can still be seen and clicked, longer for something `w` tiles wide. `thick` is how thick the
 * wall is, and `top` how high.
 */
export function buildChip(g: THREE.Group, color: number, w: number, thick: number, top: number) {
  const long = w - 0.56;
  put(g, rbox(long + 0.1, 0.03, thick + 0.08, 0.01), mat(WHITE, 0.8), 0, top + 0.015, -thick / 2);
  put(g, rbox(long, 0.034, thick + 0.04, 0.01), mat(color, 0.7), 0, top + 0.017, -thick / 2);
}
