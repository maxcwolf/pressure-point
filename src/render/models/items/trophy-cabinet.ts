// The Trophy Cabinet model.

import * as THREE from 'three';

import { cyl, GLASS, LACQUER, mat, partsOf, put, soft } from '../parts';
import { starShape } from '../plate';

/** The gold of the cups and the cabinet's crest. */
const GOLD = 0xf2c14e;

/** Build one gold cup on a plinth, standing on a shelf at a height. */
function trophy(g: THREE.Object3D, x: number, y: number, size: number): THREE.Group {
  const cup = new THREE.Group();
  const gold = mat(GOLD, 0.25, 0.45);
  put(cup, soft(0.12 * size, 0.04, 0.12 * size), mat(0x3b3f4a), x, y + 0.02, -0.24);
  put(cup, cyl(0.022, 0.028, 0.08 * size, 10), gold, x, y + 0.04 + 0.04 * size, -0.24);
  put(cup, cyl(0.07 * size, 0.035 * size, 0.12 * size), gold, x, y + 0.08 * size + 0.1 * size, -0.24);
  g.add(cup);
  return cup;
}

/**
 * Build the Trophy Cabinet model, its cups in the order they fill up as awards are won: a glass-fronted case in dark
 * lacquer, lined in navy velvet and crowned with a gold star, so it reads as a place for prizes before any are won and
 * not as one more wooden shelf.
 */
export function buildTrophyCabinet(g: THREE.Group) {
  const frame = mat(LACQUER, 0.5);
  put(g, soft(0.8, 1.6, 0.06), mat(0x2f3a5e, 0.9), 0, 0.8, -0.44);
  for (const x of [-0.38, 0.38]) put(g, soft(0.06, 1.6, 0.44), frame, x, 0.8, -0.24);
  for (const y of [0.04, 0.55, 1.05, 1.57]) put(g, soft(0.8, 0.05, 0.44), frame, 0, y, -0.24);
  // the glass door across the front, and the gold star on top
  const door = put(g, soft(0.72, 1.5, 0.02), GLASS, 0, 0.8, -0.03);
  door.castShadow = false;
  const gold = mat(GOLD, 0.25, 0.45);
  put(g, starShape(0.26, 0.03), gold, 0, 1.74, -0.26);
  partsOf(g).cups = [
    trophy(g, 0, 1.08, 1.4),
    trophy(g, -0.15, 0.58, 1.2),
    trophy(g, 0.17, 0.58, 0.9),
    trophy(g, -0.2, 0.07, 0.8),
    trophy(g, 0.2, 0.07, 1),
  ];
}
