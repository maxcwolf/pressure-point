// The Kombucha Tap model.

import type * as THREE from 'three';

import { CHROME, cyl, mat, put, rbox, soft, WOOD } from '../parts';

/** The stand under the barrel. */
const WOOD_STAND = 0x7a5a3c;

/** Build the Kombucha Tap model: a wooden barrel on its side on a stand, a brass tap, and glasses on a shelf. */
export function buildKombuchaTap(g: THREE.Group) {
  const wood = mat(WOOD_STAND, 0.8);
  put(g, soft(0.7, 0.55, 0.6), wood, 0, 0.28, -0.08);
  for (const x of [-0.22, 0.22]) put(g, soft(0.08, 0.12, 0.5), wood, x, 0.6, -0.08);
  const barrel = put(g, cyl(0.26, 0.26, 0.64, 24), mat(WOOD, 0.8), 0, 0.86, -0.08);
  barrel.rotation.x = Math.PI / 2;
  const hoop = mat(0x3b3f4a, 0.5);
  for (const z of [-0.32, -0.08, 0.16]) {
    const band = put(g, cyl(0.272, 0.272, 0.04, 24), hoop, 0, 0.86, z);
    band.rotation.x = Math.PI / 2;
  }
  // the tap, low on the barrel's end
  const spout = put(g, cyl(0.025, 0.025, 0.12, 10), mat(0xd4a94a, 0.3), 0, 0.72, 0.3);
  spout.rotation.x = Math.PI / 2;
  put(g, rbox(0.03, 0.1, 0.03, 0.01), mat(0xd4a94a, 0.3), 0, 0.79, 0.34);
  put(g, cyl(0.03, 0.03, 0.04, 10), mat(0xd4a94a, 0.3), 0, 0.68, 0.35);
  // a drip tray, and a glass of something cloudy on the shelf
  put(g, rbox(0.2, 0.03, 0.14, 0.01), mat(CHROME, 0.3), 0, 0.57, 0.28);
  put(g, cyl(0.035, 0.03, 0.1, 10), mat(0xe9b85a, 0.2), 0.22, 0.61, 0.16);
}
