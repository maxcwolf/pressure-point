// The scenery that never changes: the lawn, the building's outer walls, the sign and the trees.

import * as THREE from 'three';

import { H, outsideDoor, type Plot, ROAD_Y, SIDEWALK_Y, TITLE_LINES, W } from '../core/data';
import { must } from '../core/util';
import { cyl, mat, put, rbox, sph } from './models/parts';
import { buildForest, type TreeSpot } from './models/tree';
import { H_LOW, hash } from './shared';

/** Build the scenery that never changes around a building on its plot, and add it to the scene. */
export function buildScenery(scene: THREE.Scene, plot: Plot) {
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8cc98a, roughness: 1 }),
  );
  lawn.position.set(W / 2, -0.03, H / 2);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // outer shell: tall at the back, low at the front so you can see in
  const shell = new THREE.Group();
  const wall = mat(0xf7f1e5, 0.85);
  const trim = mat(0x2fa8a0, 0.6);
  const T = 0.28;
  const x0 = plot.x0;
  const x1 = plot.x1 + 1;
  const z0 = plot.y0;
  const z1 = plot.y1 + 1;
  const HT = 2.0;
  /** Add a plain box to the outer shell. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) =>
    put(shell, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  box(x1 - x0 + T * 2, HT, T, (x0 + x1) / 2, HT / 2, z0 - T / 2, wall);
  box(x1 - x0 + T * 2 + 0.06, 0.12, T + 0.08, (x0 + x1) / 2, HT + 0.06, z0 - T / 2, trim);
  box(T, HT, z1 - z0 + T, x0 - T / 2, HT / 2, (z0 + z1) / 2 + T / 2, wall);
  box(T + 0.08, 0.12, z1 - z0 + T + 0.06, x0 - T / 2, HT + 0.06, (z0 + z1) / 2 + T / 2, trim);
  const glass = mat(0xbfe6f5, 0.2, 0.25);
  for (let x = x0 + 2; x < x1 - 1; x += 3) box(1.5, 0.75, 0.04, x + 0.5, 1.3, z0 + 0.02, glass);
  for (let z = z0 + 2; z < z1 - 1; z += 3) box(0.04, 0.75, 1.5, x0 + 0.02, 1.3, z + 0.5, glass);
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
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.12), [
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
  for (const x of [-1.3, 1.3]) put(sign, cyl(0.07, 0.07, 0.9), mat(0x8f5f38), x, 0.45, 0);
  sign.position.set(e0 - 4.2, 0, outsideDoor(plot) + 1);
  sign.rotation.y = Math.PI / 5;
  scene.add(sign);

  // trees wherever there is lawn
  const trees: TreeSpot[] = [];
  for (let y = -3; y < H + 2; y++) {
    for (let x = -4; x < W + 4; x++) {
      const inPlot = x >= plot.x0 - 1 && x <= plot.x1 + 2 && y >= plot.y0 - 1 && y <= plot.y1 + 1;
      const onRoad = y >= SIDEWALK_Y && y <= ROAD_Y[1];
      const nearPath = x >= e0 - 7 && x <= e1 + 2 && y > plot.y1;
      if (inPlot || onRoad || nearPath || hash(x, y) > 0.2) continue;
      trees.push({
        x: x + 0.5 + (hash(x + 9, y) - 0.5) * 0.5,
        z: y + 0.5 + (hash(x, y + 9) - 0.5) * 0.5,
        seed: Math.floor(hash(y, x) * 97),
      });
    }
  }
  scene.add(buildForest(trees));
}
