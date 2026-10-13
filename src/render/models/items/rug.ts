// The Woven Rug model.

import type * as THREE from 'three';

import { mat, put, rbox } from '../parts';

/** Build the Woven Rug model. */
export function buildRug(g: THREE.Group) {
  put(g, rbox(1.84, 0.03, 1.84, 0.015), mat(0xb5524a, 0.95), 0, 0.016, 0).castShadow = false;
  put(g, rbox(1.5, 0.034, 1.5, 0.015), mat(0xe9c46a, 0.95), 0, 0.018, 0).castShadow = false;
  put(g, rbox(1.16, 0.038, 1.16, 0.015), mat(0x2a9d8f, 0.95), 0, 0.02, 0).castShadow = false;
  const diamond = put(g, rbox(0.56, 0.042, 0.56, 0.015), mat(0xf5ecdb, 0.95), 0, 0.022, 0);
  diamond.rotation.y = Math.PI / 4;
  diamond.castShadow = false;
}
