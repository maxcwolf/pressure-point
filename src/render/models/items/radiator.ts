// The Radiator model.

import type * as THREE from 'three';

import { CHROME, cyl, mat, put, rbox, WHITE } from '../parts';

/** Build the Radiator model: a row of white columns on little feet, with a valve at one end. */
export function buildRadiator(g: THREE.Group) {
  const paint = mat(WHITE, 0.45);
  const fins = 7;
  for (let i = 0; i < fins; i++) {
    const x = -0.36 + (i * 0.72) / (fins - 1);
    put(g, rbox(0.08, 0.62, 0.16, 0.035), paint, x, 0.43, -0.28);
  }
  put(g, rbox(0.82, 0.05, 0.1, 0.02), paint, 0, 0.75, -0.28);
  put(g, rbox(0.82, 0.05, 0.1, 0.02), paint, 0, 0.14, -0.28);
  for (const x of [-0.34, 0.34]) put(g, rbox(0.08, 0.1, 0.12, 0.02), mat(0xd9d4c8), x, 0.05, -0.28);
  put(g, cyl(0.03, 0.03, 0.12, 10), mat(CHROME, 0.3), 0.46, 0.22, -0.28);
  put(g, cyl(0.055, 0.055, 0.05, 12), mat(0xe5484d, 0.5), 0.46, 0.3, -0.28);
}
