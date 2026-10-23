// What shows that someone lies face down rather than on their back, from above and at the game's usual distance: the
// pale soles of their shoes turned up at the foot of the table. Made the first time someone lies face down, and shown
// only while they do.

import * as THREE from 'three';

import { cached, mat, put } from './parts';

/** Where a sole is under a shoe, measured from the knee, and how thick it is, in meters. */
const SOLE = { y: -0.243, z: 0.042, t: 0.012 } as const;

/** A pale sole under each shoe, following its outline: one shape everyone shares, in a plain material, so it batches. */
export function buildSoles(shins: readonly THREE.Object3D[]): THREE.Mesh[] {
  const sole = cached('sole', () => new THREE.CylinderGeometry(0.074, 0.074, SOLE.t, 16).scale(1, 1, 1.62));
  const pale = mat(0xeee4d2, 0.8);
  return shins.map((shin) => {
    const s = put(shin, sole, pale, 0, SOLE.y, SOLE.z);
    s.castShadow = false;
    return s;
  });
}
