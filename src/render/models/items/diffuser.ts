// The Aroma Diffuser model.

import * as THREE from 'three';

import { cyl, mat, partsOf, put, soft, sph, WHITE, WOOD } from '../parts';

/** Build the Aroma Diffuser model. */
export function buildDiffuser(g: THREE.Group) {
  put(g, soft(0.34, 0.5, 0.34), mat(WOOD), 0, 0.25, 0);
  // a ceramic dome with a mouth at the top, where the scent puffs out
  put(g, sph(0.16, 22), mat(WHITE, 0.3), 0, 0.6, 0).scale.y = 1.05;
  put(g, cyl(0.045, 0.06, 0.08, 16), mat(WHITE, 0.3), 0, 0.77, 0);
  const puffs = new THREE.Group();
  for (let i = 0; i < 3; i++) put(puffs, sph(0.07, 8), mat(0xffffff, 0.9, 0.35), 0, 0, 0).castShadow = false;
  puffs.position.y = 0.8;
  g.add(puffs);
  partsOf(g).puffs = puffs;
}
