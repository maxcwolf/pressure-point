// The Aquarium model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { capsule, DARK, mat, partsOf, put, rbox, soft, sph, WHITE, WOOD } from '../parts';

/** The fish: where each swims and its color, warm against the blue so they show from above. */
const FISH: readonly (readonly [x: number, y: number, z: number, color: number])[] = [
  [-0.5, 1.02, 0.05, 0xf4a261],
  [0.25, 1.16, -0.08, 0xf2c14e],
  [0.58, 0.92, 0.08, 0xe76f51],
  [-0.12, 0.84, -0.04, 0xf2c14e],
];

/** The top of the water, a little under the rim. */
const SURFACE = 1.32;

/**
 * Build the Aquarium model: a glass tank of blue water on a wooden stand, open at the top under a thin dark rim, so the
 * game's camera, high above, looks down into the water at the fish.
 */
export function buildAquarium(g: THREE.Group) {
  put(g, soft(1.8, 0.6, 0.6), mat(WOOD), 0, 0.3, 0);
  // the water is see-through, so it gets a material of its own rather than a shared solid one
  const water = owned(
    new THREE.MeshStandardMaterial({
      color: 0x3a9fdc,
      emissive: 0x2a8fc4,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.5,
      roughness: 0.05,
    }),
  );
  put(g, rbox(1.76, SURFACE - 0.6, 0.56, 0.02), water, 0, (SURFACE + 0.6) / 2, 0).castShadow = false;
  put(g, rbox(1.74, 0.06, 0.54, 0.02), mat(0xe9d8a6, 0.9), 0, 0.64, 0);
  // a thin dark frame round the glass, along its foot and round the open top
  const frame = mat(DARK);
  for (const y of [0.62, 1.42]) {
    for (const z of [-0.29, 0.29]) put(g, rbox(1.82, 0.045, 0.035, 0.012), frame, 0, y, z);
    for (const x of [-0.89, 0.89]) put(g, rbox(0.035, 0.045, 0.62, 0.012), frame, x, y, 0);
  }
  // fronds of weed, rounded at their tips, leaning a little in the water
  for (const [x, h, lean] of [
    [-0.75, 0.4, 0.12],
    [-0.66, 0.26, -0.2],
    [0.7, 0.3, -0.1],
    [0.1, 0.22, 0.15],
  ] as const)
    put(g, capsule(0.035, h - 0.07), mat(0x4f9a55, 0.8), x, 0.67 + h / 2, -0.15).rotation.z = lean;
  for (const [x, y, z, color] of FISH) {
    const fish = put(g, sph(0.08, 12), mat(color, 0.4, 0.6), x, y, z);
    fish.scale.set(1.7, 1, 0.8);
    put(g, rbox(0.05, 0.11, 0.03, 0.012), mat(color, 0.4, 0.6), x - 0.16, y, z);
  }
  // bubbles rising from the corner
  const bubbles = new THREE.Group();
  for (let i = 0; i < 3; i++) put(bubbles, sph(0.035, 8), mat(WHITE, 0.2), 0, 0, 0).castShadow = false;
  bubbles.position.set(0.78, 0.72, 0.1);
  g.add(bubbles);
  partsOf(g).puffs = bubbles;
}
