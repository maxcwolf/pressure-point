// The Woven Rug model, in each of its patterns.

import type * as THREE from 'three';

import { RUG_PATTERNS, type RugPatternId } from '../../../core/data';
import { soft } from '../clay';
import { cyl, mat, put } from '../parts';

/** Lay one flat layer of the rug, a hair above the one under it, so it never flickers. */
const layer = (g: THREE.Group, shape: THREE.BufferGeometry, color: number, y: number, x = 0, z = 0) => {
  const m = put(g, shape, mat(color, 0.95), x, y, z);
  m.castShadow = false;
  return m;
};

/** Build the Woven Rug model: a border, a band and a field, with a diamond, a round medallion or stripes woven in. */
export function buildRug(g: THREE.Group, pattern: RugPatternId = 'kilim') {
  const { colors, motif } = RUG_PATTERNS[pattern];
  const [border, band, field, mid] = colors;
  layer(g, soft(1.84, 0.03, 1.84), border, 0.016);
  layer(g, soft(1.5, 0.034, 1.5), band, 0.018);
  layer(g, soft(1.16, 0.038, 1.16), field, 0.02);
  if (motif === 'diamond') layer(g, soft(0.56, 0.042, 0.56), mid, 0.022).rotation.y = Math.PI / 4;
  else if (motif === 'medallion') {
    layer(g, cyl(0.42, 0.42, 0.042, 24), band, 0.022);
    layer(g, cyl(0.26, 0.26, 0.046, 24), mid, 0.024);
  } else for (const x of [-0.4, 0, 0.4]) layer(g, soft(0.2, 0.042, 1.16), mid, 0.022, x);
}
