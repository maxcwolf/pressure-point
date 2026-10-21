// The Squishy Couch model.

import type * as THREE from 'three';

import { mat, put, soft } from '../parts';

/** Build the Squishy Couch model. */
export function buildSofa(g: THREE.Group) {
  // the seat runs from the back cushions to just behind a sitter's knees, so their legs hang clear of it
  put(g, soft(1.9, 0.3, 0.62), mat(0xc9705a), 0, 0.2, -0.11);
  put(g, soft(1.9, 0.6, 0.24), mat(0xc9705a), 0, 0.56, -0.3);
  for (const x of [-0.86, 0.86]) put(g, soft(0.22, 0.44, 0.62), mat(0xb8604c), x, 0.38, -0.11);
  for (const x of [-0.38, 0.38]) put(g, soft(0.72, 0.12, 0.38), mat(0xe39a84), x, 0.37, -0.01);
}
