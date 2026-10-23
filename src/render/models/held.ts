// What people hold in their right hand while they do something: a cup, a snack, a watering can or a wrench. Each is one
// shared shape in one color, so a crowd holding them costs a batch apiece, and is only made the first time it is held.

import type * as THREE from 'three';

import { ELBOW } from './character-detail';
import { cyl, joined, mat, put, rbox, torus } from './parts';

/** The things a hand can hold. */
export type HeldKind = 'cup' | 'snack' | 'can' | 'wrench';

/** Where the hand grips, down the forearm from the elbow, as the sage bundle hangs. */
const GRIP = -0.31 + ELBOW;

/**
 * How much bigger than life what is held is drawn: at the game's usual distance a guest stands 30-odd pixels tall, and
 * a cup of life size hides behind the hand holding it.
 */
export const HELD_SIZE = 1.8;

/** The one shape of each thing held, made the first time it is asked for. */
function shapeOf(kind: HeldKind): THREE.BufferGeometry {
  switch (kind) {
    case 'cup':
      // a takeaway cup with a lid and a sleeve round it, standing up out of the fist
      return joined('held cup', [
        [cyl(0.048, 0.038, 0.12, 12), 0, 0.035, 0],
        [cyl(0.053, 0.053, 0.016, 12), 0, 0.1, 0],
        [cyl(0.052, 0.046, 0.045, 12), 0, 0.03, 0],
      ]);
    case 'snack':
      // a snack bar in its wrapper, crimped at each end, standing up out of the fist
      return joined('held snack', [
        [rbox(0.06, 0.12, 0.03, 0.012), 0, 0.04, 0],
        [rbox(0.066, 0.018, 0.022, 0.006), 0, 0.105, 0],
        [rbox(0.066, 0.018, 0.022, 0.006), 0, -0.025, 0],
      ]);
    case 'can':
      // a watering can: a body, a spout reaching forward and a handle over the top
      return joined('held can', [
        [cyl(0.075, 0.08, 0.13, 14), 0, -0.08, 0.07],
        [cyl(0.014, 0.022, 0.2, 8), 0, -0.05, 0.21, Math.PI / 2 - 0.5, 0, 0],
        [torus(0.05, 0.012), 0, -0.01, 0.05, 0, Math.PI / 2, 0],
      ]);
    case 'wrench':
      // a spanner, its handle along the fist and its jaw out past the thumb
      return joined('held wrench', [
        [cyl(0.012, 0.012, 0.22, 8), 0, 0, 0],
        [rbox(0.05, 0.035, 0.018, 0.006), 0, 0.12, 0],
      ]);
  }
}

/** Each thing held: its color and roughness, and where it sits in the hand and how it is turned there. */
// a white cup and a bright yellow wrapper, told apart at a glance, and a wrench painted orange as tools are
const HELD: Readonly<Record<HeldKind, { color: number; rough: number; at: readonly number[] }>> = {
  cup: { color: 0xfaf6ee, rough: 0.5, at: [0, 0.01, 0.06] },
  snack: { color: 0xf6c21c, rough: 0.45, at: [0, 0.01, 0.06] },
  can: { color: 0x4f9a3a, rough: 0.45, at: [0, -0.02, 0.03] },
  wrench: { color: 0xf0802a, rough: 0.35, at: [0, 0, 0.06, Math.PI / 2, 0, 0] },
};

/** Put something in a right hand, held by the forearm it hangs from: hidden, to be shown while it is used. */
export function buildHeld(fore: THREE.Object3D, kind: HeldKind): THREE.Mesh {
  const { color, rough, at } = HELD[kind];
  const [x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0] = at;
  const held = put(fore, shapeOf(kind), mat(color, rough), x, GRIP + y, z);
  held.rotation.set(rx, ry, rz);
  held.scale.setScalar(HELD_SIZE);
  held.castShadow = false;
  held.visible = false;
  return held;
}
