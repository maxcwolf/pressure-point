// A puddle on the floor: kombucha fizzed over from a worn tap, amber and sticky, or sea water a storm left in a
// flooded restroom, wider, a bright cyan and lying right across the tile, with rings spreading over it.

import * as THREE from 'three';

import { owned } from '../disposal';
import { hash } from '../shared';
import { cached, cyl, mat, put } from './parts';

/**
 * How each kind of puddle is drawn: its color, how many pools, how wide each is at least and at most, and how far out.
 * Flood water stops short of the edge of its tile, so it never shows through a wall beside it.
 */
const LOOK = {
  kombucha: { color: 0xd9a441, pools: 3, r: [0.16, 0.28], spread: 0.35 },
  flood: { color: 0x6fd0f2, pools: 4, r: [0.35, 0.42], spread: 0.13 },
} as const;

/**
 * How flood water moves: its glow wobbling between these, lit a little from within so it reads as water and not a
 * rug, and its pools swelling and shrinking by this share.
 */
const GLOW = [0.22, 0.38] as const;
const SWELL = 0.025;
/** How many rings spread over flood water at a time, how wide they grow, and how long each takes, in seconds. */
const RINGS = 2;
const RING_REACH = 0.44;
const RING_EVERY = 2.2;

/** A flat ring lying on the water: one shape for every ring on every puddle. */
const ringShape = () => cached('flood-ring', () => new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2));

/** The parts of flood water that move: its pools, and the rings spreading over them. */
export interface FloodParts {
  pools: THREE.Mesh[];
  rings: THREE.Mesh[];
}

/** The moving parts of a puddle built by `buildPuddle`: none for kombucha, which lies still. */
export const floodParts = (g: THREE.Group) => g.userData as Partial<FloodParts>;

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
  const pools: THREE.Mesh[] = [];
  for (let i = 0; i < look.pools; i++) {
    const r = look.r[0] + hash(id, i) * (look.r[1] - look.r[0]);
    pools.push(
      put(
        g,
        cyl(r, r, 0.01, 16),
        wet,
        (hash(id, i + 2) - 0.5) * look.spread,
        0.006 + i * 0.001,
        (hash(i + 2, id) - 0.5) * look.spread,
      ),
    );
  }
  if (!flood) return g;
  // rings spreading over the water, each fading on its own, hidden until the water moves
  const rings = Array.from({ length: RINGS }, () => {
    const ring = put(
      g,
      ringShape(),
      owned(new THREE.MeshBasicMaterial({ color: 0xe4f8ff, transparent: true, opacity: 0, depthWrite: false })),
      0,
      0.02,
      0,
    );
    ring.castShadow = false;
    ring.receiveShadow = false;
    ring.visible = false;
    return ring;
  });
  Object.assign(g.userData, { pools, rings } satisfies FloodParts);
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

/** How far a ring on flood water has spread a moment in, from 0 to 1: each its own way through, starting again once out. */
export const ringSpread = (t: number, id: number, ring: number) =>
  ((((t + ring * (RING_EVERY / RINGS) + id * 0.73) / RING_EVERY) % 1) + 1) % 1;

/**
 * Move the flood water in a puddle built by `buildPuddle`: no new parts, only its material's glow, its pools' size,
 * and its rings spreading and fading as they go.
 */
export function rippleFlood(g: THREE.Group, t: number, id: number) {
  const { pools = [], rings = [] } = floodParts(g);
  pools.forEach((pool, i) => {
    const { glow, swell } = floodRipple(t, id, i);
    const m = pool.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = glow;
    pool.scale.set(swell, 1, swell);
  });
  rings.forEach((ring, i) => {
    const f = ringSpread(t, id, i);
    ring.visible = true;
    ring.scale.setScalar(0.06 + f * (RING_REACH - 0.06));
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.min(1, f * 5) * (1 - f);
  });
}
