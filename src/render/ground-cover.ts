// What grows and lies on the ground outdoors with the richer ground (`lawn`): tufts of grass and small flowers on a lawn,
// pebbles and shells on the sand, and weeds in a plaza's joints with leaves blown onto it in autumn; the snow has its
// drifts and sparkle in its pattern alone (`ground.ts`). Each setting's is at most two instanced meshes, kept clear of
// the building, the plots, the paths and the road as the trees are. The grass and pebbles take the ground's own color
// (the `LAWN` material's, which the light sets with the season), shaded a little by each copy, so they turn with it
// and nothing is built again; the flowers, weeds and leaves follow the season through `coverFor`.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { H, ROAD_Y, SIDEWALK_Y } from '../core/data';
import type { Season } from '../core/format';
import { must } from '../core/util';
import { type GroundLook, patchiness } from './ground';
import { cached } from './models/parts';
import { LAWN } from './setting';
import { hash } from './shared';
import { sway } from './wind';

/** Whether a tile is kept clear of anything growing: the building, the plots, the paths and the road. */
export type Clear = (x: number, y: number) => boolean;

/** How far past the lot the ground cover reaches each way, in tiles, thinning out over the last few. */
const REACH_X = 26;
const REACH_Z = 20;
const FADE = 7;

/** The ground's own color, shared with what lies on it so the season turns both: the lawn's color object itself. */
const groundColored = (m: THREE.MeshStandardMaterial) => {
  m.color = LAWN.color;
  return m;
};

/** Tufts of grass, in the lawn's color, darker or yellower tuft by tuft, swaying a little at the tips. */
const GRASS = sway(groundColored(new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide })), 0.6);
/** Pebbles on the sand, in the ground's color, shaded stone by stone. */
const STONES = groundColored(new THREE.MeshStandardMaterial({ roughness: 0.95 }));
/** Small flowers on a lawn, in spring and summer, each in its own pale color. */
const FLOWERS = sway(
  new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, vertexColors: true }),
  0.6,
);
/** Shells on the sand, each in its own pale color. */
const SHELLS = new THREE.MeshStandardMaterial({ roughness: 0.55 });
/** Weeds in a plaza's joints, in the season's green, or gone straw-colored. */
const WEEDS = sway(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), 0.6);
/** Leaves blown onto a plaza in autumn, each its own brown. */
const FALLEN = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, visible: false });

/** The weeds' color in each season. */
const WEED_SEASONS: Readonly<Record<Season, number>> = {
  spring: 0x7cb25a,
  summer: 0x689d4b,
  autumn: 0x9a9a55,
  winter: 0x8e8f70,
};

/** Turn the ground cover to a season: flowers out in spring and summer, the weeds' color, leaves fallen in autumn. */
export function coverFor(season: Season) {
  FLOWERS.visible = season === 'spring' || season === 'summer';
  WEEDS.color.setHex(WEED_SEASONS[season]);
  FALLEN.visible = season === 'autumn';
}

/** Shapes to merge into one, with every normal turned straight up, so they take the light as the ground does. */
function flatLit(parts: THREE.BufferGeometry[], key: string): THREE.BufferGeometry {
  const plain = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    g.deleteAttribute('uv');
    return g;
  });
  const g = must(mergeGeometries(plain), key);
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/** A triangle from three corners, as a shape of its own. */
function tri(a: readonly number[], b: readonly number[], c: readonly number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  return g;
}

/** A tuft of grass: five blades, each a thin spike leaning out from the middle, 12 to 22 cm tall. */
const tuftShape = () =>
  cached('cover-tuft', () => {
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const tall = 0.12 + ((i * 3) % 5) * 0.025;
      const lean = 0.04 + (i % 3) * 0.02;
      const [cx, cz] = [Math.cos(a) * 0.02, Math.sin(a) * 0.02];
      // across the blade, square to the way it leans
      const [wx, wz] = [-Math.sin(a) * 0.018, Math.cos(a) * 0.018];
      blades.push(
        tri([cx - wx, 0, cz - wz], [cx + wx, 0, cz + wz], [cx + Math.cos(a) * lean, tall, cz + Math.sin(a) * lean]),
      );
    }
    return flatLit(blades, 'a tuft of grass');
  });

/** The shade a flower's stalk takes of its head's color: a dull green whatever the head. */
const STALK = [0.42, 0.62, 0.34] as const;

/** A shape with every corner in one shade, for a material whose copies each have a color the shade multiplies. */
function tinted(g: THREE.BufferGeometry, shade: number | readonly [number, number, number]): THREE.BufferGeometry {
  const [r, gr, b] = typeof shade === 'number' ? [shade, shade, shade] : shade;
  const n = g.getAttribute('position').count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [r, gr, b]).flat(), 3));
  return g;
}

/** A few small flowers on short stalks: three round heads of five petals, at heights of their own. */
const flowerShape = () =>
  cached('cover-flower', () => {
    const heads: THREE.BufferGeometry[] = [];
    for (const [x, y, z] of [
      [0, 0.13, 0],
      [0.07, 0.1, 0.04],
      [-0.05, 0.11, 0.06],
    ] as const) {
      const head = new THREE.CircleGeometry(0.042, 5).rotateX(-Math.PI / 2).translate(x, y, z);
      // a stalk down to the ground, thin and green, so the head stands on it rather than floating like a cap
      heads.push(tinted(head, 1), tinted(tri([x - 0.007, 0, z], [x + 0.007, 0, z], [x, y, z]), STALK));
    }
    return flatLit(heads, 'a clump of flowers');
  });

/** A pebble: a low, rough stone, stretched flat by its placement. */
const pebbleShape = () =>
  cached('cover-pebble', () => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    g.deleteAttribute('uv');
    return g;
  });

/** A shell: a small fan, ribbed, domed a little in the middle. */
const shellShape = () =>
  cached('cover-shell', () => {
    const ribs: THREE.BufferGeometry[] = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * (0.1 + (0.8 * i) / n);
      const a1 = Math.PI * (0.1 + (0.8 * (i + 1)) / n);
      ribs.push(tri([0, 0.012, 0], [Math.cos(a1), 0.004, Math.sin(a1)], [Math.cos(a0), 0.004, Math.sin(a0)]));
    }
    return flatLit(ribs, 'a shell');
  });

/** A leaf lying on the ground: a narrow diamond, a vein's crease down the middle. */
const leafShape = () =>
  cached('cover-leaf', () =>
    flatLit(
      [
        tri([0, 0.004, -1], [0.45, 0, 0], [0, 0.008, 0]),
        tri([0, 0.008, 0], [-0.45, 0, 0], [0, 0.004, -1]),
        tri([0.45, 0, 0], [0, 0.004, 0.7], [0, 0.008, 0]),
        tri([0, 0.008, 0], [0, 0.004, 0.7], [-0.45, 0, 0]),
      ],
      'a fallen leaf',
    ),
  );

/** One copy of a shape: where, turned how far, how big each way, and its color. */
interface Copy {
  x: number;
  z: number;
  turn: number;
  size: readonly [number, number, number];
  /** Its color: for what takes the ground's color, a shade the ground's is multiplied by. */
  color: number;
}

/** An instanced mesh of copies of a shape, catching shadows but casting none, its copies each in their color. */
function instanced(
  shape: THREE.BufferGeometry,
  material: THREE.Material,
  copies: readonly Copy[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(shape, material, copies.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  copies.forEach((c, i) => {
    mesh.setMatrixAt(
      i,
      m.compose(new THREE.Vector3(c.x, 0, c.z), q.setFromAxisAngle(up, c.turn), new THREE.Vector3(...c.size)),
    );
    mesh.setColorAt(i, color.setHex(c.color));
  });
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  /** What lies on the ground is not there to be clicked: a click goes through to the ground. */
  mesh.raycast = () => undefined;
  return mesh;
}

/** How thick the ground cover grows at a point, from 0 at the edge of its reach to 1 well inside it. */
function thinning(x: number, z: number, width: number): number {
  const out = Math.max(
    -x - (REACH_X - FADE),
    x - width - (REACH_X - FADE),
    -z - (REACH_Z - FADE),
    z - H - (REACH_Z - FADE),
  );
  return Math.min(1, Math.max(0, 1 - out / FADE));
}

/**
 * Every tile the ground cover can grow on, from the north-west of its reach: its corner, and how thick the cover grows
 * there, thinning toward the edge of its reach.
 */
function* tiles(width: number, clear: Clear, keep: (x: number, y: number) => boolean) {
  for (let y = -REACH_Z; y < H + REACH_Z; y++)
    for (let x = -REACH_X; x < width + REACH_X; x++) {
      if (clear(x, y) || !keep(x, y)) continue;
      const thick = thinning(x + 0.5, y + 0.5, width);
      if (thick > 0) yield { x, y, thick };
    }
}

/** The shades of grass a tuft can be against the lawn: darker, darker still, and drier. */
const TUFT_SHADES = [0xc8d6c0, 0xb0c4a8, 0xd8d0a8, 0xbccab0] as const;
/** The flowers' colors, pale and none of them read as a signal: white, lilac, pale blue and pink. */
const FLOWER_COLORS = [0xcdb6ea, 0xb2cdf0, 0xf7f5ee, 0xf2bcd2, 0xc3b0ec, 0xa9c6f2] as const;
/** The pebbles' shades against the sand, and the shells' own colors: white, a blush of pink, cream. */
const PEBBLE_SHADES = [0xc8c2ba, 0xb4aea6, 0xddd4c8, 0xbcb6aa] as const;
const SHELL_COLORS = [0xfaf4ec, 0xf5dcd2, 0xeee2cc] as const;
/** The browns of leaves blown onto a plaza, dry and muted. */
const FALLEN_COLORS = [0xb98a56, 0x9c7048, 0xc8a870, 0xa97c4e] as const;

/** Pick one of a list by a random number from 0 to 1. */
const pick = <T>(list: readonly T[], r: number): T => must(list[Math.floor(r * list.length) % list.length], 'a pick');

/** A lawn's cover: tufts in clumps, thicker in some places than others, and flowers in patches of one color. */
function lawnCover(width: number, clear: Clear, keep: (x: number, y: number) => boolean): THREE.Object3D[] {
  const tufts: Copy[] = [];
  const flowers: Copy[] = [];
  for (const { x, y, thick } of tiles(width, clear, keep)) {
    const clump = patchiness(x, y, 1);
    const n = Math.floor(thick * (0.2 + clump * 2.6) + hash(x, y + 300));
    for (let i = 0; i < n; i++) {
      const r = hash(x * 3 + i, y * 5 + 1);
      const k = 1 + 0.8 * hash(x + i * 7, y);
      tufts.push({
        x: x + hash(x + i, y * 3 + 7),
        z: y + hash(x * 7 + 3, y + i),
        turn: r * 6.28,
        size: [k, k * (0.8 + 0.5 * hash(i, x + y)), k],
        color: pick(TUFT_SHADES, r),
      });
    }
    // flowers where a patch of them grows, a color to each patch
    const bloom = patchiness(x, y, 2);
    if (bloom > 0.62 && hash(x + 50, y) < thick * (bloom - 0.55) * 3) {
      const k = 0.9 + 0.4 * hash(x, y + 77);
      flowers.push({
        x: x + 0.15 + 0.7 * hash(x + 8, y),
        z: y + 0.15 + 0.7 * hash(x, y + 8),
        turn: hash(x, y + 9) * 6.28,
        size: [k, k, k],
        color: pick(FLOWER_COLORS, hash(Math.floor(x / 5), Math.floor(y / 5) + 400)),
      });
    }
  }
  return [instanced(tuftShape(), GRASS, tufts), instanced(flowerShape(), FLOWERS, flowers)];
}

/** The sand's cover: pebbles here and there, more in some stretches, and a few shells. */
function sandCover(width: number, clear: Clear): THREE.Object3D[] {
  const pebbles: Copy[] = [];
  const shells: Copy[] = [];
  // the sand runs from the beach huts down to the road, and away either side
  for (const { x, y, thick } of tiles(width, clear, (_x, y) => y >= 2)) {
    const n = Math.floor(thick * patchiness(x, y, 3) * 1.1 + hash(x, y + 310) * 0.4);
    for (let i = 0; i < n; i++) {
      const k = 0.03 + 0.035 * hash(x + i, y + 31);
      pebbles.push({
        x: x + hash(x * 5 + i, y + 2),
        z: y + hash(x, y * 5 + i),
        turn: hash(x + i, y) * 6.28,
        size: [k * 1.3, k * 0.5, k],
        color: pick(PEBBLE_SHADES, hash(x * 3, y + i)),
      });
    }
    if (hash(x + 40, y + 9) < 0.07 * thick) {
      const k = 0.06 + 0.03 * hash(x, y + 41);
      shells.push({
        x: x + hash(x + 3, y + 3),
        z: y + hash(x + 4, y + 4),
        turn: hash(x, y + 5) * 6.28,
        size: [k, k, k],
        color: pick(SHELL_COLORS, hash(x + 6, y)),
      });
    }
  }
  return [instanced(pebbleShape(), STONES, pebbles), instanced(shellShape(), SHELLS, shells)];
}

/** A plaza's cover: weeds in the joints between slabs, and in autumn leaves blown onto it. */
function pavingCover(width: number, clear: Clear): THREE.Object3D[] {
  const weeds: Copy[] = [];
  const leaves: Copy[] = [];
  // the plaza round the lot, inside the streets either side and behind, and up to the pavement
  /** Whether a tile is on the plaza. */
  const plaza = (x: number, y: number) => x >= -2 && x < width + 2 && y >= -2 && y < SIDEWALK_Y - 1;
  for (const { x, y } of tiles(width, clear, plaza)) {
    if (hash(x + 70, y) < 0.16) {
      // along the joint at the slab's top edge, or at its start
      const along = hash(x, y + 71);
      const start = (x + y) % 2 === 0 && hash(x + 72, y) < 0.4;
      const k = 0.7 + 0.4 * hash(x + 73, y);
      weeds.push({
        x: start ? x : x + along,
        z: start ? y + along : y,
        turn: hash(x, y + 74) * 6.28,
        size: [k, k * 0.7, k],
        color: 0xffffff,
      });
    }
    for (let i = 0; i < 2; i++)
      if (hash(x + 80 + i, y) < 0.22) {
        const k = 0.09 + 0.04 * hash(x + i, y + 81);
        leaves.push({
          x: x + hash(x + 82 + i, y),
          z: y + hash(x, y + 83 + i),
          turn: hash(x + i, y + 84) * 6.28,
          size: [k, k, k],
          color: pick(FALLEN_COLORS, hash(x + i, y + 85)),
        });
      }
  }
  return [instanced(tuftShape(), WEEDS, weeds), instanced(leafShape(), FALLEN, leaves)];
}

/**
 * The ground cover round a building, in its setting: kept off whatever `clear` keeps clear, and off a high street's
 * pavements and road. At most two draw calls.
 */
export function buildGroundCover(look: GroundLook, width: number, clear: Clear, street: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ground-cover';
  /** Whether a tile is clear of the road and its pavements, which nothing grows on. */
  const offRoad = (_x: number, y: number) => y < SIDEWALK_Y - (street ? 1 : 0) || y > ROAD_Y[1] + (street ? 2 : 1);
  // the snow's drifts are in its pattern alone: mounds on it, lit apart from the ground's pattern, read as blobs
  const parts =
    look === 'seaside'
      ? sandCover(width, clear)
      : look === 'mountain'
        ? []
        : look === 'downtown'
          ? pavingCover(width, clear)
          : lawnCover(width, clear, offRoad);
  for (const p of parts) if ((p as THREE.InstancedMesh).count > 0) g.add(p);
  return g;
}
