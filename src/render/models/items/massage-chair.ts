// The Massage Chair model: a padded shell on a low plinth, its back leaning away with wings round the shoulders, and a
// calf rest under the front of the seat where a sitter's legs hang.

import * as THREE from 'three';

import { CHROME, DARK, mat, put, rbox } from '../parts';

/** Build the Massage Chair model. */
export function buildMassageChair(g: THREE.Group) {
  const shell = mat(0xe6dfd2, 0.35);
  const leather = mat(0x58688a, 0.5);
  const pad = mat(0x7083a6, 0.55);
  put(g, rbox(0.6, 0.08, 0.6, 0.03), mat(DARK), 0, 0.04, -0.08);
  // the seat runs from the back to just behind a sitter's knees, so their legs hang down past it
  put(g, rbox(0.58, 0.22, 0.46, 0.05), shell, 0, 0.18, -0.08);
  put(g, rbox(0.56, 0.12, 0.42, 0.06), leather, 0, 0.34, -0.05);
  // the calf rest, with a pad between the legs
  put(g, rbox(0.5, 0.28, 0.08, 0.04), pad, 0, 0.19, 0.13);
  put(g, rbox(0.05, 0.24, 0.1, 0.025), leather, 0, 0.2, 0.18);
  // the sides, rising to padded arms, with the remote on the right
  for (const x of [-0.34, 0.34]) {
    put(g, rbox(0.1, 0.48, 0.6, 0.05), shell, x, 0.32, -0.08);
    put(g, rbox(0.13, 0.06, 0.52, 0.03), leather, x, 0.58, -0.06);
    // the air cushions that squeeze the arms, padded out on the outside
    put(g, rbox(0.03, 0.26, 0.44, 0.015), pad, x * 1.15, 0.34, -0.08);
  }
  put(g, rbox(0.07, 0.025, 0.12, 0.01), mat(CHROME, 0.3), 0.34, 0.62, 0.12);
  put(g, rbox(0.045, 0.01, 0.06, 0.004), mat(0x7fd4ff, 0.3), 0.34, 0.635, 0.13);
  // the back leans away: a shell holding the padded spine where the rollers run, wings round the shoulders, and a
  // pillow for the head
  const back = new THREE.Group();
  back.position.set(0, 0.36, -0.22);
  back.rotation.x = -0.18;
  g.add(back);
  put(back, rbox(0.72, 0.92, 0.16, 0.07), shell, 0, 0.46, -0.04);
  put(back, rbox(0.5, 0.74, 0.08, 0.04), leather, 0, 0.42, 0.07);
  for (const y of [0.22, 0.42, 0.62]) put(back, rbox(0.4, 0.1, 0.04, 0.03), pad, 0, y, 0.11);
  for (const x of [-0.32, 0.32]) put(back, rbox(0.08, 0.6, 0.22, 0.04), shell, x, 0.5, 0.1);
  put(back, rbox(0.38, 0.14, 0.12, 0.06), pad, 0, 0.84, 0.1);
}
