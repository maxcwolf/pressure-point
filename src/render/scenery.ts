// The scenery: the lawn, the sign and the trees, pines in the snow, or rows of apple trees, and apart from it the
// building's outer walls. The scenery changes only when the building grows into more land; the walls change too as the
// camera turns, since the ones facing it are cut low. The windows in the outer walls change as rooms are built against
// them, so they are drawn with the rooms.

import * as THREE from 'three';

import { H, type Rect, ROAD_Y, SIDEWALK_Y, TITLE_LINES } from '../core/data';
import { entranceSpan, type Footprint, inRect } from '../core/footprint';
import { must } from '../core/util';
import { buildBeach } from './models/beach';
import { mergeStill } from './models/merge';
import { buildOrchard, orchardRows } from './models/orchard';
import { cyl, mat, put, rbox, sph } from './models/parts';
import { buildPines } from './models/pine';
import { buildForest, type TreeSpot } from './models/tree';
import { shellStretches } from './outer-walls';
import { LAWN, type Setting } from './setting';
import { H_LOW, hash, OUTER_HT, OUTER_T, SHELL_TRIM } from './shared';
import { SIGN_HALF, SIGN_LEG, signSpot } from './sign';
import { onStorefront } from './storefront';
import type { Sides } from './turn';

/** Build the scenery around a building, in its setting: the same until the building grows. */
export function buildScenery(
  fp: Footprint,
  setting: 'park' | 'seaside' | 'mountain' | 'orchard',
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

  scene.add(buildSign(fp));

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

/** Build the building's outer walls: tall across from the camera, low facing it, with a gap for each entrance. */
export function buildShell(fp: Footprint, near: Sides): THREE.Group {
  const shell = new THREE.Group();
  const wall = mat(0xf7f1e5, 0.85);
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
