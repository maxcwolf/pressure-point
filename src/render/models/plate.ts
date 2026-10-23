// The brass plate on upgraded treatment equipment: a gold star on navy enamel for each level installed, big enough to
// count from the default zoom.

import * as THREE from 'three';

import type { ItemType } from '../../core/data';
import { cached, mat, put, rbox } from './parts';

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
  // on a machine, somewhere that stays still while its gag plays, clear of where the guest and the staff stand
  kneadmaster: { x: 0.8, y: 0.2, z: 1.0, flat: true },
  pin_press: { x: 0.95, y: 0.15, z: 0.22 },
  aura_wash: { x: 0.5, y: 2.4, z: 1.98 },
  great_alphorn: { x: 0, y: 0.3, z: -1.31 },
  cider_press: { x: 0, y: 0.45, z: 0.82 },
  wheel_of_rebirth: { x: 0, y: 0.21, z: 2.19, flat: true },
  stone_kiln: { x: 0, y: 0.98, z: -0.15 },
  octopus: { x: 0, y: 0.68, z: -0.23 },
  geode: { x: 0, y: 0.07, z: 0.85, flat: true },
};

const BRASS = 0xc9a227;
/** The plate's face: navy enamel, so its gold stars stand out on it from across the room. */
const ENAMEL = 0x2f3a5e;
const STAR = 0xffd75e;

/** How big a star on the plate is, point to point, and how far apart they stand: each a few pixels at the default zoom. */
export const STAR_SIZE = 0.12;
const STAR_GAP = 0.15;

/** A five-pointed star `size` across, point to point, standing up and facing the front, with softened edges. */
export const starShape = (size: number, depth = 0.02) =>
  cached(`star${size}|${depth}`, () => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = (i % 2 ? 0.42 : 1) * (size / 2);
      if (i) shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
      else shape.moveTo(0, r);
    }
    const bevel = Math.min(depth / 2, size * 0.06);
    return new THREE.ExtrudeGeometry(shape, { depth, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  });

/** The plate for a piece of equipment upgraded to a level, or null if it has none or has no spot for one. */
export function upgradePlate(type: ItemType, level: number): THREE.Group | null {
  const spot = SPOTS[type];
  if (!spot || level <= 0) return null;
  const g = new THREE.Group();
  put(g, rbox(0.54, 0.2, 0.02, 0.01), mat(BRASS, 0.35), 0, 0, 0);
  put(g, rbox(0.48, 0.15, 0.02, 0.008), mat(ENAMEL, 0.5), 0, 0, 0.008);
  for (let i = 0; i < level; i++)
    put(g, starShape(STAR_SIZE), mat(STAR, 0.3, 0.6), (i - (level - 1) / 2) * STAR_GAP, 0, 0.016);
  g.position.set(spot.x, spot.y, spot.z);
  if (spot.flat) g.rotation.x = -Math.PI / 2;
  return g;
}
