// The Potted Plant model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cyl, ico, mat, partsOf, put } from '../parts';

/** Build the Potted Plant model. */
export function buildPlant(g: THREE.Group) {
  put(g, cyl(0.25, 0.18, 0.36), mat(0xc8744f), 0, 0.18, 0);
  put(g, cyl(0.22, 0.22, 0.03), mat(0x5a4332), 0, 0.36, 0);
  put(g, cyl(0.035, 0.045, 0.4), mat(0x6b4f33), 0, 0.55, 0);
  // each plant owns its leaf material so it can wilt independently
  const leaf = owned(new THREE.MeshStandardMaterial({ color: 0x57a85a, roughness: 0.8, flatShading: true }));
  partsOf(g).leaf = leaf;
  const blobs: [number, number, number, number][] = [
    [0, 0.95, 0, 0.26],
    [0.2, 0.78, 0.05, 0.2],
    [-0.19, 0.8, -0.04, 0.2],
    [0.02, 0.76, -0.2, 0.18],
    [-0.03, 0.75, 0.2, 0.18],
  ];
  for (const [x, y, z, r] of blobs) put(g, ico(r), leaf, x, y, z);
}
