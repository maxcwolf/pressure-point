// The Staff Fridge model.

import type * as THREE from 'three';

import { CHROME, mat, put, rbox, WHITE } from '../parts';

/** Build the Staff Fridge model: a tall white fridge, its handles, and notes stuck all over the door. */
export function buildStaffFridge(g: THREE.Group) {
  put(g, rbox(0.72, 1.7, 0.66, 0.06), mat(WHITE, 0.4), 0, 0.85, -0.1);
  // the freezer door above, the fridge door below, and a gap between
  put(g, rbox(0.7, 0.02, 0.02, 0.005), mat(0xc9cdd2), 0, 1.22, 0.24);
  for (const y of [1.45, 0.85]) put(g, rbox(0.04, 0.3, 0.05, 0.02), mat(CHROME, 0.3), 0.28, y, 0.27);
  // the notes, at a slant, each a different color
  const notes = [
    [-0.15, 1.05, 0xf2e15e, 0.1],
    [0.05, 0.95, 0xf7a8c4, -0.15],
    [-0.12, 0.72, 0x9fe0b4, -0.05],
    [0.08, 0.6, 0xf2e15e, 0.2],
    [-0.1, 1.42, 0x9ccbf2, 0.12],
  ] as const;
  for (const [x, y, color, turn] of notes)
    put(g, rbox(0.14, 0.14, 0.01, 0.003), mat(color, 0.9), x, y, 0.245).rotation.z = turn;
  // a magnet holding up a takeaway menu
  put(g, rbox(0.04, 0.04, 0.02, 0.01), mat(0xe5484d, 0.4), 0.1, 1.55, 0.25);
}
