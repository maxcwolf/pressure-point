// The Wall Clock model.

import * as THREE from 'three';

import { cyl, DARK, mat, partsOf, put, soft, WOOD_DARK } from '../parts';
import { HANG_Y } from './wall';

/**
 * Build the Wall Clock model: a big round wooden case and cream face, the only round thing on a wall, with bold marks at
 * the quarters and a minute hand and an hour hand that turn.
 */
export function buildWallClock(g: THREE.Group) {
  const y = HANG_Y + 0.05;
  put(g, cyl(0.28, 0.28, 0.06, 32), mat(WOOD_DARK, 0.6), 0, y, 0.03).rotation.x = Math.PI / 2;
  put(g, cyl(0.24, 0.24, 0.02, 32), mat(0xf5ecdb, 0.8), 0, y, 0.06).rotation.x = Math.PI / 2;
  const ink = mat(DARK, 0.6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    const mark = put(
      g,
      soft(long ? 0.04 : 0.025, long ? 0.075 : 0.035, 0.01),
      ink,
      Math.sin(a) * (long ? 0.18 : 0.2),
      y + Math.cos(a) * (long ? 0.18 : 0.2),
      0.072,
    );
    mark.rotation.z = -a;
  }
  // each hand turns about the middle of the face, so it is hung from a pivot there: the minute hand, then the hour hand
  const hands = [0.19, 0.125].map((len, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, y, 0.076 + i * 0.008);
    put(pivot, soft(i ? 0.045 : 0.032, len, 0.008), ink, 0, len / 2 - 0.02, 0);
    g.add(pivot);
    return pivot;
  });
  put(g, cyl(0.02, 0.02, 0.024, 12), ink, 0, y, 0.084).rotation.x = Math.PI / 2;
  partsOf(g).hands = hands;
}
