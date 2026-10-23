// The Soundproof Panels model.

import type * as THREE from 'three';

import { mat, MEMBER_TALL, put, soft, WOOD } from '../parts';

/** Build the Soundproof Panels model: a free-standing wooden frame of dusty blue foam tiles, ridged like an egg box. */
export function buildSoundproofPanel(g: THREE.Group) {
  const frame = mat(WOOD);
  for (const x of [-0.4, 0.4]) put(g, soft(MEMBER_TALL, 1.5, 0.12), frame, x, 0.75, -0.2);
  // a foot under each upright, so it stands on its own
  for (const x of [-0.4, 0.4]) put(g, soft(0.1, 0.05, 0.4), frame, x, 0.025, -0.2);
  // a soft studio blue, so the screen reads as padding and not as a dark grate
  const foam = mat(0x8ea3c4, 0.98);
  const ridge = mat(0x7489ad, 0.98);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 2; col++) {
      const x = -0.18 + col * 0.36;
      const y = 0.32 + row * 0.34;
      put(g, soft(0.34, 0.32, 0.08), foam, x, y, -0.2);
      // the ridges run one way on one tile and the other way on the next, as they do on the real thing
      const across = (row + col) % 2 === 0;
      for (const k of [-0.09, 0, 0.09])
        put(
          g,
          soft(across ? 0.3 : 0.05, across ? 0.05 : 0.28, 0.05),
          ridge,
          x + (across ? 0 : k),
          y + (across ? k : 0),
          -0.14,
        );
    }
}
