// Trees for the lawn, in leaf for most of the year: fresh in spring, full in summer, scarlet, orange and gold in autumn,
// and in winter bare, down to a few empty branches.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Season } from '../../core/sim/twists';
import { must } from '../../core/util';
import { owned } from '../disposal';
import { hash } from '../shared';
import { blob, cached, cyl, mat, type Piece } from './parts';

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
 * A capsule for a limb or bough this thick, with far fewer sides than the models' own: a branch is only a few pixels
 * across, and every broadleaved tree has a few dozen, so the models' capsules took a winter frame from about 170,000
 * triangles to 1,200,000. The thinner the branch, the fewer its sides.
 */
const capsuleOf = (r: number, sides: number) => (len: number) =>
  cached(`bare-limb|${r}|${len}|${sides}`, () => new THREE.CapsuleGeometry(r, len, 1, sides));

/** The shape of each order of branch: a limb leaving the trunk, the outer length of it, and the boughs it forks into. */
const LIMB = capsuleOf(0.05, 6);
const LIMB_OUTER = capsuleOf(0.04, 5);
const BOUGH = capsuleOf(0.032, 4);
/**
 * A twig: a thin three-sided spike, tapering to its tip like a real one, its open end hidden in the round end of its
 * bough. A capsule would take three times the triangles for a pixel or two of difference.
 */
const TWIG = (len: number) => cached(`bare-twig|${len}`, () => new THREE.ConeGeometry(0.022, len, 3, 1, true));

/** A branch as it grows: where it starts, which way round the trunk it heads, and how far it leans from upright. */
interface Shoot {
  from: THREE.Vector3;
  turn: number;
  lean: number;
}

/**
 * A branch growing from a point, leaning `lean` from upright toward `turn` round the trunk, `len` long: its shape
 * laid along it, and the point where it ends. Lengths are rounded to the centimeter, so branches of nearly the same
 * length share a shape.
 */
function branch({ from, turn, lean }: Shoot, len: number, shape: (len: number) => THREE.BufferGeometry) {
  const l = Math.round(len * 100) / 100;
  const along = new THREE.Vector3(Math.sin(lean) * Math.cos(turn), Math.cos(lean), Math.sin(lean) * Math.sin(turn));
  const mid = from.clone().addScaledVector(along, l / 2);
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, along));
  const piece: Piece = [shape(l), mid.x, mid.y, mid.z, e.x, e.y, e.z];
  return { piece, end: from.clone().addScaledVector(along, l) };
}

/**
 * How a kind of broadleaved tree holds its bare branches, from the top of its trunk. Each limb grows in two lengths,
 * bending between them, and forks at its end into boughs, each tipped with twigs; one more bough leaves at the bend.
 */
interface Habit {
  /** How many limbs spread round the trunk. */
  limbs: number;
  /** How long a leader carrying on up the middle is, or 0 for none. */
  leader: number;
  /** How far the limbs lean from upright, least and most, in radians. */
  lean: readonly [number, number];
  /** How much the limbs' outer lengths lean less than the inner, turning up (or, below 0, further out). */
  bend: number;
  /** How long a limb is, both its lengths together, least and most. */
  reach: readonly [number, number];
  /** How high up the trunk and leader the limbs leave, lowest and highest, above the top of the trunk. */
  rise: readonly [number, number];
}

/**
 * The habits a bare tree grows in, so a park is not one tree over and over: each about as tall and wide as the tree's
 * leaves in summer, which reach about a meter above the trunk and eight tenths out.
 */
const HABITS: readonly Habit[] = [
  // spreading, like an oak: low limbs reaching wide before they turn up
  { limbs: 5, leader: 0, lean: [0.85, 1.1], bend: 0.45, reach: [0.62, 0.76], rise: [-0.1, 0.05] },
  // a vase, like an elm: limbs rising steeply from one point and fanning out
  { limbs: 5, leader: 0, lean: [0.3, 0.5], bend: -0.2, reach: [0.72, 0.86], rise: [-0.1, -0.05] },
  // rounded, like a maple: a leader up the middle, limbs all round it
  { limbs: 4, leader: 0.5, lean: [0.6, 0.85], bend: 0.25, reach: [0.55, 0.68], rise: [-0.05, 0.2] },
  // tall, like a linden: a long leader, with shorter limbs up it
  { limbs: 4, leader: 0.75, lean: [0.55, 0.8], bend: 0.2, reach: [0.42, 0.56], rise: [0, 0.45] },
];

/** The spreading habit, for trees pruned to it, such as the orchards' apple trees. */
export const SPREADING = 0;

/** The habit a tree grows in, apart from its height and the color of its leaves, which go by its seed's ones and fives. */
export const habitOf = (seed: number) => Math.floor(seed / 25) % HABITS.length;

/**
 * The branches of a bare tree in one of the habits: its limbs, no thinner than the models' thinnest member, and apart
 * from them the boughs and twigs that are its fine detail. The same every time, from the habit's own stream of random
 * numbers.
 */
function crownPieces(habit: number): { limbs: Piece[]; fine: Piece[] } {
  const h = must(HABITS[habit % HABITS.length], `habit ${habit}`);
  let n = 0;
  /** The habit's next random number, from 0 to 1. */
  const next = () => hash(habit * 13.7 + 1, n++);
  /** A random number between these two. */
  const between = ([lo, hi]: readonly [number, number]) => lo + (hi - lo) * next();
  // the trunk carried on up into the limbs, tapering, so its flat top does not show between them like a sawn stump
  const limbs: Piece[] = [[cached('bare-collar', () => new THREE.CylinderGeometry(0.055, 0.1, 0.24, 8)), 0, 0.04, 0]];
  const fine: Piece[] = [];
  /** Two twigs at the end of a bough, splayed either side of it. */
  const twigs = (tip: Shoot) => {
    for (const side of [-1, 1]) {
      const twig = { ...tip, turn: tip.turn + side * (0.35 + 0.3 * next()), lean: tip.lean + (next() - 0.6) * 0.5 };
      fine.push(branch(twig, 0.14 + 0.08 * next(), TWIG).piece);
    }
  };
  /** A bough from a point on a limb, heading off it, and its twigs. */
  const bough = (shoot: Shoot, len: number) => {
    const b = branch(shoot, len, BOUGH);
    fine.push(b.piece);
    twigs({ from: b.end, turn: shoot.turn, lean: shoot.lean });
  };
  const leaderTop = new THREE.Vector3(0, -0.12 + h.leader, 0);
  if (h.leader > 0) {
    const leader = branch({ from: new THREE.Vector3(0, -0.12, 0), turn: 0, lean: 0.06 }, h.leader + 0.04, LIMB);
    limbs.push(leader.piece);
    const turn = next() * Math.PI * 2;
    for (const side of [-1, 1]) bough({ from: leader.end, turn: turn + side * 1.2, lean: 0.35 }, 0.34);
  }
  for (let i = 0; i < h.limbs; i++) {
    // spaced round the trunk, each a little off where an even spacing would put it
    const turn = ((i + (next() - 0.5) * 0.6) / h.limbs) * Math.PI * 2;
    const lean = between(h.lean);
    const reach = between(h.reach);
    const from = new THREE.Vector3(0, Math.min(between(h.rise), leaderTop.y - 0.1), 0);
    const inner = branch({ from, turn, lean }, reach * 0.55, LIMB);
    const outerTurn = turn + (next() - 0.5) * 0.5;
    const outerLean = Math.max(0.12, lean - h.bend);
    const outer = branch({ from: inner.end, turn: outerTurn, lean: outerLean }, reach * 0.45, LIMB_OUTER);
    limbs.push(inner.piece, outer.piece);
    // one bough out from the bend, to the side the limb turns away from
    const away = outerTurn > turn ? -1 : 1;
    bough({ from: inner.end, turn: turn + away * (0.6 + 0.4 * next()), lean: Math.min(1.25, lean + 0.15) }, 0.3);
    // and the limb forks at its end into two
    for (const side of [-1, 1]) {
      const lean = Math.min(1.2, Math.max(0.15, outerLean + (next() - 0.4) * 0.5));
      bough({ from: outer.end, turn: outerTurn + side * (0.4 + 0.4 * next()), lean }, 0.24 + 0.1 * next());
    }
  }
  return { limbs, fine };
}

/**
 * A bare tree's limbs, or its boughs and twigs, in one of the habits, as one shape for the top of its trunk: indexed,
 * and with no texture coordinates, which bark has no use for, so a forest's many copies take what memory they must.
 */
export const bareCrown = (habit: number, part: 'limbs' | 'fine') =>
  cached(`bare-crown-${habit}-${part}`, () => {
    const placed = crownPieces(habit)[part].map(([shape, x, y, z, rx = 0, ry = 0, rz = 0]) =>
      shape
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
            new THREE.Vector3(1, 1, 1),
          ),
        ),
    );
    const shape = must(mergeGeometries(placed), `the bare ${part} of habit ${habit}`);
    shape.deleteAttribute('uv');
    return shape;
  });

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
 * Where a tree's bare branches go on the top of its trunk, at `y`: turned its own way, a size of its own and leaning a
 * little, so that no two trees of a habit look alike. `size` scales the whole, for smaller kinds of tree.
 */
export function crownPlacement(x: number, y: number, z: number, seed: number, size = 1) {
  const k = size * (0.88 + 0.3 * hash(seed, 3));
  const tilt = new THREE.Euler((hash(seed, 4) - 0.5) * 0.16, seed * 2.4, (hash(seed, 5) - 0.5) * 0.16, 'YXZ');
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(tilt),
    new THREE.Vector3(k, k * (0.9 + 0.2 * hash(seed, 6)), k),
  );
}

/**
 * The bare branches of every tree in a wood, each in its habit and its own place, baked into two shapes: the limbs,
 * casting shadows on the lawn, and the boughs and twigs, casting none. So winter costs a wood three draw calls however
 * many habits it grows in, where a mesh for each habit took twelve; and every branch's shadow made a winter frame a
 * sixth slower than a summer one under software rendering, while the limbs' alone cost nothing over summer and still
 * throw the shape of a bare tree.
 */
export function bareCrowns(crowns: readonly { habit: number; placement: THREE.Matrix4 }[]): THREE.Mesh[] {
  if (!crowns.length) return [];
  return (['limbs', 'fine'] as const).map((part) => {
    const copies = crowns.map(({ habit, placement }) => bareCrown(habit, part).clone().applyMatrix4(placement));
    const mesh = new THREE.Mesh(owned(must(mergeGeometries(copies), `a wood's bare ${part}`)), BRANCHES);
    mesh.castShadow = part === 'limbs';
    mesh.receiveShadow = true;
    return mesh;
  });
}

/**
 * Every tree on the lawn, drawn together: one mesh for the trunks, one for each color of leaves and two for the bare
 * branches of winter, rather than four meshes per tree. A hundred trees otherwise take two thirds of a frame's draw calls.
 */
export function buildForest(spots: readonly TreeSpot[]): THREE.Group {
  const trunks: THREE.Matrix4[] = [];
  const leaves: THREE.Matrix4[][] = LEAF_COLORS.map(() => []);
  const crowns: { habit: number; placement: THREE.Matrix4 }[] = [];
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
    crowns.push({ habit: habitOf(seed), placement: crownPlacement(x, h, z, seed) });
  }
  const forest = new THREE.Group();
  forest.add(instanced(cyl(0.09, 0.13, 1, 16), mat(BARK, 0.9), trunks));
  LEAVES.forEach((material, i) => {
    const blobs = leaves[i] ?? [];
    if (blobs.length) forest.add(instanced(blob(1), material, blobs));
  });
  for (const mesh of bareCrowns(crowns)) forest.add(mesh);
  return forest;
}
