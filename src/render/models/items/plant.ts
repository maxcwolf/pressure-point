// The Potted Plant model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { MEMBER } from '../clay';
import { cyl, mat, partsOf, put, sph } from '../parts';

/** Build the Potted Plant model: a terracotta pot with a lip, and a soft round bush of leaves. */
export function buildPlant(g: THREE.Group) {
  const pot = mat(0xc8744f);
  put(g, cyl(0.24, 0.18, 0.32), pot, 0, 0.16, 0);
  put(g, cyl(0.27, 0.26, 0.07), pot, 0, 0.33, 0);
  put(g, cyl(0.23, 0.23, 0.03), mat(0x5a4332), 0, 0.36, 0);
  put(g, cyl(MEMBER / 2, MEMBER / 2 + 0.01, 0.3), mat(0x6b4f33), 0, 0.5, 0);
  // each plant owns its leaf material so it can wilt independently
  const leaf = owned(new THREE.MeshStandardMaterial({ color: 0x57a85a, roughness: 0.8 }));
  partsOf(g).leaf = leaf;
  const blobs: [number, number, number, number][] = [
    [0, 0.8, 0, 0.22],
    [0.17, 0.66, 0.05, 0.17],
    [-0.16, 0.68, -0.04, 0.17],
    [0.02, 0.64, -0.17, 0.16],
    [-0.03, 0.63, 0.17, 0.16],
  ];
  for (const [x, y, z, r] of blobs) put(g, sph(r, 16), leaf, x, y, z);
}
