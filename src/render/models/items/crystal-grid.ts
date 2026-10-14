// The Crystal Grid model.

import type * as THREE from 'three';

import { cyl, mat, put, rbox, WOOD } from '../parts';

/** Build the Crystal Grid model. */
export function buildCrystalGrid(g: THREE.Group) {
  for (const [x, z] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ])
    put(g, rbox(0.07, 0.5, 0.07, 0.02), mat(WOOD), x, 0.25, z);
  put(g, rbox(0.74, 0.05, 0.74, 0.03), mat(WOOD), 0, 0.52, 0);
  put(g, cyl(0.32, 0.32, 0.01, 6), mat(0x3b2f52, 0.6), 0, 0.555, 0);
  const quartz = mat(0xd9c8f5, 0.2, 0.4);
  // a tall point in the middle and six around it
  put(g, cyl(0.002, 0.06, 0.28, 6), quartz, 0, 0.7, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const point = put(g, cyl(0.002, 0.035, 0.14, 6), i % 2 ? quartz : mat(0xf2b8d6, 0.2, 0.3), 0, 0.63, 0);
    point.position.x = Math.cos(a) * 0.22;
    point.position.z = Math.sin(a) * 0.22;
  }
}
