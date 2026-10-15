// The Instructor's Mat model: a low red platform with a gold border, and a yin-yang inlaid at its center.

import type * as THREE from 'three';

import { cyl, mat, put, rbox } from '../parts';

/** Build the Instructor's Mat model. */
export function buildInstructorMat(g: THREE.Group) {
  put(g, rbox(0.92, 0.06, 0.92, 0.03), mat(0xd9b45a, 0.6), 0, 0.03, 0);
  put(g, rbox(0.8, 0.07, 0.8, 0.03), mat(0xb0473a, 0.85), 0, 0.035, 0);
  // a yin-yang: a pale disc, half of it dark, with a dot of each in the other
  put(g, cyl(0.2, 0.2, 0.01, 28), mat(0xf5ecdb, 0.8), 0, 0.074, 0).castShadow = false;
  put(g, rbox(0.2, 0.012, 0.4, 0.005), mat(0x2b2b30, 0.8), 0.1, 0.076, 0).castShadow = false;
  put(g, cyl(0.1, 0.1, 0.014, 20), mat(0x2b2b30, 0.8), 0, 0.078, -0.1).castShadow = false;
  put(g, cyl(0.1, 0.1, 0.014, 20), mat(0xf5ecdb, 0.8), 0, 0.078, 0.1).castShadow = false;
  put(g, cyl(0.03, 0.03, 0.018, 12), mat(0xf5ecdb, 0.8), 0, 0.08, -0.1).castShadow = false;
  put(g, cyl(0.03, 0.03, 0.018, 12), mat(0x2b2b30, 0.8), 0, 0.08, 0.1).castShadow = false;
}
