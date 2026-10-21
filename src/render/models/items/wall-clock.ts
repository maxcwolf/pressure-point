// The Wall Clock model.

import * as THREE from 'three';

import { soft } from '../clay';
import { cyl, DARK, mat, partsOf, put, WOOD_DARK } from '../parts';
import { HANG_Y } from './wall';

/** Build the Wall Clock model: a round wooden case and cream face, with a minute hand and an hour hand that turn. */
export function buildWallClock(g: THREE.Group) {
  const y = HANG_Y + 0.05;
  put(g, cyl(0.19, 0.19, 0.05, 24), mat(WOOD_DARK, 0.6), 0, y, 0.025).rotation.x = Math.PI / 2;
  put(g, cyl(0.165, 0.165, 0.02, 24), mat(0xf5ecdb, 0.8), 0, y, 0.05).rotation.x = Math.PI / 2;
  const ink = mat(DARK, 0.6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    const mark = put(g, soft(0.02, long ? 0.04 : 0.025, 0.01), ink, Math.sin(a) * 0.14, y + Math.cos(a) * 0.14, 0.062);
    mark.rotation.z = -a;
  }
  // each hand turns about the middle of the face, so it is hung from a pivot there
  const hands = [0.13, 0.085].map((len, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, y, 0.066 + i * 0.006);
    put(pivot, soft(i ? 0.026 : 0.02, len, 0.006), ink, 0, len / 2 - 0.015, 0);
    g.add(pivot);
    return pivot;
  });
  put(g, cyl(0.012, 0.012, 0.02, 10), ink, 0, y, 0.07).rotation.x = Math.PI / 2;
  partsOf(g).hands = hands;
}
