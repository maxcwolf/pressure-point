// The Practice Spot model: a square of cork floor, with a pair of footprints showing which way to face.

import type * as THREE from 'three';

import { mat, put, soft } from '../parts';

/** Build the Practice Spot model. */
export function buildPracticeSpot(g: THREE.Group) {
  put(g, soft(0.86, 0.02, 0.86), mat(0xc49a6c, 0.95), 0, 0.011, 0).castShadow = false;
  // footprints, toes toward the front of the spot
  for (const x of [-0.11, 0.11]) {
    put(g, soft(0.12, 0.024, 0.26), mat(0x8a6440, 0.95), x, 0.013, 0.02).castShadow = false;
    put(g, soft(0.1, 0.026, 0.08), mat(0x8a6440, 0.95), x, 0.014, -0.17).castShadow = false;
  }
}
