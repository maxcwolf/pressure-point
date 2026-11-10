// The ground outdoors as the scene draws it Full: soft mottling over a few meters, faint mowing stripes on a park's
// lawn and mown lanes between an orchard's rows, wind ripples on the sand, drifts and a sparkle on the snow, and grime
// in a plaza's joints. It is one repeating pattern for each setting, laid on the ground past the lot (the shared `LAWN`
// material, whose color the light still sets with the season) and painted, the same pattern at the same place, over
// the lot's own open ground on the floor (`paintGround`), so the two meet without a seam. The pattern only shades the
// ground's color, lighter and darker about it, so the season still recolors it and nothing is built again. Drawn
// Plain, the lawn goes back to its plain color (`plainLawn`) and the floor to its tiles.

import * as THREE from 'three';

import { must } from '../core/util';
import { hash } from './shared';

/** Which pattern a setting's ground wears: the park's lawn, the orchard's, sand, snow or paving. */
export type GroundLook = 'park' | 'orchard' | 'seaside' | 'mountain' | 'downtown';

/** How many tiles the pattern holds each way before it repeats, and how many pixels it gives a tile. */
const TILES = 48;
const PX = 24;
/** How many pixels a tile the soft fields are worked out at, before they are drawn up to full size. */
const LOW = 4;
/** How many tiles of a plaza's paving repeat each way: the slabs, two tiles long, rows set half a slab along. */
const SLAB_TILES = 2;

/** A setting's pattern: the shading painted over its ground, and for paving the slabs with it, as the lawn's map. */
interface Pattern {
  /** The shading alone, lighter and darker about a mid level, laid over the floor's own tiles. */
  shade: HTMLCanvasElement;
  /** What the ground past the lot wears: the shading, and for paving the slabs under it. */
  map: THREE.CanvasTexture;
  /**
   * How much each channel is raised after the shading, so that on average it leaves the ground the color it was: as
   * painted on the floor (a share, 0 to 1, for a color-dodge) and in the light the lawn is drawn in (a gain).
   */
  dodge: string;
  gain: THREE.Vector3;
}

const patterns = new Map<GroundLook, Pattern>();

/** A random value at a point of a lattice `n` wide, wrapped so the pattern repeats without a seam. */
const lattice = (i: number, j: number, n: number, m: number, seed: number) =>
  hash((((i % n) + n) % n) + seed * 131, (((j % m) + m) % m) + seed * 71);

/** Smooth value noise at a point of a lattice `n` across by `m` down, wrapping. */
function noise(u: number, v: number, n: number, m: number, seed: number): number {
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const a = lattice(i, j, n, m, seed);
  const b = lattice(i + 1, j, n, m, seed);
  const c = lattice(i, j + 1, n, m, seed);
  const d = lattice(i + 1, j + 1, n, m, seed);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/**
 * Soft noise over the pattern, from 0 to 1 about a half, at a point given in tiles: `cells` blobs across the pattern
 * (and `tall` down it, for streaks), with finer octaves over them.
 */
function fbm(x: number, z: number, cells: number, seed: number, octaves = 3, tall = cells): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const m = tall << o;
    sum += amp * noise((x / TILES) * n, (z / TILES) * m, n, m, seed + o * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/** A number pushed away from a half by `k`, kept between 0 and 1. */
const contrast = (v: number, k: number) => Math.min(1, Math.max(0, 0.5 + (v - 0.5) * k));

/**
 * How thick something grows at a point, from 0 to 1 about a half, in soft clumps a few meters across: a different
 * spread of clumps for each `seed`.
 */
export const patchiness = (x: number, z: number, seed: number) => contrast(fbm(x, z, 8, 40 + seed * 9, 2), 2);

/** A multiplier for each channel, as worked out for a point of the pattern. */
type Shade = (x: number, z: number) => [number, number, number];

/** How each setting's ground is shaded over a few meters, soft and slow, before the fine detail. */
const SOFT: Record<GroundLook, Shade> = {
  park: grassShade,
  orchard: grassShade,
  /** Sand, a touch damper and darker in patches. */
  seaside: (x, z) => {
    const m = contrast(fbm(x, z, 5, 3), 2.2);
    const damp = contrast(fbm(x, z, 3, 8, 2), 2.5);
    const b = 0.9 + 0.06 * m;
    // patches a touch damper and darker, a touch grayer
    return [b - 0.025 * damp, b - 0.022 * damp, b - 0.012 * damp];
  },
  /** Snow in drifts. */
  mountain: (x, z) => {
    // drifts, long across the wind: soft crests, and bluish in the hollows between
    const d = contrast(fbm(x, z, 3, 21, 3, 8), 2.8);
    const b = 0.87 + 0.1 * d;
    return [b - 0.06 * (1 - d), b - 0.03 * (1 - d), b];
  },
  /** Paving, stained a little darker in places. */
  downtown: (x, z) => {
    const s = contrast(fbm(x, z, 6, 5), 2);
    const b = 0.95 - 0.045 * (1 - s);
    return [b, b, b * 0.995];
  },
};

/** A lawn's mottling: brighter and darker patches over a few meters, some a touch drier and yellower, some lusher. */
function grassShade(x: number, z: number): [number, number, number] {
  const m = contrast(fbm(x, z, 6, 1), 2.2);
  const dry = contrast(fbm(x, z, 4, 4, 2), 2.6);
  const b = 0.86 + 0.08 * m;
  const lush = 1 - dry;
  return [b + 0.03 * dry - 0.02 * lush, b + 0.01 * dry, b - 0.05 * dry + 0.012 * lush];
}

/** Paint the soft fields of a pattern, worked out at a few pixels a tile, then drawn up to full size and smoothed. */
function paintSoft(ctx: CanvasRenderingContext2D, look: GroundLook) {
  const n = TILES * LOW;
  const low = Object.assign(document.createElement('canvas'), { width: n, height: n });
  // kept in memory, like the canvas it is drawn onto: one kept on the graphics card would have to be read back from it
  const lctx = must(low.getContext('2d', { willReadFrequently: true }), '2D canvas');
  const img = lctx.createImageData(n, n);
  const shade = SOFT[look];
  for (let py = 0; py < n; py++)
    for (let px = 0; px < n; px++) {
      const [r, g, b] = shade((px + 0.5) / LOW, (py + 0.5) / LOW);
      img.data.set([r * 255, g * 255, b * 255, 255], (py * n + px) * 4);
    }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, 0, 0, TILES * PX, TILES * PX);
}

/** Multiply a band of the pattern by a color: a mown stripe or lane, a joint's grime. */
function band(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** Scatter small specks over every tile, darker and lighter, each tile its own: blades, grains, glints. */
function specks(ctx: CanvasRenderingContext2D, seed: number, per: number, color: string, w: number, h: number) {
  ctx.fillStyle = color;
  for (let ty = 0; ty < TILES; ty++)
    for (let tx = 0; tx < TILES; tx++)
      for (let i = 0; i < per; i++) {
        const x = tx * PX + hash(tx * 7 + i, ty + seed * 13) * (PX - w);
        const y = ty * PX + hash(tx + seed * 5, ty * 11 + i) * (PX - h);
        ctx.fillRect(Math.round(x), Math.round(y), w, h);
      }
}

/**
 * How much a park's mowing stripes darken the lawn, and an orchard's longer grass along its rows at their middle, as
 * the color they multiply it by: faint, so they read up close and do not band the lawn from far back.
 */
const STRIPE = 'rgb(248,250,246)';
const LANE = 'rgb(247,249,245)';

/**
 * The blades of grass on every tile: so many darker strokes, a few darker still and a few lighter, each with its
 * strength. Few and faint, as on the lot's open ground they are seen close up beside the plain floors.
 */
const BLADES = [
  { seed: 1, per: 7, color: 'rgba(150,175,140,0.24)', over: 'multiply' },
  { seed: 2, per: 2, color: 'rgba(120,150,115,0.2)', over: 'multiply' },
  { seed: 3, per: 4, color: 'rgba(255,255,230,0.22)', over: 'source-over' },
] as const;

/** The fine detail of a lawn: mowing stripes two tiles wide on a park, mown lanes between an orchard's rows, blades. */
function paintGrass(ctx: CanvasRenderingContext2D, look: 'park' | 'orchard') {
  const W = TILES * PX;
  if (look === 'park') {
    // stripes across the lawn, as a mower leaves them, the darker every other pair of tiles
    for (let k = 0; k < TILES / 2; k += 2) band(ctx, STRIPE, 0, k * 2 * PX, W, 2 * PX);
  } else {
    // the grass along each row of trees left longer and darker, the lane between mown: rows every three tiles
    for (let z = 0; z < TILES; z += 3) {
      const g = ctx.createLinearGradient(0, (z - 0.8) * PX, 0, (z + 0.8) * PX);
      g.addColorStop(0, 'rgb(255,255,255)');
      g.addColorStop(0.5, LANE);
      g.addColorStop(1, 'rgb(255,255,255)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = g;
      ctx.fillRect(0, (z - 0.8) * PX, W, 1.6 * PX);
      // and the top row's band carried round the bottom edge, so the pattern repeats without a seam
      if (z === 0) ctx.fillRect(0, (TILES - 0.8) * PX, W, 1.6 * PX);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // blades: short soft strokes, darker and a few lighter, leaning every way
  for (const b of BLADES) {
    ctx.globalCompositeOperation = b.over;
    blades(ctx, b.seed, b.per, b.color);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Short soft strokes over every tile, each tile its own: blades of grass, leaning every way. */
function blades(ctx: CanvasRenderingContext2D, seed: number, per: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let ty = 0; ty < TILES; ty++)
    for (let tx = 0; tx < TILES; tx++)
      for (let i = 0; i < per; i++) {
        const x = tx * PX + hash(tx * 7 + i, ty + seed * 13) * PX;
        const y = ty * PX + hash(tx + seed * 5, ty * 11 + i) * PX;
        const a = hash(tx + i * 3, ty + seed) * Math.PI;
        const len = 1.5 + 2 * hash(tx * 3 + seed, ty + i * 5);
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y - Math.abs(Math.sin(a)) * len);
      }
  ctx.stroke();
}

/** The fine detail of sand: wind ripples in drifting patches, and dark grains and pale bits of shell. */
function paintSand(ctx: CanvasRenderingContext2D) {
  const W = TILES * PX;
  const img = ctx.getImageData(0, 0, W, W);
  // the patches of ripples, low elsewhere: soft, so worked out a few points a tile and drawn between
  const n = TILES * LOW;
  const patches = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) patches[j * n + i] = contrast(fbm(i / LOW, j / LOW, 4, 11, 2), 3);
  /** How strong the ripples are at a point, in tiles, between the points worked out. */
  const patchAt = (x: number, z: number) => {
    const u = x * LOW;
    const v = z * LOW;
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    /** The worked-out strength at a point of the grid, wrapping. */
    const at = (a: number, b: number) => patches[(b % n) * n + (a % n)] ?? 0;
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
    return top + (bottom - top) * fv;
  };
  for (let py = 0; py < W; py++)
    for (let px = 0; px < W; px++) {
      const x = px / PX;
      const z = py / PX;
      const patch = patchAt(x, z);
      if (patch <= 0) continue;
      // crests running mostly up and down the map, bending a little: every 0.4 tiles, wrapping with the pattern
      const wave = (x + 0.35 * Math.sin((2 * Math.PI * 7 * z) / TILES + (2 * Math.PI * x) / TILES)) / 0.4;
      const r = Math.sin(2 * Math.PI * wave);
      // a sharp shadow on the lee of each crest, and a soft light on its face
      const k = 1 - 0.09 * patch * Math.max(0, r) ** 6 + 0.02 * patch * Math.max(0, -r);
      const at = (py * W + px) * 4;
      img.data[at] = Math.min(255, (img.data[at] ?? 0) * k);
      img.data[at + 1] = Math.min(255, (img.data[at + 1] ?? 0) * k);
      img.data[at + 2] = Math.min(255, (img.data[at + 2] ?? 0) * k);
    }
  ctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  specks(ctx, 4, 10, 'rgb(196,186,170)', 1, 1);
  ctx.globalCompositeOperation = 'source-over';
  specks(ctx, 5, 6, 'rgba(255,252,246,0.7)', 1, 1);
}

/** The fine detail of snow: a sparkle of single bright points, and a few faint hollows. */
function paintSnow(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = 'multiply';
  specks(ctx, 6, 4, 'rgb(232,238,248)', 2, 1);
  ctx.globalCompositeOperation = 'source-over';
  specks(ctx, 7, 5, 'rgb(255,255,255)', 1, 1);
}

/** The fine detail of paving: grime along the joints between the slabs, and a few dark spots. */
function paintGrime(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < TILES; y++)
    for (let x = 0; x < TILES; x++) {
      band(ctx, 'rgb(240,239,236)', x * PX, y * PX, PX, 1);
      if ((x + y) % SLAB_TILES === 0) band(ctx, 'rgb(240,239,236)', x * PX, y * PX, 1, PX);
    }
  ctx.globalCompositeOperation = 'multiply';
  specks(ctx, 8, 1, 'rgb(214,212,208)', 2, 2);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * A plaza's slabs as the floor paints them on the lot: two tiles long, rows set half a slab along, each a near white of
 * its own the ground's color tints, with darker joints.
 */
function paintSlabs(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < TILES; y++)
    for (let x = 0; x < TILES; x++) {
      const starts = (x + y) % SLAB_TILES === 0;
      const v = 246 + Math.round(hash(starts ? x : x - 1, y + 50) * 9);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x * PX, y * PX, PX, PX);
      // the joints a pixel wide here are wider than the floor's, so drawn fainter to look as dark
      ctx.fillStyle = 'rgba(176,174,168,0.6)';
      ctx.fillRect(x * PX, y * PX, PX, 1);
      if (starts) ctx.fillRect(x * PX, y * PX, 1, PX);
    }
}

/** The shading of a setting's ground, painted once. */
function paintShade(look: GroundLook): HTMLCanvasElement {
  const W = TILES * PX;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: W });
  const ctx = must(c.getContext('2d', { willReadFrequently: true }), '2D canvas');
  paintSoft(ctx, look);
  if (look === 'park' || look === 'orchard') paintGrass(ctx, look);
  else if (look === 'seaside') paintSand(ctx);
  else if (look === 'mountain') paintSnow(ctx);
  else paintGrime(ctx);
  return c;
}

/** The average of each channel of a canvas, from 0 to 1. */
function mean(c: HTMLCanvasElement): [number, number, number] {
  const d = must(c.getContext('2d', { willReadFrequently: true }), '2D canvas').getImageData(
    0,
    0,
    c.width,
    c.height,
  ).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i] ?? 0;
    g += d[i + 1] ?? 0;
    b += d[i + 2] ?? 0;
  }
  const n = (d.length / 4) * 255;
  return [r / n, g / n, b / n];
}

/** A setting's pattern, painted the first time it is asked for. */
function patternOf(look: GroundLook): Pattern {
  const known = patterns.get(look);
  if (known) return known;
  const shade = paintShade(look);
  const avg = mean(shade);
  let mapCanvas = shade;
  if (look === 'downtown') {
    // the ground past the lot wears the slabs too, shaded the same way as the floor's
    mapCanvas = Object.assign(document.createElement('canvas'), { width: shade.width, height: shade.height });
    const ctx = must(mapCanvas.getContext('2d'), '2D canvas');
    paintSlabs(ctx);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(shade, 0, 0);
  }
  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.repeat.set(400 / TILES, 400 / TILES);
  // raised by 1/avg: on the floor, a color-dodge by 1 - avg; in the light, the gain in linear terms
  const dodge = avg.map((a) => Math.round(255 * Math.max(0, 1 - a)));
  const pattern: Pattern = {
    shade,
    map,
    dodge: `rgb(${dodge.join(',')})`,
    gain: new THREE.Vector3(...avg.map((a) => (1 / a) ** 2.2)),
  };
  patterns.set(look, pattern);
  return pattern;
}

/** How far the lawn's color is raised after its pattern, shared by the lawn's shader and set for each setting. */
const GAIN = { value: new THREE.Vector3(1, 1, 1) };

/** Whether the lawn wears its pattern now, which its shader raises its color for; drawn Plain, it does not. */
let dressed = false;

/** The materials already patched to raise their color by the ground's gain. */
const patched = new WeakSet<THREE.Material>();

/**
 * Patch a lawn's material, once, to raise its color by the ground's gain while it wears its pattern. While it does
 * not, it builds the very program it did before it was patched.
 */
function patchGain(lawn: THREE.MeshStandardMaterial) {
  if (patched.has(lawn)) return;
  patched.add(lawn);
  const plain = lawn.customProgramCacheKey();
  /** Raise the lawn's color by the ground's gain, once its pattern has shaded it. */
  lawn.onBeforeCompile = (shader) => {
    if (!dressed) return;
    shader.uniforms.groundGain = GAIN;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 groundGain;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= groundGain;');
  };
  /** The lawn's program while it wears its pattern, told apart from a plain material's. */
  lawn.customProgramCacheKey = () => (dressed ? 'ground-gain' : plain);
}

/** Put a map on the lawn, raised by the ground's gain or not, building its program again only if either changes. */
function wear(lawn: THREE.MeshStandardMaterial, map: THREE.Texture | null, gain: boolean) {
  if (lawn.map === map && dressed === gain) return;
  lawn.map = map;
  dressed = gain;
  lawn.needsUpdate = true;
}

/** Whether there is a page to paint the pattern on: not in the unit tests, which build the scenery with none. */
const onPage = () => typeof window !== 'undefined';

/**
 * Lay a setting's pattern on the ground past the lot, lined up with the lot's tiles for a ground whose west edge is
 * at `left` and south edge at `bottom`. The lawn's own color is left alone, for the light to set with the season.
 */
export function dressLawn(lawn: THREE.MeshStandardMaterial, look: GroundLook, left: number, bottom: number) {
  if (!onPage()) return;
  const p = patternOf(look);
  // the pattern's top row is drawn at the ground's north edge, so it is offset to start on a whole tile
  p.map.offset.set(left / TILES, -bottom / TILES);
  GAIN.value.copy(p.gain);
  patchGain(lawn);
  wear(lawn, p.map, true);
}

/** Take the pattern off the ground past the lot, as the scene drawn Plain has it: plain, or wearing `map`. */
export function plainLawn(lawn: THREE.MeshStandardMaterial, map: THREE.Texture | null) {
  wear(lawn, map, false);
}

/** The fill each floor's tile of open ground is shaded with, by the canvas it is painted on and the look. */
const fills = new WeakMap<CanvasRenderingContext2D, { look: GroundLook; fill: CanvasPattern }>();

/**
 * Shade the lot's open ground, painted on the floor, with the same pattern the ground past the lot wears there, so the
 * two meet without a seam: the pattern multiplied over it, then raised by the same share the lawn's shader raises it
 * by. `tiles` are the corners, in pixels, of the tiles of open ground, each `ts` pixels a side. All are shaded in two
 * fills, not two a tile: each such fill has the canvas read what is under it first, which software drawing is slow at.
 */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  look: GroundLook,
  tiles: readonly (readonly [number, number])[],
  ts: number,
) {
  if (tiles.length === 0) return;
  const p = patternOf(look);
  let f = fills.get(ctx);
  if (f?.look !== look) {
    const fill = must(ctx.createPattern(p.shade, 'repeat'), 'ground pattern');
    // one tile of the floor is `ts` pixels, of the pattern `PX`, both from the map's corner
    fill.setTransform(new DOMMatrix().scaleSelf(ts / PX, ts / PX));
    f = { look, fill };
    fills.set(ctx, f);
  }
  const open = new Path2D();
  for (const [px, py] of tiles) open.rect(px, py, ts, ts);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = f.fill;
  ctx.fill(open);
  ctx.globalCompositeOperation = 'color-dodge';
  ctx.fillStyle = p.dodge;
  ctx.fill(open);
  ctx.restore();
}
