// The Soundproof Panels model.

import type * as THREE from 'three';

import { DARK, mat, put, rbox } from '../parts';

/** Build the Soundproof Panels model: a free-standing frame of grey foam tiles, ridged like an egg box. */
export function buildSoundproofPanel(g: THREE.Group) {
  const frame = mat(DARK, 0.6);
  for (const x of [-0.4, 0.4]) put(g, rbox(0.06, 1.5, 0.12, 0.02), frame, x, 0.75, -0.2);
  // a foot under each upright, so it stands on its own
  for (const x of [-0.4, 0.4]) put(g, rbox(0.1, 0.05, 0.4, 0.02), frame, x, 0.025, -0.2);
  const foam = mat(0x6e7378, 0.98);
  const ridge = mat(0x5d6267, 0.98);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 2; col++) {
      const x = -0.18 + col * 0.36;
      const y = 0.32 + row * 0.34;
      put(g, rbox(0.34, 0.32, 0.08, 0.02), foam, x, y, -0.2);
      // the ridges run one way on one tile and the other way on the next, as they do on the real thing
      const across = (row + col) % 2 === 0;
      for (const k of [-0.09, 0, 0.09])
        put(
          g,
          rbox(across ? 0.3 : 0.05, across ? 0.05 : 0.28, 0.05, 0.02),
          ridge,
          x + (across ? 0 : k),
          y + (across ? k : 0),
          -0.14,
        );
    }
}
