// The downtown round an office-park center: streets round its block, low office blocks with ribbon windows across
// them and towers behind those, street trees in square planters and lamp posts along the kerbs. Every part is merged
// with the others of its color, so the whole of it takes a few draw calls.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { mergeStill } from './merge';
import { blob, cached, corner, cyl, DARK, mat, put, sph } from './parts';
import { leafMaterial, type TreeSpot } from './tree';

/** An office block: where its middle stands, how wide (along x) and deep (along z) it is, its floors and its seed. */
export interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  seed: number;
}

/** How tall a floor of an office is: a little more than a person, as the center's own walls are. */
export const STOREY = 1.3;

/** How tall a block stands, to the top of its roof. */
export const blockHeight = (b: Pick<Block, 'floors'>) => b.floors * STOREY + 0.18;

/** The walls' muted colors: sandstone, gray stone, a soft terracotta and a blue-gray render. */
const BODY_COLORS = [0xe6dac4, 0xcdc6bb, 0xc99c82, 0xaab8bc] as const;
const GLASS = 0x8fb2c2;
const CAP = 0xf1ece2;
const PLANT = 0xa9aeb3;
const LINE = 0xf2e9c9;
/** The streets' asphalt, the road's color as the floor paints it, plain like the floor so the two meet unseen. */
const ASPHALT = new THREE.MeshStandardMaterial({ color: 0x5d646e, roughness: 0.9 });

/**
 * A shared rounded box with the standard corner and two segments to each rounded edge, rather than the usual three,
 * or just one for a thin part: the blocks stand well back, and there are a great many of their parts.
 */
const slab = (w: number, h: number, d: number, segments = 2) =>
  cached(`slab${w}|${h}|${d}|${segments}`, () => new RoundedBoxGeometry(w, h, d, segments, corner(w, h, d)));

/**
 * Office blocks: walls of their color, a band of windows wrapped round each floor (a taller one along the street at
 * the bottom), a pale cap along the top of the walls, and on some a plant room on the roof.
 */
export function buildOffices(blocks: readonly Block[]): THREE.Group {
  const g = new THREE.Group();
  const glass = mat(GLASS, 0.3);
  const cap = mat(CAP);
  for (const b of blocks) {
    const h = b.floors * STOREY;
    put(g, slab(b.w, h, b.d), mat(BODY_COLORS[b.seed % BODY_COLORS.length] ?? CAP), b.x, h / 2, b.z);
    for (let f = 0; f < b.floors; f++) {
      const tall = f === 0 ? 0.78 : 0.56;
      put(g, slab(b.w + 0.08, tall, b.d + 0.08, 1), glass, b.x, f * STOREY + (f === 0 ? 0.5 : 0.68), b.z);
    }
    put(g, slab(b.w + 0.16, 0.18, b.d + 0.16, 1), cap, b.x, h + 0.09, b.z);
    if (b.seed % 3 !== 0) {
      const side = b.seed % 2 ? 1 : -1;
      put(g, slab(1.2, 0.5, 0.9, 1), mat(PLANT), b.x + side * (b.w / 2 - 1), h + 0.3, b.z - b.d / 6);
    }
  }
  mergeStill(g);
  return g;
}

/** Which of the park's leaves the street trees wear, by their colors: the first and the third, so they turn with it. */
const STREET_LEAVES = [0, 2] as const;

/** Street trees: each a slim trunk with a tidy round crown, in a square planter of pale stone filled with earth. */
export function buildStreetTrees(spots: readonly TreeSpot[]): THREE.Group {
  const g = new THREE.Group();
  const stone = mat(0xd9d4ca);
  const earth = mat(0x6e5440, 0.75);
  const bark = mat(0x7a5a3c, 0.9);
  for (const { x, z, seed } of spots) {
    put(g, slab(0.86, 0.26, 0.86), stone, x, 0.13, z);
    put(g, slab(0.7, 0.04, 0.7, 1), earth, x, 0.26, z).castShadow = false;
    const trunk = 1 + (seed % 3) * 0.12;
    put(g, cyl(0.07, 0.09, trunk, 12), bark, x, trunk / 2 + 0.2, z);
    const leaves = leafMaterial(STREET_LEAVES[seed % STREET_LEAVES.length] ?? 0);
    put(g, blob(0.56), leaves, x, trunk + 0.62, z).scale.set(1, 1.12, 1);
    put(g, blob(0.34), leaves, x + 0.3, trunk + 0.35, z + 0.18);
  }
  mergeStill(g);
  return g;
}

/** Street lamps: a dark post with a warm globe under a little hood. */
export function buildLamps(spots: readonly { x: number; z: number }[]): THREE.Group {
  const g = new THREE.Group();
  const iron = mat(DARK);
  const globe = mat(0xffe9a8, 0.3, 0.7);
  for (const { x, z } of spots) {
    put(g, cyl(0.1, 0.12, 0.16, 16), iron, x, 0.08, z);
    put(g, cyl(0.05, 0.05, 2, 12), iron, x, 1.1, z);
    put(g, sph(0.15, 14), globe, x, 2.18, z).castShadow = false;
    put(g, cyl(0.06, 0.2, 0.1, 16), iron, x, 2.36, z);
  }
  mergeStill(g);
  return g;
}

/** A strip of street, from x0 to x1 and z0 to z1, lying flat just under the floor of the lot. */
export interface Street {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Streets of asphalt, with dashes down the middle of each at the given spots, flat on the ground. */
export function buildStreets(streets: readonly Street[], dashes: readonly { x: number; z: number }[]): THREE.Group {
  const g = new THREE.Group();
  for (const s of streets) {
    const strip = put(g, new THREE.PlaneGeometry(s.x1 - s.x0, s.z1 - s.z0).rotateX(-Math.PI / 2), ASPHALT);
    strip.position.set((s.x0 + s.x1) / 2, -0.02, (s.z0 + s.z1) / 2);
    strip.castShadow = false;
  }
  const line = mat(LINE);
  const dash = cached('street-dash', () => new THREE.PlaneGeometry(2 / 3, 1 / 16).rotateX(-Math.PI / 2));
  for (const { x, z } of dashes) put(g, dash, line, x, -0.015, z).castShadow = false;
  mergeStill(g);
  return g;
}
