// The brass plate on upgraded treatment equipment: a star on it for each level installed.

import * as THREE from 'three';

import type { ItemType } from '../../core/data';
import { mat, put, rbox, sph } from './parts';

/** Where the plate goes on each kind of equipment, in its model's own space, and whether it lies flat. */
const SPOTS: Partial<Record<ItemType, { x: number; y: number; z: number; flat?: boolean }>> = {
  // on the foot of a table, under its top
  massage_table: { x: 0, y: 0.4, z: 0.9 },
  acu_table: { x: 0, y: 0.4, z: 0.9 },
  reiki_table: { x: 0, y: 0.4, z: 0.9 },
  // on the front of the scanner's console
  posture_scanner: { x: -0.5, y: 0.3, z: 0.11 },
  // lying on the folded blanket at the foot of a mat
  sound_mat: { x: 0, y: 0.17, z: 0.76, flat: true },
};

const BRASS = 0xc9a227;
const STAR = 0xfff1b8;

/** The plate for a piece of equipment upgraded to a level, or null if it has none or has no spot for one. */
export function upgradePlate(type: ItemType, level: number): THREE.Group | null {
  const spot = SPOTS[type];
  if (!spot || level <= 0) return null;
  const g = new THREE.Group();
  put(g, rbox(0.4, 0.13, 0.02, 0.01), mat(BRASS, 0.35), 0, 0, 0);
  for (let i = 0; i < level; i++) {
    const star = put(g, sph(0.03, 8), mat(STAR, 0.3, 0.6), (i - (level - 1) / 2) * 0.1, 0, 0.014);
    star.scale.z = 0.5;
  }
  g.position.set(spot.x, spot.y, spot.z);
  if (spot.flat) g.rotation.x = -Math.PI / 2;
  return g;
}
