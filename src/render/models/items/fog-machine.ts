// The Spirit Fog Machine: a nightclub fog machine, a black box with a nozzle and a blinking light, that fills the lodge
// with colored fog while a ceremony goes on.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cyl, DARK, mat, partsOf, put, rbox } from '../parts';
import { blob, puffs } from './machine-kit';

/** Build the Spirit Fog Machine, its nozzle to the front. */
export function buildFogMachine(g: THREE.Group) {
  put(g, rbox(0.55, 0.3, 0.6, 0.04), mat(DARK, 0.5), 0, 0.15, 0);
  put(g, rbox(0.5, 0.06, 0.5, 0.02), mat(0x55585f, 0.5), 0, 0.33, 0);
  put(g, cyl(0.05, 0.07, 0.18, 10), mat(0x9a9ea6, 0.3), 0, 0.17, 0.36).rotation.x = Math.PI / 2;
  const led = owned(new THREE.MeshStandardMaterial({ color: 0xc04ad0, emissive: 0xc04ad0, emissiveIntensity: 1.2 }));
  put(g, rbox(0.06, 0.04, 0.02, 0.01), led, 0.18, 0.22, 0.31);
  partsOf(g).led = led;
  puffs(g, 'fog', { kind: 'spray', reach: 1.2, spread: 0.25, speed: 0.25 }, [0, 0.2, 0.5], 8, blob(0.18, 0xd8c8f0));
}
