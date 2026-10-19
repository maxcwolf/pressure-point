// The Massage Chair model.

import type * as THREE from 'three';

import { CHROME, DARK, mat, put, rbox } from '../parts';

/** Build the Massage Chair model. */
export function buildMassageChair(g: THREE.Group) {
  const leather = mat(0x3f4a5c, 0.45);
  const trim = mat(0x55657c, 0.45);
  // the seat runs from the back to just behind a sitter's knees, so their legs hang down to the footrest
  put(g, rbox(0.7, 0.22, 0.5, 0.06), mat(DARK), 0, 0.11, -0.06);
  put(g, rbox(0.62, 0.16, 0.44, 0.07), leather, 0, 0.32, -0.04);
  // the back leans away, padded in rolls where the massage rollers sit
  const back = put(g, rbox(0.6, 0.86, 0.2, 0.08), leather, 0, 0.78, -0.24);
  back.rotation.x = -0.18;
  for (const y of [0.56, 0.78, 1.0]) put(g, rbox(0.46, 0.12, 0.06, 0.05), trim, 0, y, -0.12 - (y - 0.56) * 0.17);
  put(g, rbox(0.4, 0.14, 0.18, 0.06), trim, 0, 1.2, -0.31).rotation.x = -0.18;
  for (const x of [-0.36, 0.36]) {
    put(g, rbox(0.12, 0.3, 0.6, 0.05), leather, x, 0.48, 0.02);
    put(g, rbox(0.04, 0.03, 0.12, 0.01), mat(CHROME, 0.3), x, 0.64, 0.24);
  }
  // the footrest
  put(g, rbox(0.5, 0.28, 0.14, 0.05), trim, 0, 0.18, 0.42);
}
