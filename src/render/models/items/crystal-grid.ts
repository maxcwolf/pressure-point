// The Crystal Grid model.

import type * as THREE from 'three';

import { cyl, joined, mat, put, soft, WOOD } from '../parts';

/** A crystal point: a six-sided prism with a pointed tip, `r` across its faces and `h` tall, standing at y = 0. */
const point = (r: number, h: number) =>
  joined(`crystal-point|${r}|${h}`, [
    [cyl(r, r, h * 0.6, 6), 0, h * 0.3, 0],
    [cyl(0, r, h * 0.4, 6), 0, h * 0.8, 0],
  ]);

/** Build the Crystal Grid model. */
export function buildCrystalGrid(g: THREE.Group) {
  for (const [x, z] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ])
    put(g, soft(0.07, 0.5, 0.07), mat(WOOD), x, 0.25, z);
  put(g, soft(0.74, 0.05, 0.74), mat(WOOD), 0, 0.52, 0);
  put(g, cyl(0.32, 0.32, 0.01, 6), mat(0x3b2f52, 0.6), 0, 0.555, 0);
  const quartz = mat(0xd9c8f5, 0.2, 0.4);
  // a tall point in the middle and six around it, big enough to stand out above the table at the default zoom
  put(g, point(0.07, 0.38), quartz, 0, 0.56, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = put(g, point(0.042, 0.2), i % 2 ? quartz : mat(0xf2b8d6, 0.2, 0.3), 0, 0.56, 0);
    p.position.x = Math.cos(a) * 0.22;
    p.position.z = Math.sin(a) * 0.22;
    p.rotation.y = a;
  }
}
