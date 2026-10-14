// The Aquarium model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cyl, DARK, mat, partsOf, put, rbox, sph, WHITE } from '../parts';

/** The fish: where each swims and its color. */
const FISH: readonly (readonly [x: number, y: number, z: number, color: number])[] = [
  [-0.5, 1.0, 0.05, 0xf4a261],
  [0.25, 1.18, -0.1, 0xf2c14e],
  [0.6, 0.9, 0.08, 0x5fa8d3],
  [-0.15, 0.82, -0.05, 0xe76f51],
];

/** Build the Aquarium model. */
export function buildAquarium(g: THREE.Group) {
  put(g, rbox(1.8, 0.6, 0.6, 0.04), mat(DARK), 0, 0.3, 0);
  // the water is see-through, so it gets a material of its own rather than a shared solid one
  const water = owned(
    new THREE.MeshStandardMaterial({
      color: 0x5ec8f2,
      emissive: 0x2a8fc4,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.4,
      roughness: 0.05,
    }),
  );
  put(g, rbox(1.8, 0.78, 0.6, 0.03), water, 0, 0.99, 0).castShadow = false;
  put(g, rbox(1.74, 0.06, 0.54, 0.02), mat(0xe9d8a6, 0.9), 0, 0.64, 0);
  put(g, rbox(1.84, 0.06, 0.64, 0.02), mat(DARK), 0, 1.43, 0);
  for (const [x, h] of [
    [-0.75, 0.4],
    [0.7, 0.3],
    [0.1, 0.22],
  ] as const)
    put(g, cyl(0.02, 0.03, h, 6), mat(0x4f9a55, 0.8), x, 0.67 + h / 2, -0.15);
  for (const [x, y, z, color] of FISH) {
    const fish = put(g, sph(0.06, 10), mat(color, 0.4, 0.3), x, y, z);
    fish.scale.set(1.7, 1, 0.7);
    put(g, rbox(0.04, 0.08, 0.02, 0.01), mat(color, 0.4, 0.3), x - 0.12, y, z);
  }
  // bubbles rising from the corner
  const bubbles = new THREE.Group();
  for (let i = 0; i < 3; i++) put(bubbles, sph(0.035, 8), mat(WHITE, 0.2), 0, 0, 0).castShadow = false;
  bubbles.position.set(0.78, 0.72, 0.1);
  g.add(bubbles);
  partsOf(g).puffs = bubbles;
}
