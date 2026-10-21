// The Sound Bath Mat model: a thick mat with a bolster under the knees and an eye pillow at the head.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { capsule, mat, partsOf, put, soft } from '../parts';

/** Build the Sound Bath Mat model. */
export function buildSoundMat(g: THREE.Group) {
  put(g, soft(0.72, 0.08, 1.8), mat(0x5f9ea8, 0.85), 0, 0.04, 0);
  // each mat's cover is its own, so it can grow grimy on its own until it is cleaned
  const cover = owned(new THREE.MeshStandardMaterial({ color: 0xd9ecec, roughness: 0.72, metalness: 0.02 }));
  put(g, soft(0.66, 0.02, 1.7), cover, 0, 0.09, 0);
  partsOf(g).grime = cover;
  // a bolster for the knees, a folded blanket at the foot, and an eye pillow by the head
  const bolster = put(g, capsule(0.08, 0.42), mat(0x3f7f8c, 0.85), 0, 0.17, 0.45);
  bolster.rotation.z = Math.PI / 2;
  put(g, soft(0.6, 0.06, 0.26), mat(0xf2e6c8, 0.85), 0, 0.13, 0.76);
  put(g, capsule(0.03, 0.14), mat(0x7a5aa8, 0.85), 0.18, 0.125, -0.74).rotation.z = Math.PI / 2;
}
