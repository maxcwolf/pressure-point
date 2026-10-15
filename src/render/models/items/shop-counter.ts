// The Shop Counter model: a counter with a till on top, and shelves of books, crystals and candles in its front,
// facing the guests. The shopkeeper stands behind it.

import type * as THREE from 'three';

import { CREAM, cyl, DARK, ico, mat, put, rbox, WOOD, WOOD_DARK } from '../parts';

/** Build the Shop Counter model. */
export function buildShopCounter(g: THREE.Group) {
  // the counter, set back to leave room for the shelves in front of it
  put(g, rbox(1.8, 0.86, 0.46, 0.06), mat(CREAM), 0, 0.43, -0.12);
  put(g, rbox(1.94, 0.07, 0.74, 0.03), mat(WOOD), 0, 0.89, -0.02);
  // shelves across its front, framed at each end
  const shelf = mat(WOOD_DARK);
  for (const x of [-0.88, 0.88]) put(g, rbox(0.05, 0.84, 0.22, 0.01), shelf, x, 0.43, 0.22);
  for (const y of [0.06, 0.4]) put(g, rbox(1.76, 0.04, 0.22, 0.01), shelf, 0, y, 0.22);
  // books on the lower shelf
  const spines = [0xb5523e, 0x2f7f7a, 0xe9c46a, 0x6d597a, 0x4d7ea8, 0xe76f51, 0x8ab17d, 0xb56576];
  spines.forEach((color, i) => put(g, rbox(0.12, 0.26, 0.15, 0.01), mat(color), -0.72 + i * 0.205, 0.21, 0.22));
  // crystals and candles on the upper shelf
  for (const [i, color] of [0xb9a3e3, 0xf4c2d7, 0xa7d8e8].entries())
    put(g, ico(0.08), mat(color, 0.15, 0.2), -0.6 + i * 0.22, 0.5, 0.22);
  for (let i = 0; i < 3; i++) {
    put(g, cyl(0.06, 0.06, 0.13), mat(0xf4f1ea), 0.2 + i * 0.22, 0.49, 0.22);
    put(g, cyl(0.012, 0.012, 0.04), mat(DARK), 0.2 + i * 0.22, 0.57, 0.22);
  }
  // a till, a stack of books and a crystal on top
  put(g, rbox(0.32, 0.18, 0.26, 0.03), mat(DARK), -0.55, 1.01, -0.12);
  for (const [i, color] of [0xb5523e, 0x3f7fb5, 0xe9c46a].entries())
    put(g, rbox(0.28, 0.05, 0.2, 0.01), mat(color), 0.2, 0.95 + i * 0.05, -0.05);
  put(g, ico(0.07), mat(0xb9a3e3, 0.15, 0.2), 0.6, 0.99, -0.05);
  // a bottle of massage oil
  put(g, cyl(0.04, 0.05, 0.16), mat(0x6b4229, 0.3), 0.75, 1.0, -0.2);
}
