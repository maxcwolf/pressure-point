// The scenery that never changes: the lawn, the building's outer walls, the sign and the trees.
// The windows in the outer walls do change, as rooms are built against them, so they are drawn with the rooms.

import * as THREE from 'three';

import { H, type Plot, ROAD_Y, SIDEWALK_Y, TITLE_LINES, W } from '../core/data';
import { must } from '../core/util';
import { buildBeach } from './models/beach';
import { cyl, mat, put, rbox, sph } from './models/parts';
import { buildForest, type TreeSpot } from './models/tree';
import type { Setting } from './setting';
import { H_LOW, hash, OUTER_HT, OUTER_T } from './shared';
import { SIGN_HALF, SIGN_LEG, signSpot } from './sign';

/** Build the scenery that never changes around a building on its plot, in its setting, and add it to the scene. */
export function buildScenery(scene: THREE.Scene, plot: Plot, setting: 'park' | 'seaside', colors: Setting) {
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: colors.ground, roughness: 1 }),
  );
  lawn.position.set(W / 2, -0.03, H / 2);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // outer shell: tall at the back, low at the front so you can see in
  const shell = new THREE.Group();
  const wall = mat(0xf7f1e5, 0.85);
  const trim = mat(0x2fa8a0, 0.6);
  const T = OUTER_T;
  const x0 = plot.x0;
  const x1 = plot.x1 + 1;
  const z0 = plot.y0;
  const z1 = plot.y1 + 1;
  const HT = OUTER_HT;
  /** Add a plain box to the outer shell. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) =>
    put(shell, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  box(x1 - x0 + T * 2, HT, T, (x0 + x1) / 2, HT / 2, z0 - T / 2, wall);
  box(x1 - x0 + T * 2 + 0.06, 0.12, T + 0.08, (x0 + x1) / 2, HT + 0.06, z0 - T / 2, trim);
  box(T, HT, z1 - z0 + T, x0 - T / 2, HT / 2, (z0 + z1) / 2 + T / 2, wall);
  box(T + 0.08, 0.12, z1 - z0 + T + 0.06, x0 - T / 2, HT + 0.06, (z0 + z1) / 2 + T / 2, trim);
  // the windows in the back walls make way for rooms built against them, so the rooms layer draws them
  // low front walls with a gap for the entrance
  const e0 = plot.door[0];
  const e1 = plot.door[1] + 1;
  for (const [a, b] of [
    [x0, e0],
    [e1, x1 + T],
  ] as const) {
    box(b - a, H_LOW + 0.05, T, (a + b) / 2, (H_LOW + 0.05) / 2, z1 + T / 2, wall);
    box(b - a, 0.07, T + 0.06, (a + b) / 2, H_LOW + 0.085, z1 + T / 2, trim);
  }
  box(T, H_LOW + 0.05, z1 - z0, x1 + T / 2, (H_LOW + 0.05) / 2, (z0 + z1) / 2, wall);
  box(T + 0.06, 0.07, z1 - z0, x1 + T / 2, H_LOW + 0.085, (z0 + z1) / 2, trim);
  for (const x of [e0 - 0.16, e1 + 0.16]) {
    put(shell, rbox(0.34, 1.5, 0.34, 0.05), wall, x, 0.75, z1 + T / 2);
    put(shell, rbox(0.42, 0.1, 0.42, 0.04), trim, x, 1.52, z1 + T / 2);
    put(shell, sph(0.17), mat(0xffe9a8, 0.3, 0.7), x, 1.72, z1 + T / 2);
  }
  scene.add(shell);

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
    return;
  }

  // trees wherever there is lawn
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
  scene.add(buildForest(trees));
}

/** Whether a tile is kept clear of scenery: the building and a margin round it, the street, and the path to the door. */
function keptClear(plot: Plot, x: number, y: number): boolean {
  const inPlot = x >= plot.x0 - 1 && x <= plot.x1 + 2 && y >= plot.y0 - 1 && y <= plot.y1 + 1;
  const onRoad = y >= SIDEWALK_Y && y <= ROAD_Y[1];
  const nearPath = x >= plot.door[0] - 7 && x <= plot.door[1] + 3 && y > plot.y1;
  return inPlot || onRoad || nearPath;
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
