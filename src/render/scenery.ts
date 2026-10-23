// The scenery: the lawn, the sign and the trees, pines in the snow, rows of apple trees, or downtown's paving, streets,
// office blocks and street trees, and apart from it the building's outer walls. The scenery changes only when the
// building grows into more land; the walls change too as the camera turns, since the ones facing it are cut low. The windows in the outer walls change as rooms are built against
// them, so they are drawn with the rooms.

import * as THREE from 'three';

import { H, type Rect, ROAD_Y, SIDEWALK_Y, TITLE_LINES } from '../core/data';
import { entranceSpan, type Footprint, inRect } from '../core/footprint';
import { must } from '../core/util';
import { buildBeach } from './models/beach';
import { type Block, buildLamps, buildOffices, buildStreets, buildStreetTrees } from './models/downtown';
import { mergeStill } from './models/merge';
import { buildOrchard, orchardRows } from './models/orchard';
import { cyl, mat, put, rbox, sph } from './models/parts';
import { buildPines } from './models/pine';
import { buildForest, type TreeSpot } from './models/tree';
import { shellStretches } from './outer-walls';
import { LAWN, type Setting, type SETTINGS } from './setting';
import { H_LOW, hash, OUTER_HT, OUTER_T, SHELL_TRIM } from './shared';
import { SIGN_HALF, SIGN_LEG, signSpot } from './sign';
import { onStorefront } from './storefront';
import type { Sides } from './turn';

/** Build the scenery around a building, in its setting: the same until the building grows. */
export function buildScenery(
  fp: Footprint,
  setting: keyof typeof SETTINGS,
  colors: Setting,
  /** How wide the lot is. */
  width: number,
  /** The center's plots of land, kept clear for the building to grow into, and anything standing outdoors. */
  plots: readonly Rect[] = [],
): THREE.Group {
  const scene = new THREE.Group();
  // one lawn material, which the light recolors as the seasons turn
  LAWN.color.setHex(colors.ground);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), LAWN);
  lawn.position.set(width / 2, -0.03, H / 2);
  lawn.receiveShadow = true;
  scene.add(lawn);
  // paving carries the floor's slabs on past the lot; any other ground is plain
  const map = colors.kind === 'paving' ? pavingMap(width / 2 - 200, H / 2 + 200) : null;
  if (LAWN.map !== map) {
    LAWN.map = map;
    LAWN.needsUpdate = true;
  }

  scene.add(buildSign(fp));

  if (setting === 'downtown') {
    scene.add(buildDowntown(fp, width, plots));
    return scene;
  }

  if (setting === 'seaside') {
    scene.add(buildSeaside(fp, width, plots));
    return scene;
  }
  if (setting === 'orchard') {
    // apple trees in rows, wherever the lawn is clear
    const rows = orchardRows(-6, width + 6, -6, H + 6).filter(
      (p) => !keptClear(fp, plots, Math.floor(p.x), Math.floor(p.z)),
    );
    scene.add(buildOrchard(rows.map((p, i) => ({ ...p, seed: Math.floor(hash(i, 5) * 97) }))));
    return scene;
  }

  // trees wherever there is lawn, or snow
  const trees: TreeSpot[] = [];
  for (let y = -3; y < H + 2; y++) {
    for (let x = -4; x < width + 4; x++) {
      if (keptClear(fp, plots, x, y) || hash(x, y) > 0.2) continue;
      trees.push({
        x: x + 0.5 + (hash(x + 9, y) - 0.5) * 0.5,
        z: y + 0.5 + (hash(x, y + 9) - 0.5) * 0.5,
        seed: Math.floor(hash(y, x) * 97),
      });
    }
  }
  scene.add(setting === 'mountain' ? buildPines(trees) : buildForest(trees));
  return scene;
}

/** The sign on the front lawn, printed on both faces, so it reads from the north as well as from the street. */
export function buildSign(fp: Footprint): THREE.Group {
  const sign = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = must(c.getContext('2d'), '2D canvas');
  ctx.fillStyle = '#2fa8a0';
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#fff8e8';
  ctx.fillRect(10, 10, 492, 140);
  ctx.fillStyle = '#2f4858';
  ctx.font = '700 62px Fredoka, "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${TITLE_LINES[0]} ${TITLE_LINES[1]}`.toUpperCase(), 256, 66);
  ctx.fillStyle = '#2fa8a0';
  ctx.font = '600 34px Fredoka, "Arial Rounded MT Bold", sans-serif';
  ctx.fillText(TITLE_LINES[2].toUpperCase().split('').join('\u200a'), 256, 120);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  const edge = mat(0x2fa8a0);
  // a box's faces in order: its ends, top and bottom, then front and back, each face reading the right way round
  // from its own side, so the back can wear the same print as the front
  const board = new THREE.Mesh(new THREE.BoxGeometry(SIGN_HALF * 2, 1, 0.12), [edge, edge, edge, edge, face, face]);
  board.name = 'sign-board';
  board.position.y = 1.25;
  board.castShadow = true;
  sign.add(board);
  for (const x of [-SIGN_LEG, SIGN_LEG]) put(sign, cyl(0.07, 0.07, 0.9), mat(0x8f5f38), x, 0.45, 0);
  const spot = signSpot(fp);
  sign.position.set(spot.x, 0, spot.z);
  sign.rotation.y = spot.angle;
  return sign;
}

/**
 * Whether a tile is kept clear of scenery: the building and its plots of land with a margin round them, the street,
 * the path to the door, and the rival's storefront across the street.
 */
function keptClear(fp: Footprint, plots: readonly Rect[], x: number, y: number): boolean {
  /** Whether the tile is on a rectangle or the margin round it. */
  const near = (r: Rect) => inRect({ x0: r.x0 - 1, x1: r.x1 + 2, y0: r.y0 - 1, y1: r.y1 + 1 }, x, y);
  const nearBuilding = fp.rects.some(near) || plots.some(near);
  const onRoad = y >= SIDEWALK_Y && y <= ROAD_Y[1];
  const nearPath = x >= fp.door[0] - 7 && x <= fp.door[1] + 3 && y > fp.front;
  return nearBuilding || onRoad || nearPath || onStorefront(fp, x, y);
}

/** How many tiles of paving the ground's pattern holds each way before it repeats. */
const PAVING_TILES = 8;
/** The pattern of paving on the ground beyond the lot, painted once. */
let paving: THREE.CanvasTexture | null = null;

/**
 * The pattern of paving on the ground, matching the slabs the floor paints on the lot (see floor.ts): slabs two tiles
 * long, each row set half a slab along, in a white the ground's color tints, with darker joints. It is lined up with
 * the tiles for a ground whose west edge is at `left` and south edge at `bottom`.
 */
function pavingMap(left: number, bottom: number): THREE.CanvasTexture {
  if (!paving) {
    const TS = 64;
    const c = document.createElement('canvas');
    c.width = PAVING_TILES * TS;
    c.height = PAVING_TILES * TS;
    const ctx = must(c.getContext('2d'), '2D canvas');
    for (let y = 0; y < PAVING_TILES; y++)
      for (let x = 0; x < PAVING_TILES; x++) {
        const starts = (x + y) % 2 === 0;
        const v = 246 + Math.round(hash(starts ? x : x - 1, y + 50) * 9);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x * TS, y * TS, TS, TS);
        ctx.fillStyle = 'rgb(176,174,168)';
        ctx.fillRect(x * TS, y * TS, TS, 2);
        if (starts) ctx.fillRect(x * TS, y * TS, 2, TS);
      }
    paving = new THREE.CanvasTexture(c);
    paving.colorSpace = THREE.SRGBColorSpace;
    paving.wrapS = THREE.RepeatWrapping;
    paving.wrapT = THREE.RepeatWrapping;
    paving.anisotropy = 8;
    paving.repeat.set(400 / PAVING_TILES, 400 / PAVING_TILES);
  }
  // the pattern's top row is drawn at the ground's north edge, so it is offset to start on a whole tile
  paving.offset.set(left / PAVING_TILES, -bottom / PAVING_TILES);
  return paving;
}

/** How far out from the lot's edge the streets either side of it and behind it run: their near and far kerbs. */
const SIDE_STREET = { near: 3, far: 6 };
/** How far beyond the lot's edge the first row of office blocks starts, past the street, and the towers behind them. */
const OFFICES_AWAY = 7.5;
const TOWERS_AWAY = 15.5;
/** How far out across the main road the row of blocks there starts: past the rival's storefront. */
const FRONT_AWAY = 34;
/** How far either way the streets and blocks run. */
const CITY_REACH = 44;

/**
 * The office blocks round a lot this wide: a row across each side street and across the street behind, towers behind
 * those, and a low row across the main road beyond the rival's storefront. Each stands far enough back that, from
 * any side the camera turns to, it hides none of the lot (see tests/unit/downtown.test.ts).
 */
export function officeBlocks(width: number): Block[] {
  const blocks: Block[] = [];
  let seed = 0;
  /**
   * A row of blocks from a to b along x, or along z if `alongZ`, their fronts on the line `face` and backs away from
   * the lot (`away` +1 or -1), of `fewest` to `most` floors.
   */
  const row = (alongZ: boolean, a: number, b: number, face: number, away: number, fewest: number, most: number) => {
    for (let t = a; t + 4 <= b;) {
      const n = seed++;
      const long = 4 + Math.floor(hash(n, 1) * 4);
      const deep = 4 + Math.floor(hash(n, 2) * 2);
      const floors = fewest + Math.floor(hash(n, 3) * (most - fewest + 1));
      const w = Math.min(long, b - t);
      const along = t + w / 2;
      const across = face + (away * deep) / 2;
      blocks.push(
        alongZ
          ? { x: across, z: along, w: deep, d: w, floors, seed: n }
          : { x: along, z: across, w, d: deep, floors, seed: n },
      );
      t += w + 0.8;
    }
  };
  const { near, far } = SIDE_STREET;
  /** A row of blocks along x, broken where each side street runs through it. */
  const across = (face: number, away: number, fewest: number, most: number) => {
    for (const [a, b] of [
      [-CITY_REACH, -far - 1],
      [-near + 1, width + near - 1],
      [width + far + 1, width + CITY_REACH],
    ] as const)
      row(false, a, b, face, away, fewest, most);
  };
  across(-OFFICES_AWAY, -1, 2, 4);
  across(-TOWERS_AWAY, -1, 5, 8);
  // the side streets' rows run from the street behind to the main road, and on across it to the row facing it
  for (const [z0, z1] of [
    [-far + 4.5, ROAD_Y[0] - 1.5],
    [ROAD_Y[1] + 2.5, FRONT_AWAY - 1],
  ] as const) {
    row(true, z0, z1, -OFFICES_AWAY, -1, 2, 4);
    row(true, z0, z1, width + OFFICES_AWAY, 1, 2, 4);
    row(true, z0, z1, -TOWERS_AWAY, -1, 5, 8);
    row(true, z0, z1, width + TOWERS_AWAY, 1, 5, 8);
  }
  across(FRONT_AWAY, 1, 2, 3);
  return blocks;
}

/**
 * Downtown round the lot: streets round its block, office blocks across them, street trees in planters across the
 * plaza wherever it is clear, and lamp posts along both kerbs of the main road.
 */
function buildDowntown(fp: Footprint, width: number, plots: readonly Rect[]): THREE.Group {
  const city = new THREE.Group();
  const { near, far } = SIDE_STREET;
  const west = -CITY_REACH;
  const east = width + CITY_REACH;
  const north = -CITY_REACH;
  const south = H + CITY_REACH;
  const streets = [
    { x0: west, x1: east, z0: ROAD_Y[0], z1: ROAD_Y[1] + 1 },
    { x0: west, x1: east, z0: -far, z1: -near },
    { x0: -far, x1: -near, z0: north, z1: south },
    { x0: width + near, x1: width + far, z0: north, z1: south },
  ];
  // the floor paints the dashes on the lot; out past it they carry on, a tile apart, but not across the side streets
  const dashes: { x: number; z: number }[] = [];
  for (let x = west; x < east; x += 2) {
    const onLot = x >= 0 && x < width;
    const crossing = (x + 1 > -far && x < -near) || (x + 1 > width + near && x < width + far);
    if (!onLot && !crossing) dashes.push({ x: x + 0.5, z: ROAD_Y[0] + 1 - 1 / 32 });
  }
  city.add(buildStreets(streets, dashes));
  city.add(buildOffices(officeBlocks(width)));

  // a street tree every few tiles, rows set off from one another, wherever the plaza is clear
  const trees: TreeSpot[] = [];
  for (let y = -2, r = 0; y < FRONT_AWAY - 1; y += 4, r++) {
    for (let x = -2 + (r % 2) * 2; x < width + 2; x += 4) {
      if (keptClear(fp, plots, x, y) || hash(x, y) < 0.12) continue;
      trees.push({ x: x + 0.5, z: y + 0.5, seed: Math.floor(hash(y, x) * 97) });
    }
  }
  city.add(buildStreetTrees(trees));

  // lamps along the kerb of the pavement, and of the far side of the road, clear of every path and of the storefront
  const lamps: { x: number; z: number }[] = [];
  for (let x = -2; x < width + 2; x += 3) {
    const nearPath = x >= fp.door[0] - 2 && x <= fp.door[1] + 2;
    const onPlotPath = plots.some((r) => x >= r.x0 - 1 && x <= r.x1 + 1 && SIDEWALK_Y - 1 <= r.y1 && r.y1 < SIDEWALK_Y);
    if (x % 6 === 4 && !nearPath && !onPlotPath) lamps.push({ x: x + 0.5, z: SIDEWALK_Y + 0.88 });
    if (x % 6 === 1 && !onStorefront(fp, x, ROAD_Y[1] + 1)) lamps.push({ x: x + 0.5, z: ROAD_Y[1] + 1.12 });
  }
  city.add(buildLamps(lamps));
  return city;
}

/** The sea behind the lot, a row of beach huts along the shore, and dune grass on the sand. */
function buildSeaside(fp: Footprint, width: number, plots: readonly Rect[]): THREE.Group {
  const shore = new THREE.Group();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4aa8c9, roughness: 0.25 }),
  );
  sea.position.set(width / 2, -0.01, -2 - 100);
  sea.receiveShadow = true;
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 0.7).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf4fbfc, roughness: 0.6 }),
  );
  foam.position.set(width / 2, -0.005, -1.8);
  shore.add(sea, foam);
  const huts: TreeSpot[] = [];
  for (let x = -12; x < width + 12; x += 2) huts.push({ x: x + 0.5, z: 0.6, seed: Math.floor(hash(x, 3) * 97) });
  const grass: TreeSpot[] = [];
  for (let y = 2; y < H + 2; y++) {
    for (let x = -4; x < width + 4; x++) {
      if (keptClear(fp, plots, x, y) || hash(x, y) > 0.12) continue;
      grass.push({
        x: x + 0.5 + (hash(x + 9, y) - 0.5) * 0.6,
        z: y + 0.5 + (hash(x, y + 9) - 0.5) * 0.6,
        seed: Math.floor(hash(y, x) * 97),
      });
    }
  }
  shore.add(buildBeach(huts, grass));
  return shore;
}

/**
 * The outer walls' paint. Its shadow is cast from the faces toward the sun: cast from the faces away from it, as a
 * material's is by default, a wall's shadow starts on its inner face, just where that meets the floor and the wall
 * across the corner, and the bias lets a hairline of sun through along both.
 */
const SHELL_WALL = mat(0xf7f1e5, 0.85).clone();
SHELL_WALL.shadowSide = THREE.FrontSide;

/** Build the building's outer walls: tall across from the camera, low facing it, with a gap for each entrance. */
export function buildShell(fp: Footprint, near: Sides): THREE.Group {
  const shell = new THREE.Group();
  const wall = SHELL_WALL;
  const trim = mat(SHELL_TRIM, 0.6);
  const T = OUTER_T;
  /** Add a plain box to the outer shell. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) =>
    put(shell, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  for (const { horizontal, at, a, b, tall } of shellStretches(fp, near)) {
    const len = b - a;
    const mid = (a + b) / 2;
    if (tall) {
      const HT = OUTER_HT;
      if (horizontal) {
        box(len, HT, T, mid, HT / 2, at, wall);
        box(len + 0.06, 0.12, T + 0.08, mid, HT + 0.06, at, trim);
      } else {
        box(T, HT, len, at, HT / 2, mid, wall);
        box(T + 0.08, 0.12, len + 0.06, at, HT + 0.06, mid, trim);
      }
    } else if (horizontal) {
      box(len, H_LOW + 0.05, T, mid, (H_LOW + 0.05) / 2, at, wall);
      box(len, 0.07, T + 0.06, mid, H_LOW + 0.085, at, trim);
    } else {
      box(T, H_LOW + 0.05, len, at, (H_LOW + 0.05) / 2, mid, wall);
      box(T + 0.06, 0.07, len, at, H_LOW + 0.085, mid, trim);
    }
  }
  // the pillars either side of each entrance, lamps on top, in the middle of the wall
  for (const e of fp.entrances) {
    const { line, a, b } = entranceSpan(e);
    const across = line + ((e.side === 'south' || e.side === 'east' ? 1 : -1) * T) / 2;
    for (const along of [a - 0.16, b + 0.16]) {
      const [x, z] = e.side === 'north' || e.side === 'south' ? [along, across] : [across, along];
      put(shell, rbox(0.34, 1.5, 0.34, 0.05), wall, x, 0.75, z);
      put(shell, rbox(0.42, 0.1, 0.42, 0.04), trim, x, 1.52, z);
      put(shell, sph(0.17), mat(0xffe9a8, 0.3, 0.7), x, 1.72, z);
    }
  }
  mergeStill(shell);
  return shell;
}
