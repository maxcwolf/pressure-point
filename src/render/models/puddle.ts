// A puddle on the floor: kombucha fizzed over from a worn tap, amber and sticky, or sea water a storm left in a
// flooded restroom, wider and blue, lying right across the tile.

import * as THREE from 'three';

import { hash } from '../shared';
import { cyl, mat, put } from './parts';

/**
 * How each kind of puddle is drawn: its color, how many pools, how wide each is at least and at most, and how far out.
 * Flood water stops short of the edge of its tile, so it never shows through a wall beside it.
 */
const LOOK = {
  kombucha: { color: 0xd9a441, pools: 3, r: [0.16, 0.28], spread: 0.35 },
  flood: { color: 0x4f9fd6, pools: 4, r: [0.29, 0.38], spread: 0.2 },
} as const;

/** A few overlapping pools of something shiny, flat on the floor, laid out by the puddle's id. */
export function buildPuddle(id: number, flood = false): THREE.Group {
  const look = LOOK[flood ? 'flood' : 'kombucha'];
  const g = new THREE.Group();
  const wet = mat(look.color, 0.08);
  for (let i = 0; i < look.pools; i++) {
    const r = look.r[0] + hash(id, i) * (look.r[1] - look.r[0]);
    put(
      g,
      cyl(r, r, 0.01, 16),
      wet,
      (hash(id, i + 2) - 0.5) * look.spread,
      0.006 + i * 0.001,
      (hash(i + 2, id) - 0.5) * look.spread,
    );
  }
  return g;
}
