// The Prayer Flags model.

import * as THREE from 'three';

import { mat, partsOf, put, rbox } from '../parts';
import { HANG_Y } from './wall';

/** The flags' colors, in the order they are always strung: sky, cloud, fire, water and earth. */
const COLORS = [0x3d7fc4, 0xf5f2ea, 0xd8433f, 0x4caf50, 0xf2cf3e];

/** Build the Prayer Flags model: a string sagging between two pins, two tiles across, with a row of flags that flutter. */
export function buildPrayerFlags(g: THREE.Group) {
  const top = HANG_Y + 0.32;
  const span = 1.7;
  const n = 10;
  const string = mat(0xd9d2c5, 0.8);
  for (const x of [-span / 2, span / 2]) put(g, rbox(0.045, 0.045, 0.05, 0.012), mat(0x8a8f99, 0.4), x, top, 0.02);
  /** How far the string sags at a point along it. */
  const sag = (x: number) => 0.09 * (1 - (2 * x) / span) * (1 + (2 * x) / span);
  const flags: THREE.Object3D[] = [];
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span / n) * (i + 0.5);
    const piece = put(g, rbox(span / n, 0.014, 0.014, 0.006), string, x, top - sag(x), 0.04);
    // along the curve of the string at that point
    piece.rotation.z = Math.atan(((0.36 * x) / (span * span)) * 2);
    // each flag hangs from the string, so it flutters from there
    const pivot = new THREE.Group();
    pivot.position.set(x, top - sag(x), 0.045);
    put(pivot, rbox(0.14, 0.17, 0.008, 0.004), mat(COLORS[i % COLORS.length] ?? 0xffffff, 0.95), 0, -0.085, 0);
    g.add(pivot);
    flags.push(pivot);
  }
  partsOf(g).flags = flags;
}
