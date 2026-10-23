// What shows that someone lies face down rather than on their back, from above and at the game's usual distance: a
// towel over the small of the back, as at any massage, and the pale soles of the shoes turned up at the foot of the
// table. Made the first time someone lies face down, and shown only while they do.

import * as THREE from 'three';

import { cached, mat, put } from './parts';

/** How far round the hips the towel reaches, how deep it hangs, and where its middle is, up the torso, in meters. */
const TOWEL = { r: 0.178, h: 0.2, y: 0.02 } as const;

/** Where a sole is under a shoe, measured from the knee, and how thick it is, in meters. */
const SOLE = { y: -0.243, z: 0.042, t: 0.012 } as const;

/** A face-down guest's towel and the soles of their shoes. */
export interface FaceDown {
  towel: THREE.Mesh;
  soles: THREE.Mesh[];
}

/**
 * A white towel draped round the back half of the hips, open at the front, shaped to their oval as the trousers are;
 * and a pale sole under each shoe, following its outline. Each a shape everyone shares, in a plain material, so a room
 * of them batches.
 */
export function buildFaceDown(torso: THREE.Object3D, shins: readonly THREE.Object3D[]): FaceDown {
  const wrap = cached(
    'towel',
    () => new THREE.CylinderGeometry(TOWEL.r, TOWEL.r, TOWEL.h, 16, 1, true, Math.PI / 2, Math.PI),
  );
  const towel = put(torso, wrap, mat(0xf7f3ea, 0.9), 0, TOWEL.y, 0);
  towel.scale.set(1.12, 1, 0.94);
  towel.castShadow = false;
  const sole = cached('sole', () => new THREE.CylinderGeometry(0.074, 0.074, SOLE.t, 16).scale(1, 1, 1.62));
  const pale = mat(0xeee4d2, 0.8);
  const soles = shins.map((shin) => {
    const s = put(shin, sole, pale, 0, SOLE.y, SOLE.z);
    s.castShadow = false;
    return s;
  });
  return { towel, soles };
}

/** Show or hide the towel and soles. */
export function showFaceDown(f: FaceDown, on: boolean) {
  f.towel.visible = on;
  for (const s of f.soles) s.visible = on;
}
