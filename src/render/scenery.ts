// The scenery: the lawn, the sign and the trees, pines in the snow, or rows of apple trees, and apart from it the
// building's outer walls. The scenery changes only when the building grows into more land; the walls change too as the
// camera turns, since the ones facing it are cut low. The windows in the outer walls change as rooms are built against
// them, so they are drawn with the rooms.

import * as THREE from 'three';

import { H, type Plot, ROAD_Y, SIDEWALK_Y, TITLE_LINES, W } from '../core/data';
import { must } from '../core/util';
import { buildBeach } from './models/beach';
import { mergeStill } from './models/merge';
import { buildOrchard, orchardRows } from './models/orchard';
import { cyl, mat, put, rbox, sph } from './models/parts';
import { buildPines } from './models/pine';
import { buildForest, type TreeSpot } from './models/tree';
import type { Setting } from './setting';
import { H_LOW, hash, OUTER_HT, OUTER_T } from './shared';
import { SIGN_HALF, SIGN_LEG, signSpot } from './sign';
import { onStorefront } from './storefront';
import type { Side, Sides } from './turn';

/** Build the scenery around a building on its plot, in its setting: the same until the building grows. */
export function buildScenery(
  plot: Plot,
  setting: 'park' | 'seaside' | 'mountain' | 'orchard',
  colors: Setting,
): THREE.Group {
  const scene = new THREE.Group();
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: colors.ground, roughness: 1 }),
  );
  lawn.position.set(W / 2, -0.03, H / 2);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // sign on the front lawn
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
  const board = new THREE.Mesh(new THREE.BoxGeometry(SIGN_HALF * 2, 1, 0.12), [
    mat(0x2fa8a0),
    mat(0x2fa8a0),
    mat(0x2fa8a0),
    mat(0x2fa8a0),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
    mat(0x2fa8a0),
  ]);
  board.position.y = 1.25;
  board.castShadow = true;
  sign.add(board);
  for (const x of [-SIGN_LEG, SIGN_LEG]) put(sign, cyl(0.07, 0.07, 0.9), mat(0x8f5f38), x, 0.45, 0);
  const spot = signSpot(plot);
  sign.position.set(spot.x, 0, spot.z);
  sign.rotation.y = spot.angle;
  scene.add(sign);

  if (setting === 'seaside') {
    scene.add(buildSeaside(plot));
    return scene;
  }
  if (setting === 'orchard') {
    // apple trees in rows, wherever the lawn is clear
    const rows = orchardRows(-6, W + 6, -6, H + 6).filter((p) => !keptClear(plot, Math.floor(p.x), Math.floor(p.z)));
    scene.add(buildOrchard(rows.map((p, i) => ({ ...p, seed: Math.floor(hash(i, 5) * 97) }))));
    return scene;
  }

  // trees wherever there is lawn, or snow
  const trees: TreeSpot[] = [];
  for (let y = -3; y < H + 2; y++) {
    for (let x = -4; x < W + 4; x++) {
      if (keptClear(plot, x, y) || hash(x, y) > 0.2) continue;
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

/**
 * Whether a tile is kept clear of scenery: the building and a margin round it, the street, the path to the door, and
 * the rival's storefront across the street.
 */
function keptClear(plot: Plot, x: number, y: number): boolean {
  const inPlot = x >= plot.x0 - 1 && x <= plot.x1 + 2 && y >= plot.y0 - 1 && y <= plot.y1 + 1;
  const onRoad = y >= SIDEWALK_Y && y <= ROAD_Y[1];
  const nearPath = x >= plot.door[0] - 7 && x <= plot.door[1] + 3 && y > plot.y1;
  return inPlot || onRoad || nearPath || onStorefront(plot, x, y);
}

/** The sea behind the lot, a row of beach huts along the shore, and dune grass on the sand. */
function buildSeaside(plot: Plot): THREE.Group {
  const shore = new THREE.Group();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4aa8c9, roughness: 0.25 }),
  );
  sea.position.set(W / 2, -0.01, -2 - 100);
  sea.receiveShadow = true;
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 0.7).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf4fbfc, roughness: 0.6 }),
  );
  foam.position.set(W / 2, -0.005, -1.8);
  shore.add(sea, foam);
  const huts: TreeSpot[] = [];
  for (let x = -12; x < W + 12; x += 2) huts.push({ x: x + 0.5, z: 0.6, seed: Math.floor(hash(x, 3) * 97) });
  const grass: TreeSpot[] = [];
  for (let y = 2; y < H + 2; y++) {
    for (let x = -4; x < W + 4; x++) {
      if (keptClear(plot, x, y) || hash(x, y) > 0.12) continue;
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

/** A wall of the building's shell, and the corners it takes in at either end. */
interface ShellWall {
  side: Side;
  tall: boolean;
  /** Whether it runs on over the corner at its start (north or west) and at its end (south or east). */
  fromCorner: boolean;
  toCorner: boolean;
}

/**
 * The building's four outer walls, tall across from the camera and low on the sides facing it, and which takes in
 * each corner: a tall wall before a low one, and along x before along z. Looking from the south-east, as the game
 * always has, the north wall runs the whole width, the west wall takes the south-west corner and the low south wall
 * the south-east one.
 */
export function shellWalls(near: Sides): ShellWall[] {
  const order: Side[] = ['north', 'south', 'west', 'east'];
  /** How strongly a wall claims a corner: a tall wall first, then along x. */
  const rank = (side: Side) => (near[side] ? 2 : 0) + (side === 'west' || side === 'east' ? 1 : 0);
  /** Which of two walls meeting at a corner takes it in. */
  const owner = (a: Side, b: Side) => (rank(a) <= rank(b) ? a : b);
  type Corner = 'nw' | 'ne' | 'sw' | 'se';
  const corners: Record<Corner, Side> = {
    nw: owner('north', 'west'),
    ne: owner('north', 'east'),
    sw: owner('south', 'west'),
    se: owner('south', 'east'),
  };
  /** The corners at the start and end of each wall: west or north first. */
  const ends: Record<Side, [Corner, Corner]> = {
    north: ['nw', 'ne'],
    south: ['sw', 'se'],
    west: ['nw', 'sw'],
    east: ['ne', 'se'],
  };
  return order.map((side) => {
    const [from, to] = ends[side];
    return { side, tall: !near[side], fromCorner: corners[from] === side, toCorner: corners[to] === side };
  });
}

/** Build the building's outer walls on its plot: tall across from the camera, low facing it, with the entrance in front. */
export function buildShell(plot: Plot, near: Sides): THREE.Group {
  const shell = new THREE.Group();
  const wall = mat(0xf7f1e5, 0.85);
  const trim = mat(0x2fa8a0, 0.6);
  const T = OUTER_T;
  const x0 = plot.x0;
  const x1 = plot.x1 + 1;
  const z0 = plot.y0;
  const z1 = plot.y1 + 1;
  /** Add a plain box to the outer shell. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) =>
    put(shell, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  /** One stretch of a wall, from a to b along it, with its trim along the top. */
  const stretch = (horizontal: boolean, at: number, a: number, b: number, tall: boolean) => {
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
  };
  // the entrance, in the front wall
  const e0 = plot.door[0];
  const e1 = plot.door[1] + 1;
  for (const w of shellWalls(near)) {
    const horizontal = w.side === 'north' || w.side === 'south';
    const a = (horizontal ? x0 : z0) - (w.fromCorner ? T : 0);
    const b = (horizontal ? x1 : z1) + (w.toCorner ? T : 0);
    const at =
      w.side === 'north' ? z0 - T / 2 : w.side === 'south' ? z1 + T / 2 : w.side === 'west' ? x0 - T / 2 : x1 + T / 2;
    if (w.side !== 'south') stretch(horizontal, at, a, b, w.tall);
    else {
      stretch(true, at, a, e0, w.tall);
      stretch(true, at, e1, b, w.tall);
    }
  }
  for (const x of [e0 - 0.16, e1 + 0.16]) {
    put(shell, rbox(0.34, 1.5, 0.34, 0.05), wall, x, 0.75, z1 + T / 2);
    put(shell, rbox(0.42, 0.1, 0.42, 0.04), trim, x, 1.52, z1 + T / 2);
    put(shell, sph(0.17), mat(0xffe9a8, 0.3, 0.7), x, 1.72, z1 + T / 2);
  }
  mergeStill(shell);
  return shell;
}
