// A mop, held in both hands by a Caretaker mopping up the water a storm left in a flooded restroom.

import * as THREE from 'three';

import { capsule, cyl, mat, put } from './parts';

/** How far the mop's handle runs down from where it is held to the head, and up past the hands, in meters. */
const REACH = 0.79;
const TOP = 0.14;

/**
 * A mop held in both hands in front of the body: a wooden handle running down from the grip, and a grey head of
 * strands across its foot. Its origin is the grip. Hidden until someone mops.
 */
export function buildMop(): THREE.Group {
  const mop = new THREE.Group();
  const handle = put(mop, cyl(0.03, 0.03, REACH + TOP, 8), mat(0xb9834f, 0.6), 0, (TOP - REACH) / 2, 0);
  handle.castShadow = false;
  const head = put(mop, capsule(0.08, 0.26), mat(0x9aa0a6, 0.95), 0, -REACH, 0);
  head.rotation.z = Math.PI / 2;
  head.scale.set(1, 1, 0.65);
  mop.visible = false;
  return mop;
}
