// The Rattle and Feathers model: a gourd rattle and a fan of feathers set on a little carved stand.

import type * as THREE from 'three';

import { capsule, cyl, mat, MEMBER_MIN, put, soft, sph, WOOD_DARK } from '../parts';

/** Build the Rattle and Feathers model. */
export function buildRattle(g: THREE.Group) {
  const wood = mat(WOOD_DARK);
  put(g, soft(0.5, 0.06, 0.4), wood, 0, 0.03, 0);
  for (const x of [-0.18, 0.18]) put(g, soft(MEMBER_MIN, 0.5, MEMBER_MIN), wood, x, 0.3, -0.05);
  put(g, soft(0.46, MEMBER_MIN, 0.08), wood, 0, 0.56, -0.05);
  // the gourd rattle, hanging from the bar
  const gourd = put(g, sph(0.11, 14), mat(0xc98a3a, 0.5), -0.06, 0.34, 0.02);
  gourd.scale.set(1, 1.2, 1);
  put(g, cyl(0.025, 0.025, 0.14, 10), mat(0x6b4a2a), -0.06, 0.5, 0.02);
  // a fan of feathers, propped against the bar
  for (const [x, turn, color] of [
    [0.05, -0.35, 0xf4f1ea],
    [0.1, -0.1, 0x6b4a2a],
    [0.15, 0.15, 0xf4f1ea],
    [0.2, 0.4, 0x3a3532],
  ] as const) {
    // a feather is soft: a long thin capsule, pressed flat
    const feather = put(g, capsule(0.035, 0.26), mat(color, 0.8), x, 0.33, 0.08);
    feather.rotation.z = turn;
    feather.scale.z = 0.35;
  }
  put(g, cyl(0.03, 0.03, 0.08, 10), mat(0xa8323e), 0.12, 0.16, 0.08);
}
