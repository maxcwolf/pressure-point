// A high street's dressing beyond the lot: pavements in the lot's own stone, and hedges on a low brick wall along the
// back of the pavement. The road and the lamp posts are downtown's (`models/downtown.ts`).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { mergeStill } from './merge';
import { cached, corner, mat, put } from './parts';

/** The pavement's stone: between the two shades of the lot's own pavement, so the two meet without a seam. */
const PAVEMENT = new THREE.MeshStandardMaterial({ color: 0xd4ccbc, roughness: 0.95 });
const BRICK = 0xb5806a;
const COPING = 0xd9cfc0;
const HEDGE = 0x5b8f4e;

/** A shared rounded slab, for a wall or a hedge. */
const slab = (w: number, h: number, d: number, segments = 1) =>
  cached(`hedge${w}|${h}|${d}|${segments}`, () => new RoundedBoxGeometry(w, h, d, segments, corner(w, h, d)));
/** A shared square-edged box, for a wall's coping. */
const box = (w: number, h: number, d: number) => cached(`coping${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));

/** Hedges on a low brick wall with a stone coping, each run along x from x0 to x1, the wall's street face at z. */
export function buildHedges(runs: readonly { x0: number; x1: number; z: number }[]): THREE.Group {
  const g = new THREE.Group();
  const brick = mat(BRICK);
  const coping = mat(COPING);
  const leaf = mat(HEDGE, 0.9);
  for (const r of runs) {
    const len = r.x1 - r.x0;
    if (len < 0.5) continue;
    const x = (r.x0 + r.x1) / 2;
    put(g, slab(len, 0.32, 0.26), brick, x, 0.16, r.z + 0.18);
    put(g, box(len + 0.04, 0.05, 0.32), coping, x, 0.34, r.z + 0.18);
    put(g, slab(len, 0.5, 0.42, 2), leaf, x, 0.25, r.z - 0.18);
  }
  mergeStill(g);
  return g;
}

/** Strips of pavement flat on the ground, which take shadows but cast none. */
export function buildPavements(strips: readonly { x0: number; x1: number; z0: number; z1: number }[]): THREE.Group {
  const g = new THREE.Group();
  for (const s of strips) {
    const m = put(g, new THREE.PlaneGeometry(s.x1 - s.x0, s.z1 - s.z0).rotateX(-Math.PI / 2), PAVEMENT);
    m.position.set((s.x0 + s.x1) / 2, -0.018, (s.z0 + s.z1) / 2);
    m.castShadow = false;
    m.receiveShadow = true;
  }
  mergeStill(g);
  return g;
}
