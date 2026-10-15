// The Air Conditioner model.

import * as THREE from 'three';

import { DARK, mat, put, rbox, WHITE } from '../parts';

/** Build the Air Conditioner model: a tall white unit with a grille, a cool blue light and a little display. */
export function buildAirConditioner(g: THREE.Group) {
  put(g, rbox(0.5, 1.3, 0.38, 0.08), mat(WHITE, 0.5), 0, 0.65, -0.05);
  for (let i = 0; i < 6; i++) put(g, rbox(0.38, 0.025, 0.02, 0.008), mat(0xc9ced6), 0, 0.9 + i * 0.06, 0.15);
  put(g, rbox(0.4, 0.3, 0.02, 0.02), mat(0xdfe3e8), 0, 0.42, 0.15);
  const light = new THREE.MeshStandardMaterial({ color: 0x7cc4e8, emissive: 0x4ab3f0, emissiveIntensity: 1.2 });
  put(g, rbox(0.3, 0.02, 0.02, 0.008), light, 0, 0.78, 0.15);
  put(g, rbox(0.12, 0.06, 0.02, 0.01), mat(DARK, 0.3), 0.1, 1.2, 0.15);
}
