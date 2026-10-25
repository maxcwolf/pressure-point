// Trees for the lawn, in leaf for most of the year: fresh in spring, full in summer, scarlet, orange and gold in autumn,
// and in winter bare, down to a few empty branches.
import * as THREE from 'three';

import type { Season } from '../../core/sim/twists';
import { blob, capsule, cyl, joined, mat, type Piece } from './parts';

/** Where a tree stands on the ground, and the seed its height and color vary with. */
export interface TreeSpot {
  x: number;
  z: number;
  seed: number;
}

/** The colors of the leaves in each season, five to a season so neighbouring trees differ, or null when they are gone. */
export const LEAF_SEASONS: Readonly<Record<Season, readonly [number, number, number, number, number] | null>> = {
  spring: [0x78c868, 0x66b860, 0x8fd078, 0x9cd66e, 0x5aac66],
  summer: [0x5fae5a, 0x4f9a55, 0x74b85c, 0x468c4a, 0x82bf62],
  // scarlet, orange, gold, crimson and a last yellowing green, bright against the lawn's gold
  autumn: [0xe0452c, 0xf0862a, 0xf2bd30, 0xbe2c42, 0xbcc23a],
  winter: null,
};
const LEAF_COLORS = [0x5fae5a, 0x4f9a55, 0x74b85c, 0x468c4a, 0x82bf62] as const;

/** Leaves of a color, in a material of their own. */
const leaf = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 });
/**
 * The leaves of every tree, one material for each of the five colors, of their own rather than shared with anything
 * else, so a change of season repaints every tree at once with nothing built again.
 */
const LEAVES = [
  leaf(LEAF_COLORS[0]),
  leaf(LEAF_COLORS[1]),
  leaf(LEAF_COLORS[2]),
  leaf(LEAF_COLORS[3]),
  leaf(LEAF_COLORS[4]),
] as const;

/** The leaves in one of the five colors, for trees built elsewhere, such as the street trees, to turn with the park's. */
export const leafMaterial = (i: 0 | 1 | 2 | 3 | 4): THREE.MeshStandardMaterial => LEAVES[i];

/** The color of the bark, on the trunks and the bare branches. */
export const BARK = 0x7a5a3c;
/**
 * The bare branches of every broadleaved tree, the park's, the street's and the orchards', shown only while the leaves
 * are gone: a material of their own, like the leaves', so a change of season shows or hides them all at once.
 */
export const BRANCHES = new THREE.MeshStandardMaterial({ color: BARK, roughness: 0.9, metalness: 0, visible: false });

/** Turn every tree's leaves to a season's colors, or take them off and leave the branches bare. */
export function leavesFor(season: Season) {
  const colors = LEAF_SEASONS[season];
  for (const material of LEAVES) material.visible = colors !== null;
  colors?.forEach((color, i) => LEAVES[i]?.color.setHex(color));
  BRANCHES.visible = colors === null;
}

const UP = new THREE.Vector3(0, 1, 0);
/**
 * A branch growing from a point, leaning `lean` from upright toward `turn` round the trunk, `len` long and `r` thick: a
 * capsule laid along it, rounded at the tip like a limb, and the point where it ends.
 */
function branch(from: THREE.Vector3, turn: number, lean: number, len: number, r: number) {
  const along = new THREE.Vector3(Math.sin(lean) * Math.cos(turn), Math.cos(lean), Math.sin(lean) * Math.sin(turn));
  const mid = from.clone().addScaledVector(along, len / 2);
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, along));
  const piece: Piece = [capsule(r, len), mid.x, mid.y, mid.z, e.x, e.y, e.z];
  return { piece, end: from.clone().addScaledVector(along, len) };
}

/**
 * The limbs of a bare tree, from the top of its trunk: a leader on up the middle and three spreading out, as a turn
 * round the trunk, a lean from upright and a length. Each forks at its end into two twigs.
 */
const LIMBS = [
  [0, 0.12, 0.5],
  [0.3, 0.8, 0.52],
  [2.4, 0.7, 0.48],
  [4.4, 0.85, 0.44],
] as const;

/**
 * A bare tree's branches, joined into one shape that sits on the top of its trunk: a few limbs no thinner than the
 * models' thinnest member, each forking into two twigs.
 */
export const bareCrown = () =>
  joined('bare-crown', [
    ...LIMBS.flatMap(([turn, lean, len], i) => {
      // the leader is the thickest, carrying on from the trunk
      const limb = branch(new THREE.Vector3(0, -0.1, 0), turn, lean, len, i === 0 ? 0.05 : 0.04);
      const twigs = [-0.55, 0.55].map((fork) =>
        branch(limb.end, turn + fork, Math.max(0.25, lean - 0.25) + Math.abs(fork) * 0.3, 0.26, 0.03),
      );
      return [limb.piece, ...twigs.map((t) => t.piece)];
    }),
  ]);
/**
 * The soft blobs of leaves on every tree, smooth like the items and people: where each sits above the top of the
 * trunk, and how big it is.
 */
const BLOBS = [
  [0, 0.45, 0, 0.64],
  [0.36, 0.14, 0.12, 0.44],
  [-0.3, 0.18, -0.12, 0.46],
] as const;

/** How tall a tree's trunk is. */
export const trunkHeight = (seed: number) => 0.9 + (seed % 5) * 0.12;

/** Which of the colors a tree's leaves are, apart from its height, which also goes by fives. */
const leafColorOf = (seed: number) => Math.floor(seed / 5) % LEAF_COLORS.length;

/** An instanced mesh holding one copy of a shape for each of these placements, casting and catching shadows. */
function instanced(geo: THREE.BufferGeometry, material: THREE.Material, placements: THREE.Matrix4[]) {
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  placements.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Every tree on the lawn, drawn together: one mesh for the trunks, one for each color of leaves and one for the bare
 * branches of winter, rather than four meshes per tree. A hundred trees otherwise take two thirds of a frame's draw calls.
 */
export function buildForest(spots: readonly TreeSpot[]): THREE.Group {
  const trunks: THREE.Matrix4[] = [];
  const leaves: THREE.Matrix4[][] = LEAF_COLORS.map(() => []);
  const crowns: THREE.Matrix4[] = [];
  const none = new THREE.Quaternion();
  for (const { x, z, seed } of spots) {
    const h = trunkHeight(seed);
    // the trunk is a cylinder one unit tall, stretched to this tree's height
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), none, new THREE.Vector3(1, h, 1)));
    for (const [bx, by, bz, r] of BLOBS) {
      // each blob a little squashed, like a ball of clay set down
      const blob = new THREE.Matrix4().compose(
        new THREE.Vector3(x + bx, h + by, z + bz),
        none,
        new THREE.Vector3(r, r * 0.9, r),
      );
      leaves[leafColorOf(seed)]?.push(blob);
    }
    // the bare branches turned a different way on each tree, so no two neighbours look alike
    const turned = new THREE.Quaternion().setFromAxisAngle(UP, seed * 2.4);
    crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), turned, new THREE.Vector3(1, 1, 1)));
  }
  const forest = new THREE.Group();
  forest.add(instanced(cyl(0.09, 0.13, 1, 16), mat(BARK, 0.9), trunks));
  LEAVES.forEach((material, i) => {
    const blobs = leaves[i] ?? [];
    if (blobs.length) forest.add(instanced(blob(1), material, blobs));
  });
  if (crowns.length) forest.add(instanced(bareCrown(), BRANCHES, crowns));
  return forest;
}
