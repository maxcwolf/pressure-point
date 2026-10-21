// The Toilet Stall model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { soft } from '../clay';
import { cyl, mat, partsOf, put, torus, WHITE } from '../parts';

/** Build the Toilet Stall model. */
export function buildToilet(g: THREE.Group) {
  const wall = mat(0x8fd3c1);
  put(g, soft(1.0, 1.2, 0.06), wall, 0, 0.6, -0.46);
  for (const x of [-0.47, 0.47]) put(g, soft(0.06, 1.2, 0.96), wall, x, 0.6, 0);
  // the bowl sits back, so a sitter's legs hang in front of it
  // each toilet's porcelain is its own, so it can grow grimy on its own until it is cleaned
  const china = owned(new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.3, metalness: 0.02 }));
  put(g, cyl(0.17, 0.14, 0.34), china, 0, 0.17, -0.1);
  const seat = put(g, torus(0.155, 0.045), china, 0, 0.35, -0.1);
  seat.rotation.x = Math.PI / 2;
  put(g, soft(0.44, 0.34, 0.16), china, 0, 0.5, -0.33);
  partsOf(g).grime = china;
}
