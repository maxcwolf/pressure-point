// The Mindfulness Arcade model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cyl, DARK, mat, partsOf, put, rbox, sph } from '../parts';

/** Build the Mindfulness Arcade model. */
export function buildArcadeMachine(g: THREE.Group) {
  const body = mat(0x6d597a);
  put(g, rbox(0.62, 1.5, 0.6, 0.05), body, 0, 0.75, -0.1);
  // each arcade has its own screen, so it can flicker on its own
  const glow = owned(new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x3ddc84, emissiveIntensity: 1.2 }));
  const screen = put(g, rbox(0.46, 0.36, 0.04, 0.02), glow, 0, 1.14, 0.2);
  screen.rotation.x = -0.15;
  partsOf(g).led = glow;
  const panel = put(g, rbox(0.6, 0.08, 0.28, 0.03), mat(DARK), 0, 0.86, 0.3);
  panel.rotation.x = 0.35;
  put(g, cyl(0.015, 0.015, 0.1), mat(DARK), -0.14, 0.95, 0.3);
  put(g, sph(0.035, 10), mat(0xe5484d, 0.4), -0.14, 1.0, 0.3);
  put(g, cyl(0.03, 0.03, 0.03), mat(0xf2c14e, 0.4), 0.06, 0.92, 0.32);
  put(g, cyl(0.03, 0.03, 0.03), mat(0x4a9fe0, 0.4), 0.16, 0.92, 0.3);
  put(g, rbox(0.62, 0.16, 0.62, 0.04), mat(0xf2c14e, 0.4, 0.6), 0, 1.58, -0.1);
}
