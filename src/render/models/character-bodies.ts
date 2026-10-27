// The symptoms a guest wears whole, so the ailment reads from across the room at the game's usual distance: someone
// bottled up stands in a big green bottle, corked over their head. The glass is clear enough to see them through, so
// how they feel still shows, and the bottle shrinks away with the cure.

import * as THREE from 'three';

import type { Visual } from '../../core/data';
import type { CharRig } from './character';
import { props } from './character-heads';
import { cyl, mat, put, torus } from './parts';

/**
 * The bottle's green glass, one for every bottled guest. It is see-through, so the crowd cannot draw it in a batch and
 * it draws itself; it is shared, so it is never freed.
 */
const GLASS = new THREE.MeshStandardMaterial({
  color: 0x3f9a5c,
  transparent: true,
  opacity: 0.45,
  roughness: 0.1,
  depthWrite: false,
});

/** How far up the body the middle of the bottle is, which it shrinks toward with the cure. */
const MIDDLE = 1;

/**
 * Bottled up: the whole person in a big green bottle, the cork in its neck above their head and a cream label with a
 * red stripe round the middle, their legs out of the bottom to walk on.
 */
function bottle(rig: CharRig) {
  const bottle = new THREE.Group();
  /** A height up the body, as a height in the bottle, whose middle is at `MIDDLE`. */
  const at = (y: number) => y - MIDDLE;
  put(bottle, cyl(0.31, 0.31, 1.05, 24), GLASS, 0, at(0.78), 0);
  put(bottle, cyl(0.13, 0.31, 0.16, 24), GLASS, 0, at(1.38), 0);
  put(bottle, cyl(0.13, 0.13, 0.15, 20), GLASS, 0, at(1.535), 0);
  put(bottle, torus(0.135, 0.022), GLASS, 0, at(1.61), 0).rotation.x = Math.PI / 2;
  put(bottle, cyl(0.115, 0.1, 0.16, 14), mat(0xc9a56a, 0.95), 0, at(1.66), 0);
  put(bottle, cyl(0.315, 0.315, 0.3, 24), mat(0xf2e6c8, 0.8), 0, at(0.62), 0);
  put(bottle, cyl(0.317, 0.317, 0.05, 24), mat(0xd9362f, 0.6), 0, at(0.68), 0);
  bottle.position.y = MIDDLE;
  props(rig, bottle);
  rig.body.add(bottle);
}

/** Draw a symptom the guest wears whole, if it is one. */
export function bodySymptom(rig: CharRig, visual: Visual | undefined) {
  if (visual === 'cork') bottle(rig);
}
