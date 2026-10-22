// A puddle on the floor: kombucha fizzed over from a worn tap, amber and sticky, or sea water a storm left in a
// flooded restroom, wider and blue, lying right across the tile.

import * as THREE from 'three';

import { owned } from '../disposal';
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

/** How flood water moves: its glow wobbling between these, and its pools swelling and shrinking by this share. */
const GLOW = [0.05, 0.15] as const;
const SWELL = 0.025;

/**
 * A few overlapping pools of something shiny, flat on the floor, laid out by the puddle's id. Flood water has a
 * material of its own, which `rippleFlood` moves; it starts still, as a picture of it is taken.
 */
export function buildPuddle(id: number, flood = false): THREE.Group {
  const look = LOOK[flood ? 'flood' : 'kombucha'];
  const g = new THREE.Group();
  const wet = flood
    ? owned(
        new THREE.MeshStandardMaterial({
          color: look.color,
          roughness: 0.08,
          emissive: look.color,
          emissiveIntensity: 0,
        }),
      )
    : mat(look.color, 0.08);
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

/** How flood water looks a moment in: its glow, and how much its pools have swollen, which the next pool takes up in turn. */
export function floodRipple(t: number, id: number, pool: number): { glow: number; swell: number } {
  const wave = Math.sin(t * 1.3 + id);
  return {
    glow: GLOW[0] + ((wave + 1) / 2) * (GLOW[1] - GLOW[0]),
    swell: 1 + Math.sin(t * 1.3 + id + pool * 1.7) * SWELL,
  };
}

/** Move the flood water in a puddle built by `buildPuddle`: no new parts, only its material's glow and its pools' size. */
export function rippleFlood(g: THREE.Group, t: number, id: number) {
  g.children.forEach((pool, i) => {
    const { glow, swell } = floodRipple(t, id, i);
    const m = (pool as THREE.Mesh).material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = glow;
    pool.scale.set(swell, 1, swell);
  });
}
