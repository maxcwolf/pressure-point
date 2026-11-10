// Grounding: the soft shade where things meet the floor, which a scene with no light bouncing between surfaces lacks,
// so walls, furniture and the building look set down on the floor rather than pasted on it. It costs no draw calls:
// the shade on the floor is painted into the floor's own texture, under the walls, the building's shell and each
// item, and the foot of each wall is darkened as it is drawn, by height. Both multiply toward a warm brown, not
// black, so the cream floors and the walls warm a little where they meet rather than going gray.

import * as THREE from 'three';

import { H, ITEMS } from '../core/data';
import { inFootprint } from '../core/footprint';
import type { Sim } from '../core/sim/sim';
import { must } from '../core/util';
import { itemDims, onWall } from '../core/world';
import { fx } from './fx';
import { shellStretches } from './outer-walls';
import { OUTER_T, WALL_T } from './shared';
import { nearSides } from './turn';

/** How many cells a tile the shade is worked out in: fine enough for a wall's foot, coarse enough to blur at once. */
const CELLS = 8;
/** How far the shade spreads from what casts it, in cells, as the half width of each of the two blurs. */
const SPREAD = 2;
/** How strongly a wall, the shell and an item shade the floor, before the blur: walls fully, an item's pool softer. */
const WALL_SHADE = 1;
const ITEM_SHADE = 0.55;
/** How far in from each edge of its tiles an item's pool starts, in tiles, so it sits under the item, not around it. */
const ITEM_INSET = 0.18;
/**
 * How much the blurred shade is turned up before it is capped, so the floor right at a wall's foot is near full shade
 * and a corner, shaded by two walls, darker still before the cap.
 */
const GAIN = 3;
/** The warm brown the floor is multiplied toward, and how far at the most: right at a wall's foot. */
const SHADE_RGB = [104, 78, 54] as const;
const SHADE_MOST = 0.46;

/** The shade's cells, its picture, and the canvas it is drawn on, kept between paintings while the lot keeps its size. */
let grid: {
  w: number;
  h: number;
  v: Float32Array;
  tmp: Float32Array;
  canvas: HTMLCanvasElement;
  img: ImageData;
} | null = null;

/** The cells, picture and canvas for a lot this many tiles wide, made afresh only when the lot grows. */
function gridFor(tilesW: number) {
  const w = tilesW * CELLS;
  const h = H * CELLS;
  if (grid?.w === w && grid.h === h) {
    grid.v.fill(0);
    return grid;
  }
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = must(canvas.getContext('2d'), '2D canvas');
  grid = { w, h, v: new Float32Array(w * h), tmp: new Float32Array(w * h), canvas, img: ctx.createImageData(w, h) };
  return grid;
}

/**
 * Shade a rectangle of the floor, given in tiles, as strongly as `k`: each cell it covers by as much of the cell as it
 * covers, keeping whatever shade the cell already has if that is more.
 */
function cover(
  g: { w: number; h: number; v: Float32Array },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  k: number,
) {
  const [cx0, cy0, cx1, cy1] = [x0 * CELLS, y0 * CELLS, x1 * CELLS, y1 * CELLS];
  for (let cy = Math.max(0, Math.floor(cy0)); cy < Math.min(g.h, Math.ceil(cy1)); cy++) {
    const fy = Math.min(cy + 1, cy1) - Math.max(cy, cy0);
    for (let cx = Math.max(0, Math.floor(cx0)); cx < Math.min(g.w, Math.ceil(cx1)); cx++) {
      const f = fy * (Math.min(cx + 1, cx1) - Math.max(cx, cx0)) * k;
      const i = cy * g.w + cx;
      if (f > (g.v[i] ?? 0)) g.v[i] = f;
    }
  }
}

/** Blur the cells with a box `SPREAD` cells either way, along the rows and then down the columns, from `v` into `v`. */
function boxBlur(g: { w: number; h: number; v: Float32Array; tmp: Float32Array }) {
  const { w, h, v, tmp } = g;
  const r = SPREAD;
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += v[row + Math.min(w - 1, Math.max(0, x))] ?? 0;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / n;
      sum += (v[row + Math.min(w - 1, x + r + 1)] ?? 0) - (v[row + Math.max(0, x - r)] ?? 0);
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x] ?? 0;
    for (let y = 0; y < h; y++) {
      v[y * w + x] = sum / n;
      sum += (tmp[Math.min(h - 1, y + r + 1) * w + x] ?? 0) - (tmp[Math.max(0, y - r) * w + x] ?? 0);
    }
  }
}

/**
 * Paint the soft shade where things stand on the floor into the floor's texture, `ts` pixels a tile: along the foot of
 * every finished room's walls, on both faces, and of the building's shell, inside and out, and a softer pool under each
 * item standing on the floor. It is worked out at a few cells a tile, blurred twice, and laid over the floor in one go,
 * scaled up smoothly. Painted before the door thresholds, the welcome mat and the rooms pencilled in, so they stay
 * clear of it.
 */
export function paintGroundShade(ctx: CanvasRenderingContext2D, sim: Sim, ts: number) {
  const world = sim.world;
  const fp = world.building;
  const g = gridFor(world.w);
  // the building's shell, from the middle of the wall out to both faces
  for (const s of shellStretches(fp, nearSides(0))) {
    const [p, q] = [s.at - OUTER_T / 2, s.at + OUTER_T / 2];
    if (s.horizontal) cover(g, s.a, p, s.b, q, WALL_SHADE);
    else cover(g, p, s.a, q, s.b, WALL_SHADE);
  }
  // each finished room's own walls, just inside its edge, but not across its doorway, nor where the shell stands in
  for (const r of sim.s.rooms) {
    if (!r.done) continue;
    const d = r.door;
    const edges = [
      { horizontal: true, line: r.y, inward: 1 },
      { horizontal: true, line: r.y + r.h, inward: -1 },
      { horizontal: false, line: r.x, inward: 1 },
      { horizontal: false, line: r.x + r.w, inward: -1 },
    ];
    for (const e of edges) {
      const [from, to] = e.horizontal ? [r.x, r.x + r.w] : [r.y, r.y + r.h];
      const [p, q] = e.inward > 0 ? [e.line, e.line + WALL_T] : [e.line - WALL_T, e.line];
      for (let t = from; t < to; t++) {
        const door = e.horizontal ? d.dy === -e.inward && d.x === t : d.dx === -e.inward && d.y === t;
        const beyond = e.line + (e.inward > 0 ? -1 : 0);
        const outside = e.horizontal ? !inFootprint(fp, t, beyond) : !inFootprint(fp, beyond, t);
        if (door || outside) continue;
        if (e.horizontal) cover(g, t, p, t + 1, q, WALL_SHADE);
        else cover(g, p, t, q, t + 1, WALL_SHADE);
      }
    }
  }
  // a pool under each item standing on the floor, in or out of doors
  for (const it of sim.s.items) {
    if (!Object.hasOwn(ITEMS, it.type) || onWall(it.type)) continue;
    const [w, h] = itemDims(it.type, it.rot);
    cover(g, it.x + ITEM_INSET, it.y + ITEM_INSET, it.x + w - ITEM_INSET, it.y + h - ITEM_INSET, ITEM_SHADE);
  }
  boxBlur(g);
  boxBlur(g);
  const { data } = g.img;
  for (let i = 0; i < g.v.length; i++) {
    const o = i * 4;
    data[o] = SHADE_RGB[0];
    data[o + 1] = SHADE_RGB[1];
    data[o + 2] = SHADE_RGB[2];
    data[o + 3] = Math.round(Math.min(1, (g.v[i] ?? 0) * GAIN) * SHADE_MOST * 255);
  }
  must(g.canvas.getContext('2d'), '2D canvas').putImageData(g.img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(g.canvas, 0, 0, world.w * ts, H * ts);
  ctx.restore();
}

/** How high up a wall its foot is darkened, in tiles, and the warm brown it is darkened toward right at the floor. */
const FOOT_H = 0.34;
const FOOT_SHADE = new THREE.Color(0.66, 0.6, 0.53);

/**
 * Darken what a material draws toward the warm brown by its height over the floor, fully at the floor and fading out
 * by `FOOT_H`, after the light is worked out, so a wall's foot is in shade in the sun too.
 */
function darkenFoot(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.footShade = { value: FOOT_SHADE };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFootY;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 footAt = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        footAt = instanceMatrix * footAt;
      #endif
      vFootY = ( modelMatrix * footAt ).y;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFootY;\nuniform vec3 footShade;')
    .replace(
      '#include <opaque_fragment>',
      `float footUp = clamp( vFootY / ${FOOT_H.toFixed(3)}, 0.0, 1.0 );
      outgoingLight *= mix( footShade, vec3( 1.0 ), 1.0 - ( 1.0 - footUp ) * ( 1.0 - footUp ) );
      #include <opaque_fragment>`,
    );
}

/** Each material and the copy of it whose foot is darkened, made the first time it is wanted and shared after. */
const groundedOf = new WeakMap<THREE.Material, THREE.Material>();

/**
 * The copy of a material whose foot is darkened, shared by every wall drawn in it, or the material itself if it is not
 * one to darken: see-through, glowing, or not a standard material.
 */
export function grounded(m: THREE.Material): THREE.Material {
  if (!(m instanceof THREE.MeshStandardMaterial) || m.transparent) return m;
  if (m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) return m;
  let g = groundedOf.get(m);
  if (!g) {
    g = m.clone();
    g.onBeforeCompile = darkenFoot;
    /** Every copy shares one program for each kind of material, apart from the uncut one's. */
    g.customProgramCacheKey = () => 'grounded';
    groundedOf.set(m, g);
    groundedOf.set(g, g);
  }
  return g;
}

/** Darken the foot of every wall in a group, when grounding is switched on: each opaque part takes its material's copy. */
export function groundWalls(root: THREE.Object3D) {
  if (!fx('grounding')) return;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !Array.isArray(o.material)) o.material = grounded(o.material as THREE.Material);
  });
}

/** How wide the soft shade under a tree is, across, in tiles, how dark at its middle, and the warm brown it is. */
const TREE_SHADE_W = 1.3;
const TREE_SHADE_MOST = 0.32;
const TREE_SHADE = 0x4a3524;

/** A soft round shade, dark in the middle and fading to nothing at the edge, made the first time it is wanted. */
let treeShade: THREE.MeshBasicMaterial | null = null;

/** The material of the soft shade under a tree: a round fade in a warm brown, laid over the ground. */
function treeShadeMaterial(): THREE.MeshBasicMaterial {
  if (treeShade) return treeShade;
  const N = 32;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
      const f = Math.max(0, 1 - r);
      // an alpha map reads its green: the fade is written into every channel
      data.fill(Math.round(f * f * (3 - 2 * f) * 255), (y * N + x) * 4, (y * N + x) * 4 + 4);
    }
  const tex = new THREE.DataTexture(data, N, N);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  treeShade = new THREE.MeshBasicMaterial({
    color: TREE_SHADE,
    alphaMap: tex,
    transparent: true,
    opacity: TREE_SHADE_MOST,
    depthWrite: false,
  });
  return treeShade;
}

/**
 * Lay a soft shade on the ground at the foot of every tree in the scenery, when grounding is switched on: all of them
 * in one draw, found as the instanced trunks among it (the rough brown cylinders of every kind of tree), so it follows
 * whatever trees the setting grows. Its shape is the scenery's own, freed with it.
 */
export function groundTrees(scenery: THREE.Object3D) {
  if (!fx('grounding')) return;
  scenery.updateMatrixWorld(true);
  const spots: THREE.Vector3[] = [];
  const m = new THREE.Matrix4();
  scenery.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh) || !(o.geometry instanceof THREE.CylinderGeometry)) return;
    const bark: unknown = o.material;
    if (!(bark instanceof THREE.MeshStandardMaterial) || bark.roughness < 0.85) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      spots.push(new THREE.Vector3().setFromMatrixPosition(m.premultiply(o.matrixWorld)));
    }
  });
  if (!spots.length) return;
  const shade = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(TREE_SHADE_W, TREE_SHADE_W).rotateX(-Math.PI / 2),
    treeShadeMaterial(),
    spots.length,
  );
  // just over the floor, which runs under the trees nearest the building, and the lawn beyond it
  spots.forEach((p, i) => {
    shade.setMatrixAt(i, m.makeTranslation(p.x, 0.004, p.z));
  });
  shade.computeBoundingSphere();
  /** The shade is not there to be clicked: a click goes through to the ground under it. */
  shade.raycast = () => undefined;
  scenery.add(shade);
}
