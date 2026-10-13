// The Salt Lamp model.

import type * as THREE from 'three';

import { cyl, ico, mat, put, WOOD_DARK } from '../parts';

/** Build the Salt Lamp model. */
export function buildSaltLamp(g: THREE.Group) {
  put(g, cyl(0.2, 0.22, 0.08, 16), mat(WOOD_DARK), 0, 0.04, 0);
  const salt = put(g, ico(0.24), mat(0xff9d5c, 0.5, 0.75), 0, 0.3, 0);
  salt.scale.set(0.85, 1.25, 0.85);
  salt.castShadow = false;
}
