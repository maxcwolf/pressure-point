// The Squishy Couch model.

import type * as THREE from 'three';

import { mat, put, rbox } from '../parts';

/** Build the Squishy Couch model. */
export function buildSofa(g: THREE.Group) {
  // the seat runs from the back cushions to just behind a sitter's knees, so their legs hang clear of it
  put(g, rbox(1.9, 0.3, 0.62, 0.08), mat(0xd9634c), 0, 0.2, -0.11);
  put(g, rbox(1.9, 0.6, 0.24, 0.1), mat(0xd9634c), 0, 0.56, -0.3);
  for (const x of [-0.86, 0.86]) put(g, rbox(0.22, 0.44, 0.62, 0.09), mat(0xc9553f), x, 0.38, -0.11);
  for (const x of [-0.38, 0.38]) put(g, rbox(0.72, 0.12, 0.38, 0.05), mat(0xee8a72), x, 0.37, -0.01);
}
