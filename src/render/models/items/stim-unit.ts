// The Stim Unit model.

import * as THREE from 'three';

import { cyl, DARK, mat, partsOf, put, rbox, sph, torus } from '../parts';

/** Build the Stim Unit model. */
export function buildStimUnit(g: THREE.Group) {
  for (const [x, z] of [
    [-0.24, -0.16],
    [0.24, -0.16],
    [-0.24, 0.16],
    [0.24, 0.16],
  ])
    put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
  put(g, rbox(0.62, 0.66, 0.46, 0.05), mat(0xd7dce2), 0, 0.42, 0);
  const face = put(g, rbox(0.58, 0.26, 0.05, 0.02), mat(DARK), 0, 0.88, 0.12);
  face.rotation.x = -0.5;
  put(g, rbox(0.2, 0.12, 0.02, 0.01), mat(0x7dffb0, 0.3, 0.8), -0.14, 0.9, 0.16).rotation.x = -0.5;
  for (const x of [0.06, 0.18]) {
    const dial = put(g, cyl(0.04, 0.04, 0.04, 12), mat(0xf2c14e, 0.4), x, 0.89, 0.17);
    dial.rotation.x = Math.PI / 2 - 0.5;
  }
  // each unit owns its light so it can blink independently
  const led = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff3b30, emissiveIntensity: 1 });
  put(g, sph(0.03, 8), led, 0.24, 0.98, 0.1).castShadow = false;
  partsOf(g).led = led;
  for (const [x, c] of [
    [-0.33, 0xe5484d],
    [0.33, 0x2a2a2e],
  ] as [number, number][]) {
    const coil = put(g, torus(0.09, 0.014), mat(c), x, 0.55, 0.05);
    coil.rotation.y = Math.PI / 2;
  }
}
