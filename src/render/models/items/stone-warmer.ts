// The Stone Warmer model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { CHROME, cyl, mat, partsOf, put, soft, sph } from '../parts';

/** Build the Stone Warmer model. */
export function buildStoneWarmer(g: THREE.Group) {
  put(g, soft(0.72, 0.5, 0.6), mat(0x5a606b), 0, 0.25, 0);
  put(g, soft(0.78, 0.06, 0.66), mat(CHROME, 0.35), 0, 0.53, 0);
  put(g, cyl(0.27, 0.22, 0.22, 20), mat(0xb5714a, 0.4), 0, 0.67, 0);
  // each warmer owns its glow so it can cool independently
  const glow = owned(
    new THREE.MeshStandardMaterial({
      color: 0x2b2b30,
      roughness: 0.5,
      emissive: 0xff5a1f,
      emissiveIntensity: 1,
    }),
  );
  partsOf(g).glow = glow;
  put(g, cyl(0.24, 0.24, 0.02, 20), glow, 0, 0.775, 0);
  for (const [x, z] of [
    [0, 0],
    [0.12, 0.08],
    [-0.11, 0.07],
    [0.04, -0.13],
    [-0.09, -0.09],
  ]) {
    const stone = put(g, sph(0.075, 10), mat(0x2f3136, 0.55), x, 0.81, z);
    stone.scale.y = 0.5;
  }
  const dial = put(g, cyl(0.055, 0.055, 0.03, 12), mat(0xe9c46a, 0.4), 0.2, 0.3, 0.31);
  dial.rotation.x = Math.PI / 2;
}
