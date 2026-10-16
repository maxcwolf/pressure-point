// A building site on a plot of land: bare earth, fenced off by gray posts a tile apart with rails striped orange and
// white between them.

import * as THREE from 'three';

import type { Rect } from '../../core/data';
import { mergeStill } from './merge';
import { cached, mat, put, WHITE } from './parts';

/** A straight run of fence, along x at z = line or along z at x = line, from a to b. */
export interface FenceRun {
  horizontal: boolean;
  line: number;
  a: number;
  b: number;
}

const POST = 0x8a8f96;
const ORANGE = 0xf08a24;
const EARTH = 0x9c7a52;
/** How high the rails stand. */
const RAILS = [0.42, 0.82];

/** A box one unit each way, stretched into every part. */
const unitBox = () => cached('unit-box', () => new THREE.BoxGeometry(1, 1, 1));

/** Fence along these runs, around bare earth over these rectangles of tiles. */
export function buildSite(runs: readonly FenceRun[], rects: readonly Rect[]): THREE.Group {
  const g = new THREE.Group();
  const box = unitBox();
  for (const r of runs) {
    /** The point t along the run, on the ground. */
    const at = (t: number): [x: number, z: number] => (r.horizontal ? [t, r.line] : [r.line, t]);
    for (let t = r.a; t <= r.b; t++) {
      const [x, z] = at(t);
      put(g, box, mat(POST), x, 0.5, z).scale.set(0.07, 1, 0.07);
    }
    for (let t = r.a; t < r.b; t++) {
      const [x, z] = at(t + 0.5);
      for (const y of RAILS) {
        const rail = put(g, box, mat(t % 2 ? WHITE : ORANGE), x, y, z);
        rail.scale.set(r.horizontal ? 0.94 : 0.04, 0.1, r.horizontal ? 0.04 : 0.94);
      }
    }
  }
  for (const rect of rects) {
    const w = rect.x1 - rect.x0 + 1;
    const d = rect.y1 - rect.y0 + 1;
    const earth = put(g, box, mat(EARTH, 0.95), rect.x0 + w / 2, 0.004, rect.y0 + d / 2);
    earth.scale.set(w, 0.008, d);
    earth.castShadow = false;
  }
  mergeStill(g);
  return g;
}
