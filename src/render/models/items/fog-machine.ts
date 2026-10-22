// The Spirit Fog Machine: a nightclub fog machine built like a big Aroma Diffuser, a wooden box with a ceramic tank of
// fog juice on top, a nozzle and a blinking light, that fills the lodge with colored fog while a ceremony goes on.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { CHROME, cyl, mat, partsOf, put, soft, sph, WHITE, WOOD } from '../parts';
import { blob, puffs } from './machine-kit';

/** Build the Spirit Fog Machine, its nozzle to the front. */
export function buildFogMachine(g: THREE.Group) {
  put(g, soft(0.56, 0.34, 0.6), mat(WOOD), 0, 0.17, 0);
  // the diffuser's ceramic dome, grown into a tank, with a mouth to fill it by
  const ceramic = mat(WHITE, 0.3);
  put(g, sph(0.2, 24), ceramic, 0, 0.42, -0.06).scale.y = 0.9;
  put(g, cyl(0.05, 0.065, 0.08, 16), ceramic, 0, 0.62, -0.06);
  // the nozzle the fog sprays from, low on the front
  const chrome = mat(CHROME, 0.35);
  put(g, cyl(0.05, 0.075, 0.16, 16), chrome, 0, 0.17, 0.36).rotation.x = Math.PI / 2;
  put(g, cyl(0.1, 0.1, 0.03, 20), chrome, 0, 0.17, 0.3).rotation.x = Math.PI / 2;
  const led = owned(new THREE.MeshStandardMaterial({ color: 0xc04ad0, emissive: 0xc04ad0, emissiveIntensity: 1.2 }));
  put(g, soft(0.06, 0.04, 0.02), led, 0.19, 0.22, 0.305);
  partsOf(g).led = led;
  puffs(g, 'fog', { kind: 'spray', reach: 1.2, spread: 0.25, speed: 0.25 }, [0, 0.2, 0.5], 8, blob(0.18, 0xd8c8f0));
}
