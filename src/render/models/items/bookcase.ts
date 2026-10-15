// The Bookcase model.

import type * as THREE from 'three';

import { at } from '../../../core/util';
import { mat, put, rbox, WOOD, WOOD_DARK } from '../parts';

const SPINES = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x4d7ea8, 0xb56576, 0x8ab17d, 0x6d597a, 0xf4a261];

/** Build the Bookcase model. */
export function buildBookcase(g: THREE.Group) {
  const frame = mat(WOOD_DARK);
  put(g, rbox(1.8, 1.6, 0.06, 0.02), frame, 0, 0.8, -0.42);
  for (const x of [-0.88, 0.88]) put(g, rbox(0.06, 1.6, 0.4, 0.02), frame, x, 0.8, -0.25);
  for (let i = 0; i < 4; i++) put(g, rbox(1.8, 0.05, 0.4, 0.02), mat(WOOD), 0, 0.05 + i * 0.5, -0.25);
  // a row of books on each of the lower three shelves, a few leaning over
  for (let shelf = 0; shelf < 3; shelf++) {
    let x = -0.8;
    for (let i = 0; x < 0.72; i++) {
      const w = 0.07 + ((i * 3 + shelf) % 4) * 0.02;
      const h = 0.3 + ((i * 5 + shelf * 2) % 3) * 0.05;
      const book = put(
        g,
        rbox(w, h, 0.28, 0.01),
        mat(at(SPINES, (i * 7 + shelf * 3) % SPINES.length)),
        x + w / 2,
        0.08 + shelf * 0.5 + h / 2,
        -0.24,
      );
      if ((i + shelf) % 6 === 5) book.rotation.z = -0.25;
      // the case around the books already shades them
      book.castShadow = false;
      x += w + 0.015;
    }
  }
}
