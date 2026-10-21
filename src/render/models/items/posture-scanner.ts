// The Posture Scanner model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { MEMBER_TALL, soft } from '../clay';
import { CHROME, cyl, DARK, mat, partsOf, put, torus } from '../parts';

/** Build the Posture Scanner model. */
export function buildPostureScanner(g: THREE.Group) {
  // console on the left tile, scanning platform on the right, in pale enamel with the screen and rings lit up
  const enamel = mat(0xd7dce2);
  put(g, soft(0.66, 0.9, 0.5), enamel, -0.5, 0.45, -0.15);
  // each scanner lights its own screen, so it can flicker as it wears and go dark when it breaks
  const lamp = owned(
    new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: 0.3, emissive: 0x9fe8ff, emissiveIntensity: 0.5 }),
  );
  const screen = put(g, soft(0.56, 0.36, 0.05), lamp, -0.5, 1.0, 0.02);
  partsOf(g).lamp = lamp;
  screen.rotation.x = -0.35;
  put(g, soft(0.5, 0.05, 0.2), mat(DARK), -0.5, 0.92, 0.22);
  // a low round step with a pair of footprints on it, so it reads as a place to stand and not a pool
  put(g, cyl(0.4, 0.44, 0.1, 28), enamel, 0.5, 0.05, 0);
  for (const x of [0.4, 0.6]) put(g, soft(0.11, 0.02, 0.24), mat(DARK), x, 0.105, 0.02);
  // the gantry the ring runs up and down
  const steel = mat(CHROME, 0.3);
  for (const x of [0.08, 0.92]) put(g, soft(MEMBER_TALL, 1.5, MEMBER_TALL), steel, x, 0.75, -0.3);
  put(g, soft(0.92, MEMBER_TALL, MEMBER_TALL), steel, 0.5, 1.5, -0.3);
  // the ring sweeps up and down while a scan is running
  const ring = put(g, torus(0.4, 0.03), mat(0x4aa8ff, 0.3, 0.9), 0.5, 0.8, 0);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  partsOf(g).ring = ring;
}
