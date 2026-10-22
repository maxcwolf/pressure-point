// The Zen Fountain model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cached, cyl, mat, partsOf, put, sph } from '../parts';

/** Where the water spills over the rim of the upper bowl, and the surface of the pool it falls into, in meters. */
const LIP = { r: 0.237, y: 0.795 };
const POOL_Y = 0.256;
/** How far out from the lip the falling water has curved by the time it lands. */
const THROW = 0.07;
/** Where the falling water lands, out from the middle. */
const LANDS_R = LIP.r + THROW;

/** How many times a second the runs of falling water go the length of the sheet. */
export const SPILL_SPEED = 0.9;

/**
 * The sheet of water falling from the lip to the pool: an open shell turned on a lathe, curving out as falling water
 * does, since it leaves the lip level and drops ever faster. Its texture runs from the pool (0) up to the lip (1).
 */
const sheetShape = () =>
  cached('fountain-sheet', () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 8; i >= 0; i--) {
      const f = i / 8;
      pts.push(new THREE.Vector2(LIP.r + THROW * Math.sqrt(f), LIP.y - (LIP.y - POOL_Y) * f));
    }
    return new THREE.LatheGeometry(pts, 40);
  });

/** A number from 0 to 1 that looks random but is always the same for the same input. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const { smoothstep } = THREE.MathUtils;

/** How many streams the falling water parts into in each repeat of its pictures, and how many repeats go round. */
const STREAMS = 4;
const ROUND = 3;

/**
 * How much of the falling water shows, by how far round the sheet (`u`) and up it (`v`, from the pool at 0 to the lip
 * at 1): it rolls over the lip as one glassy film, which parts into streams that spread a little as they fall.
 */
function streamShows(u: number, v: number): number {
  const slot = u * STREAMS;
  const k = Math.floor(slot);
  // how far across from the middle of its stream, in streams, each stream a little off the even spacing
  const across = Math.abs(slot - k - 0.5 - (hash(k) - 0.5) * 0.2);
  const half = 0.12 + 0.06 * hash(k + 5) + 0.08 * (1 - v);
  const stream = 1 - smoothstep(across, half - 0.04, half + 0.04);
  return Math.max(stream, 0.6 * smoothstep(v, 0.72, 0.95));
}

/** How bright each stream is along its length: brighter runs one after another, each stream on its own beat. */
function runShows(u: number, v: number): number {
  const beat = hash(Math.floor(u * STREAMS) + 11);
  return 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((2 * v + beat) * Math.PI * 2)) ** 3;
}

/**
 * A picture of how much shows at each point, `W` by `H`, that wraps both ways and repeats `ROUND` times round the
 * sheet: as the color's own alpha, or for an alpha map, which reads it from the green.
 */
function wrapping(W: number, H: number, shows: (u: number, v: number) => number, alphaMap: boolean) {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = Math.round(255 * Math.min(1, shows((x + 0.5) / W, (y + 0.5) / H)));
      data.set(alphaMap ? [a, a, a, 255] : [255, 255, 255, a], (y * W + x) * 4);
    }
  const tex = new THREE.DataTexture(data, W, H);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ROUND, 1);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
let runs: THREE.DataTexture | null = null;

/** The brighter runs down the falling water, shared by every fountain, which move down the sheet as it flows. */
export const spillRuns = () => (runs ??= wrapping(32, 64, runShows, true));

let sheetMat: THREE.MeshStandardMaterial | null = null;

/** The falling water's material, shared by every fountain: pale and glossy, and seen through between its streams. */
const fallingWater = () =>
  (sheetMat ??= new THREE.MeshStandardMaterial({
    color: 0xc4ecfb,
    emissive: 0x86d3f0,
    emissiveIntensity: 0.5,
    roughness: 0.15,
    map: wrapping(64, 64, streamShows, false),
    alphaMap: spillRuns(),
    transparent: true,
    depthWrite: false,
  }));

/** A flat ring lying level on the water, for the rings that spread round the orb. */
const ringShape = () => cached('fountain-ring', () => new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2));

/** The foam where the falling water lands: a fat ring, which the fountain's motion flattens onto the pool. */
const foamShape = () =>
  cached('fountain-foam', () => new THREE.TorusGeometry(LANDS_R, 0.03, 8, 40).rotateX(Math.PI / 2));

/** A see-through white for one part of the moving water, so each can swell and fade on its own. */
const froth = () =>
  owned(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));

/** Add a part of the moving water: not picked, casting no shadow, and drawn after the solid parts. */
function water(g: THREE.Group, shape: THREE.BufferGeometry, material: THREE.Material, y: number): THREE.Mesh {
  const m = put(g, shape, material, 0, y, 0);
  m.castShadow = false;
  m.receiveShadow = false;
  /** The water is not there to be clicked: a click goes to the fountain itself. */
  m.raycast = () => undefined;
  m.renderOrder = 1;
  return m;
}

/**
 * Build the Zen Fountain model: a stone basin, a column and a bowl brimming with water, which spills over its rim all
 * the way round into the basin, round a floating orb.
 */
export function buildFountain(g: THREE.Group) {
  const stone = mat(0xbdb6aa, 0.9);
  const pool = mat(0x6ec6e6, 0.15, 0.25);
  put(g, cyl(0.44, 0.46, 0.24, 24), stone, 0, 0.12, 0);
  put(g, cyl(0.37, 0.37, 0.02, 24), pool, 0, 0.245, 0);
  put(g, cyl(0.08, 0.11, 0.5), stone, 0, 0.45, 0);
  put(g, cyl(0.24, 0.1, 0.12, 24), stone, 0, 0.72, 0);
  // brimming right to the rim, where it spills over
  put(g, cyl(LIP.r, LIP.r, 0.02, 24), pool, 0, 0.785, 0);
  const orb = put(g, sph(0.09), pool, 0, 0.9, 0);
  const sheet = water(g, sheetShape(), fallingWater(), 0);
  const foam = water(g, foamShape(), froth(), POOL_Y);
  const rings = [0, 1].map(() => water(g, ringShape(), froth(), LIP.y + 0.002));
  partsOf(g).orb = orb;
  partsOf(g).spill = { sheet, foam, rings };
}
