// A high street's dressing beyond the lot: pavements in the lot's own stone, and hedges on a low brick wall along the
// back of the pavement. The road and the lamp posts are downtown's (`models/downtown.ts`).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { must } from '../../core/util';
import { LAWN_FX } from '../ground';
import { sway, WIND } from '../wind';
import { mergeStill } from './merge';
import { cached, corner, mat, put } from './parts';

/** The pavement's stone: between the two shades of the lot's own pavement, so the two meet without a seam. */
const PAVEMENT = new THREE.MeshStandardMaterial({ color: 0xd4ccbc, roughness: 0.95 });
const BRICK = 0xb5806a;
const COPING = 0xd9cfc0;
const HEDGE = 0x5b8f4e;
/** The hedges' leaves when the wind blows: a material of their own that rustles a little at the top (see `sway`). */
let hedgeLeaves: THREE.Material | null = null;

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
  const leaf = WIND ? (hedgeLeaves ??= sway(mat(HEDGE, 0.9).clone(), 0.08)) : mat(HEDGE, 0.9);
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

/** How many pixels a tile of the pavement's slabs gets: the floor's own, so the two match. */
const SLAB_PX = 64;

/**
 * The lot's own pavement carried on past it with the richer ground (`lawn`): square slabs a tile each, in the floor's
 * two shades by turns, each with a faint joint round its edge, as the floor paints the pavement on the lot.
 */
function slabMap(): THREE.CanvasTexture {
  const c = Object.assign(document.createElement('canvas'), { width: SLAB_PX * 2, height: SLAB_PX * 2 });
  const ctx = must(c.getContext('2d'), '2D canvas');
  const k = SLAB_PX / 48;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#d9d2c3' : '#cfc7b6';
      ctx.fillRect(i * SLAB_PX, j * SLAB_PX, SLAB_PX, SLAB_PX);
      ctx.strokeStyle = 'rgba(90,80,60,0.2)';
      ctx.lineWidth = k;
      ctx.strokeRect(i * SLAB_PX + k / 2, j * SLAB_PX + k / 2, SLAB_PX - k, SLAB_PX - k);
    }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  // rows of the canvas run down the map as the tiles do
  map.flipY = false;
  return map;
}

if (LAWN_FX) {
  PAVEMENT.color.setHex(0xffffff);
  PAVEMENT.map = slabMap();
}

/** Lay a strip's slabs on the map's tiles, for a strip whose middle is at (x, z): two tiles to the pattern each way. */
function slabsAt(shape: THREE.BufferGeometry, x: number, z: number) {
  const pos = shape.getAttribute('position');
  const uv = shape.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + x) / 2, (pos.getZ(i) + z) / 2);
}

/** Strips of pavement flat on the ground, which take shadows but cast none. */
export function buildPavements(strips: readonly { x0: number; x1: number; z0: number; z1: number }[]): THREE.Group {
  const g = new THREE.Group();
  for (const s of strips) {
    const shape = new THREE.PlaneGeometry(s.x1 - s.x0, s.z1 - s.z0).rotateX(-Math.PI / 2);
    if (LAWN_FX) slabsAt(shape, (s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2);
    const m = put(g, shape, PAVEMENT);
    m.position.set((s.x0 + s.x1) / 2, -0.018, (s.z0 + s.z1) / 2);
    m.castShadow = false;
    m.receiveShadow = true;
  }
  mergeStill(g);
  return g;
}
