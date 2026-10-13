// The Aroma Diffuser model.

import * as THREE from 'three';

import { cyl, mat, partsOf, put, rbox, sph, WHITE, WOOD } from '../parts';

/** Build the Aroma Diffuser model. */
export function buildDiffuser(g: THREE.Group) {
  put(g, rbox(0.34, 0.5, 0.34, 0.08), mat(WOOD), 0, 0.25, 0);
  put(g, cyl(0.13, 0.17, 0.26, 16), mat(WHITE, 0.3), 0, 0.63, 0);
  const puffs = new THREE.Group();
  for (let i = 0; i < 3; i++) put(puffs, sph(0.07, 8), mat(0xffffff, 0.9, 0.35), 0, 0, 0).castShadow = false;
  puffs.position.y = 0.8;
  g.add(puffs);
  partsOf(g).puffs = puffs;
}
