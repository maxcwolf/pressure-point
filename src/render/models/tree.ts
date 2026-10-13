// Trees for the lawn.
import * as THREE from 'three';

import { at } from '../../core/util';
import { cached, cyl, mat, put } from './parts';

/** Build a tree whose height and color vary with the seed. */
export function buildTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.9 + (seed % 5) * 0.12;
  put(g, cyl(0.09, 0.13, h, 8), mat(0x7a5a3c, 0.9), 0, h / 2, 0);
  const green = at([0x5fae5a, 0x4f9a55, 0x74b85c], seed % 3);
  const leaf = cached(`treeleaf${seed % 3}`, () => new THREE.IcosahedronGeometry(1, 1));
  const m = new THREE.MeshStandardMaterial({ color: green, roughness: 0.85, flatShading: true });
  for (const [x, y, z, r] of [
    [0, h + 0.45, 0, 0.62],
    [0.35, h + 0.15, 0.1, 0.42],
    [-0.3, h + 0.2, -0.15, 0.45],
  ] as const) {
    const b = put(g, leaf, m, x, y, z);
    b.scale.setScalar(r);
  }
  return g;
}
