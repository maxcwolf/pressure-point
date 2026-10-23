// The seaside: a row of beach huts and tufts of dune grass on the sand, drawn as a few instanced meshes. Each hut is a
// soft clay box in a muted pastel under a white two-slope roof, with white boards up its corners and sides, and its door
// and step on the land side, which the camera sees; each color is given to the copies of one mesh, not a mesh apiece.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { must } from '../../core/util';
import { cached, cyl, mat, rbox, soft, WOOD } from './parts';
import type { TreeSpot } from './tree';

/** The huts' paint: coral, sky, butter, mint and peach, soft enough to sit beside the building and not shout over it. */
const HUT_COLORS = [0xf0ad9f, 0xa6cbe2, 0xf3df9f, 0xb0dabf, 0xf5c3a0] as const;
/** The boards, the door's frame and the roof: a warm white. */
const BOARD = 0xf6f1e6;
const GRASS_COLORS = [0x9bb85a, 0xb5c46a] as const;

/** A hut's width and depth, how tall its walls stand, and how high its ridge is over them. */
const HUT_W = 0.95;
const HUT_H = 1.05;
const GABLE = 0.45;

/** An instanced mesh with one copy of a shape for each placement, each copy in its own color if colors are given. */
function instanced(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  placements: readonly THREE.Matrix4[],
  colors?: readonly number[],
) {
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  const color = new THREE.Color();
  placements.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    const c = colors?.[i];
    if (c !== undefined) mesh.setColorAt(i, color.setHex(c));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** A placement: where, turned how far about the upright, and stretched how much. */
const place = (x: number, y: number, z: number, turn: number, sx: number, sy: number, sz: number, tilt = 0, roll = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, turn, roll)),
    new THREE.Vector3(sx, sy, sz),
  );

/** A hut's walls and the gable over them, standing on the ground, as one shape that every hut shares. */
const hutBody = () =>
  cached('hut-body', () => {
    const walls = soft(HUT_W, HUT_H, HUT_W)
      .clone()
      .translate(0, HUT_H / 2, 0);
    // the gable: a triangle across the hut, run front to back, flat on the walls' top
    const half = HUT_W / 2 - 0.01;
    const shape = new THREE.Shape([
      new THREE.Vector2(-half, 0),
      new THREE.Vector2(half, 0),
      new THREE.Vector2(0, GABLE),
    ]);
    const gable = new THREE.ExtrudeGeometry(shape, { depth: HUT_W - 0.02, bevelEnabled: false });
    gable.translate(0, HUT_H - 0.02, -(HUT_W - 0.02) / 2);
    return must(mergeGeometries([walls, gable], false) as THREE.BufferGeometry | null, 'the shape of a beach hut');
  });

/** A shade of a color, darker by a share. */
const deeper = (hex: number, by: number) => new THREE.Color(hex).multiplyScalar(1 - by).getHex();

/** Beach huts at these spots and dune grass at those, all facing the land. */
export function buildBeach(huts: readonly TreeSpot[], grass: readonly TreeSpot[]): THREE.Group {
  const beach = new THREE.Group();
  const bodies: THREE.Matrix4[] = [];
  const paint: number[] = [];
  // the boards, the door and its frame, the step and the roof: one rounded box, stretched and colored for each
  const boards: THREE.Matrix4[] = [];
  const boardColors: number[] = [];
  /** Add a board, placed and stretched, in a color. */
  const board = (m: THREE.Matrix4, color: number) => {
    boards.push(m);
    boardColors.push(color);
  };
  const pitch = Math.atan2(GABLE, HUT_W / 2);
  const slope = Math.hypot(GABLE, HUT_W / 2) + 0.1;
  const half = HUT_W / 2;
  for (const { x, z, seed } of huts) {
    const color = HUT_COLORS[seed % HUT_COLORS.length] ?? HUT_COLORS[0];
    bodies.push(place(x, 0, z, 0, 1, 1, 1));
    paint.push(color);
    // white boards up each corner, and one up the middle of each end and of the back
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        board(place(x + sx * (half - 0.05), HUT_H / 2, z + sz * (half - 0.05), 0, 0.13, HUT_H, 0.13), BOARD);
    for (const sx of [-1, 1]) board(place(x + sx * half, HUT_H / 2, z, 0, 0.03, HUT_H, 0.12), BOARD);
    board(place(x, HUT_H / 2, z - half, 0, 0.12, HUT_H, 0.03), BOARD);
    // the door on the land side, in a deeper shade of the hut's paint, in a white frame, with a wooden step before it
    board(place(x, 0.47, z + half, 0, 0.5, 0.86, 0.04), BOARD);
    board(place(x, 0.45, z + half + 0.012, 0, 0.38, 0.76, 0.04), deeper(color, 0.22));
    board(place(x, 0.05, z + half + 0.14, 0, 0.58, 0.1, 0.26), WOOD);
    // the roof, a board down each slope from the ridge, over the walls at the eaves and the gables
    for (const side of [-1, 1]) {
      const along = slope / 2 - 0.06;
      board(
        place(
          x + side * Math.cos(pitch) * along,
          HUT_H + GABLE - Math.sin(pitch) * along + 0.03,
          z,
          0,
          slope,
          0.06,
          HUT_W + 0.14,
          0,
          -side * pitch,
        ),
        BOARD,
      );
    }
  }
  if (bodies.length) beach.add(instanced(hutBody(), mat(0xffffff, 0.6), bodies, paint));
  if (boards.length) beach.add(instanced(rbox(1, 1, 1, 0.06), mat(0xffffff, 0.55), boards, boardColors));

  const blades: THREE.Matrix4[] = [];
  const bladeColors: number[] = [];
  for (const { x, z, seed } of grass) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      const tall = 0.35 + ((seed + i) % 4) * 0.08;
      blades.push(place(x + Math.cos(a) * 0.08, tall / 2, z + Math.sin(a) * 0.08, a, 1, tall, 1, 0.25));
      bladeColors.push(GRASS_COLORS[(seed + i) % 2] ?? GRASS_COLORS[0]);
    }
  }
  if (blades.length) beach.add(instanced(cyl(0.001, 0.035, 1, 4), mat(0xffffff, 0.8), blades, bladeColors));
  return beach;
}
