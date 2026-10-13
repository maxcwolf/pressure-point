// The Moxa Burner model.

import * as THREE from 'three';

import { cyl, LACQUER, mat, partsOf, put, sph } from '../parts';

/** Build the Moxa Burner model. */
export function buildMoxaBurner(g: THREE.Group) {
  put(g, cyl(0.2, 0.26, 0.08, 16), mat(LACQUER), 0, 0.04, 0);
  put(g, cyl(0.05, 0.07, 0.5, 10), mat(LACQUER), 0, 0.33, 0);
  put(g, cyl(0.26, 0.15, 0.18, 20), mat(0x2f6f6a, 0.4), 0, 0.67, 0);
  put(g, cyl(0.23, 0.23, 0.02, 20), mat(0x8a8378, 0.95), 0, 0.755, 0);
  for (const [x, z, lean] of [
    [-0.07, 0.02, 0.2],
    [0.06, -0.04, -0.15],
    [0.01, 0.08, 0.05],
  ] as const) {
    const stick = put(g, cyl(0.016, 0.016, 0.22, 6), mat(0x6b5a3a, 0.9), x, 0.86, z);
    stick.rotation.z = lean;
    put(g, sph(0.022, 8), mat(0xff7a2f, 0.4, 1.2), x - lean * 0.11, 0.97, z).castShadow = false;
  }
  const smoke = new THREE.Group();
  for (let i = 0; i < 3; i++) put(smoke, sph(0.06, 8), mat(0xe8e4dc, 0.9, 0.2), 0, 0, 0).castShadow = false;
  smoke.position.y = 1.0;
  g.add(smoke);
  partsOf(g).puffs = smoke;
}
