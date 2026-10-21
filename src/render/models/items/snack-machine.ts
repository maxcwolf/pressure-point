// The Granola Dispenser model.

import * as THREE from 'three';

import { at } from '../../../core/util';
import { owned } from '../../disposal';
import { clay } from '../clay';
import { DARK, mat, partsOf, put } from '../parts';

/** Build the Granola Dispenser model. */
export function buildSnackMachine(g: THREE.Group) {
  put(g, clay(0.86, 1.6, 0.68), mat(0xcf8d48), 0, 0.8, -0.1);
  // each dispenser lights its own window, so it can flicker as it wears and go dark when it breaks
  const lamp = owned(
    new THREE.MeshStandardMaterial({ color: 0xfff3c4, roughness: 0.4, emissive: 0xfff3c4, emissiveIntensity: 0.35 }),
  );
  put(g, clay(0.62, 0.86, 0.04), lamp, 0, 1.02, 0.24);
  partsOf(g).lamp = lamp;
  // three kinds of bar, each in its own wrapper
  const snacks = [0xe76f51, 0x8ab17d, 0xe9c46a];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      put(g, clay(0.1, 0.14, 0.05), mat(at(snacks, (r + c) % snacks.length)), -0.21 + c * 0.14, 0.76 + r * 0.26, 0.27);
  put(g, clay(0.5, 0.14, 0.05), mat(DARK), 0, 0.3, 0.24);
}
