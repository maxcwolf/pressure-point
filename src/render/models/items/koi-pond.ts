// The Koi Pond model.

import * as THREE from 'three';

import { cyl, mat, put, rbox, sph } from '../parts';

/** The koi: where each swims, which way it faces and its color. */
const KOI: readonly (readonly [x: number, z: number, angle: number, color: number])[] = [
  [-0.35, 0.2, 0.4, 0xf28c28],
  [0.3, -0.25, 2.6, 0xfbfaf6],
  [0.2, 0.35, -1.2, 0xe4572e],
];

/** Lily pads: where each floats and its size. */
const PADS: readonly (readonly [x: number, z: number, r: number])[] = [
  [0.45, 0.3, 0.13],
  [-0.4, -0.35, 0.11],
  [0.55, -0.05, 0.08],
];

/** Build the Koi Pond model. */
export function buildKoiPond(g: THREE.Group) {
  const stone = mat(0xb7ae9f, 0.9);
  // a low rim of stones around the water
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rock = put(g, rbox(0.34, 0.16, 0.24, 0.07), stone, Math.cos(a) * 0.82, 0.08, Math.sin(a) * 0.82);
    rock.rotation.y = -a;
  }
  put(g, cyl(0.8, 0.8, 0.04, 28), mat(0x2d5a4c, 0.9), 0, 0.02, 0);
  // the water is see-through, so the fish show under it
  const water = new THREE.MeshStandardMaterial({
    color: 0x6cc4c4,
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
  });
  put(g, cyl(0.78, 0.78, 0.02, 28), water, 0, 0.12, 0).castShadow = false;
  for (const [x, z, angle, color] of KOI) {
    const fish = new THREE.Group();
    put(fish, sph(0.09, 10), mat(color, 0.4), 0, 0, 0).scale.set(2, 0.6, 0.9);
    put(fish, rbox(0.1, 0.02, 0.13, 0.01), mat(color, 0.4), -0.2, 0, 0);
    fish.position.set(x, 0.1, z);
    fish.rotation.y = angle;
    g.add(fish);
  }
  const pad = mat(0x5f9e4f, 0.7);
  for (const [x, z, r] of PADS) put(g, cyl(r, r, 0.01, 12), pad, x, 0.135, z).castShadow = false;
  put(g, sph(0.035, 8), mat(0xf4b6c2, 0.6), 0.45, 0.16, 0.3);
}
