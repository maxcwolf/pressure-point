// The Brew Pot model: a blackened pot on a low fire, something bitter simmering in it, and a bucket beside it.

import * as THREE from 'three';

import { cyl, mat, partsOf, put, sph, torus } from '../parts';

/** Build the Brew Pot model. */
export function buildBrewPot(g: THREE.Group) {
  // a ring of stones round the fire, and the logs in it
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(g, sph(0.06, 8), mat(0x8f857a, 0.95), Math.cos(a) * 0.24 - 0.06, 0.04, Math.sin(a) * 0.24 - 0.06);
  }
  put(g, sph(0.08, 8), mat(0xff6a2a, 0.5, 1.1), -0.06, 0.05, -0.06).castShadow = false;
  // the pot, with its brew
  put(g, cyl(0.2, 0.15, 0.26, 16), mat(0x2a2422, 0.6), -0.06, 0.25, -0.06);
  put(g, torus(0.2, 0.02), mat(0x2a2422, 0.6), -0.06, 0.38, -0.06).rotation.x = Math.PI / 2;
  put(g, cyl(0.185, 0.185, 0.01, 16), mat(0x5a4a2a, 0.3), -0.06, 0.36, -0.06);
  // the bucket, just in case
  put(g, cyl(0.1, 0.085, 0.18, 14), mat(0x6f8fa8, 0.4), 0.3, 0.09, 0.3);
  put(g, torus(0.09, 0.008), mat(0x9aa4b0, 0.3), 0.3, 0.2, 0.3).rotation.x = 0.4;
  const steam = new THREE.Group();
  for (let i = 0; i < 3; i++) put(steam, sph(0.06, 8), mat(0xc9d6b5, 0.9, 0.2), 0, 0, 0).castShadow = false;
  steam.position.set(-0.06, 0.42, -0.06);
  g.add(steam);
  partsOf(g).puffs = steam;
}
