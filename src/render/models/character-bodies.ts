// The symptoms a guest wears whole, so the ailment reads from across the room at the game's usual distance: someone
// bottled up stands in a big green bottle, corked over their head, someone glass half empty in a tall tumbler with the
// water up to their waist, someone spiritually dehydrated is a cactus potted from the waist down, and someone with
// blocked qi has a storm going on round their chest, someone scattered comes apart, head and body floating loose of
// each other, someone knotted up is tied up in rope, someone chair-shaped has an office chair stuck to them, and
// someone lobstered has a lobster's claws and feelers. The face still shows, through the glass or on the cactus, so
// how they feel does too, and it all goes in the puff of the cure.

import * as THREE from 'three';

import type { Visual } from '../../core/data';
import { owned } from '../disposal';
import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, spin, upright } from './character-heads';
import { cached, capsule, cyl, joined, mat, type Piece, put, rbox, sph, torus, tube } from './parts';

/**
 * The bottle's green glass, one for every bottled guest. It is see-through, so the crowd cannot draw it in a batch and
 * it draws itself; it is shared, so it is never freed.
 */
const GLASS = new THREE.MeshStandardMaterial({
  color: 0x3f9a5c,
  transparent: true,
  opacity: 0.45,
  roughness: 0.1,
  depthWrite: false,
});

/** How far up the body the middle of the bottle is, which it shrinks toward with the cure. */
const MIDDLE = 1;

/** A tumbler's clear glass and the water in it, one of each for every guest who has them, drawn as the bottle is. */
const CLEAR = new THREE.MeshStandardMaterial({
  color: 0xdcecf2,
  transparent: true,
  opacity: 0.32,
  roughness: 0.05,
  depthWrite: false,
});
const WATER = new THREE.MeshStandardMaterial({
  color: 0x4f9fd6,
  transparent: true,
  opacity: 0.55,
  roughness: 0.1,
  depthWrite: false,
});
/** The water's surface, at the waist. */
const SURFACE = 0x9fd0ee;

/** How far up the body the middle of the tumbler is, which it shrinks toward with the cure. */
const TUMBLER_MIDDLE = 0.95;

/**
 * Bottled up: the whole person in a big green bottle, the cork in its neck above their head and a cream label with a
 * red stripe round the middle, their legs out of the bottom to walk on.
 */
function bottle(rig: CharRig) {
  const bottle = new THREE.Group();
  /** A height up the body, as a height in the bottle, whose middle is at `MIDDLE`. */
  const at = (y: number) => y - MIDDLE;
  put(bottle, cyl(0.31, 0.31, 1.05, 24), GLASS, 0, at(0.78), 0);
  put(bottle, cyl(0.13, 0.31, 0.16, 24), GLASS, 0, at(1.38), 0);
  put(bottle, cyl(0.13, 0.13, 0.15, 20), GLASS, 0, at(1.535), 0);
  put(bottle, torus(0.135, 0.022), GLASS, 0, at(1.61), 0).rotation.x = Math.PI / 2;
  put(bottle, cyl(0.115, 0.1, 0.16, 14), mat(0xc9a56a, 0.95), 0, at(1.66), 0);
  put(bottle, cyl(0.315, 0.315, 0.3, 24), mat(0xf2e6c8, 0.8), 0, at(0.62), 0);
  put(bottle, cyl(0.317, 0.317, 0.05, 24), mat(0xd9362f, 0.6), 0, at(0.68), 0);
  bottle.position.y = MIDDLE;
  props(rig, bottle);
  rig.body.add(bottle);
}

/**
 * Glass half empty: the whole person standing in a tall clear tumbler, the water up to the waist and the top half
 * empty, their own head and face dry in the empty half and their legs out of the bottom.
 */
function tumbler(rig: CharRig) {
  const glass = new THREE.Group();
  /** A height up the body, as a height in the tumbler, whose middle is at `TUMBLER_MIDDLE`. */
  const at = (y: number) => y - TUMBLER_MIDDLE;
  put(glass, cyl(0.34, 0.29, 1.3, 28), CLEAR, 0, at(0.92), 0);
  put(glass, torus(0.34, 0.018), CLEAR, 0, at(1.57), 0).rotation.x = Math.PI / 2;
  put(glass, cyl(0.29, 0.29, 0.06, 28), CLEAR, 0, at(0.3), 0);
  put(glass, cyl(0.31, 0.285, 0.55, 28), WATER, 0, at(0.6), 0);
  put(glass, cyl(0.312, 0.312, 0.012, 28), mat(SURFACE, 0.1), 0, at(0.88), 0);
  glass.position.y = TUMBLER_MIDDLE;
  props(rig, glass);
  rig.body.add(glass);
}

/** A cactus's green, its spines, its flower and the flower's middle, and its pot and the soil in it. */
const CACTUS = 0x4f9a48;
const SPINE = 0xf4f1ea;
const FLOWER = 0xe8679a;
const POLLEN = 0xf2c14e;
const POT = 0xb5523e;
const SOIL = 0x6b4a2a;

/** A ribbed column of cactus, `r` across and `len` long between its rounded ends, with eight ribs. */
const ribbed = (r: number, len: number) =>
  cached(`cactus ${r}|${len}`, () => {
    const geo = new THREE.CapsuleGeometry(r, len, 8, 32);
    const at = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < at.count; i++) {
      v.fromBufferAttribute(at, i);
      const rib = 1 + 0.09 * Math.cos(8 * Math.atan2(v.z, v.x));
      at.setXYZ(i, v.x * rib, v.y, v.z * rib);
    }
    geo.computeVertexNormals();
    return geo;
  });

/** Little white spines on a column `r` across, in rows up its ribs from `from` to `to`, as one shape. */
function spines(r: number, from: number, to: number) {
  const pieces: Piece[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const out = r * 1.09 + 0.012;
    for (let y = from; y <= to; y += 0.09)
      pieces.push([
        cyl(0.003, 0.006, 0.04, 4),
        Math.cos(a) * out,
        y + (k % 2) * 0.04,
        Math.sin(a) * out,
        0,
        -a,
        -Math.PI / 2,
      ]);
  }
  return joined(`spines ${r}|${from}|${to}`, pieces);
}

/**
 * Spiritually dehydrated: the head a ribbed cactus, prickly, an arm bent up off one side and a pink flower on top, the
 * face on its front; the shirt and sleeves gone cactus green, and a terracotta pot round them from the waist down, the
 * feet out of the bottom to shuffle along on (see `pose`).
 */
function cactus(rig: CharRig) {
  const { head } = rig;
  hideUntilCured(rig, [rig.headMesh, ...named(head, 'hair', 'moustache', 'beard', 'glasses')]);
  const top = new THREE.Group();
  const green = mat(CACTUS, 0.6);
  put(top, ribbed(0.19, 0.22), green, 0, 0.06, 0);
  // an arm off one side, bent up like a saguaro's
  put(top, capsule(0.065, 0.08), green, 0.22, 0.02, 0).rotation.z = Math.PI / 2;
  put(top, capsule(0.06, 0.12), green, 0.28, 0.1, 0);
  put(top, spines(0.19, -0.1, 0.22), mat(SPINE, 0.5), 0, 0.06, 0);
  const flower = mat(FLOWER, 0.5);
  for (const [x, z] of [
    [0, 0],
    [0.045, 0.02],
    [-0.04, 0.025],
    [0.01, -0.045],
  ] as const)
    put(top, sph(0.04, 10), flower, x, 0.36, z).scale.y = 0.6;
  put(top, sph(0.025, 8), mat(POLLEN, 0.5), 0, 0.38, 0);
  faceOut(rig, { eyes: 0.025, brows: 0.02, mouth: 0.03 });
  head.add(top);
  // the shirt and its sleeves gone green, put back with the head
  const shirt = (rig.torso.getObjectByName('shirt') as THREE.Mesh | undefined)?.material;
  const leaf = mat(CACTUS, 0.7);
  rig.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!shirt || m.material !== shirt) return;
    m.material = leaf;
    (rig.restore ??= []).push(() => (m.material = shirt));
  });
  const pot = new THREE.Group();
  const clay = mat(POT, 0.8);
  put(pot, cyl(0.27, 0.2, 0.38, 28), clay, 0, 0.25, 0);
  put(pot, cyl(0.3, 0.3, 0.07, 28), clay, 0, 0.46, 0);
  put(pot, cyl(0.25, 0.25, 0.02, 28), mat(SOIL, 0.9), 0, 0.495, 0);
  props(rig, top, pot);
  rig.body.add(pot);
}

/** A storm cloud's gray and its darker gray, the pale glow of lightning in it, the bolts, and the rain. */
const STORM = 0x7d8894;
const STORM_DARK = 0x5d6672;
const LIGHTNING = 0xfff4c2;
const BOLT = 0xf2c14e;
const RAIN = 0x6fb5e0;

/** A zigzag of lightning, pointing down, as one shape. */
const bolt = () =>
  joined('bolt', [
    [rbox(0.04, 0.12, 0.02, 0.005), 0, 0.06, 0, 0, 0, 0.45],
    [rbox(0.04, 0.12, 0.02, 0.005), 0.01, -0.03, 0, 0, 0, -0.45],
    [rbox(0.035, 0.1, 0.02, 0.005), 0, -0.11, 0, 0, 0, 0.45],
  ]);

/**
 * A storm cloud's puffs in a ring round the chest, the light ones or the dark, each as one shape: every third of ten
 * round the ring dark, and two more light ones over the front.
 */
const puffs = (dark: boolean) =>
  joined(`storm puffs ${dark}`, [
    ...Array.from({ length: 10 }, (_, i) => i)
      .filter((i) => (i % 3 === 0) === dark)
      .map((i) => {
        const a = (i / 10) * Math.PI * 2;
        return [sph(i % 2 ? 0.12 : 0.14, 14), Math.cos(a) * 0.25, (i % 2) * 0.05, Math.sin(a) * 0.2] as const;
      }),
    ...(dark
      ? []
      : ([
          [sph(0.13, 14), 0.05, 0.13, 0.16],
          [sph(0.11, 14), -0.1, 0.12, 0.17],
        ] as const)),
  ]);

/**
 * Blocked qi: the weather system backed up at the sternum, as the ailment says, a gray storm cloud round the chest
 * churning slowly round them, rain falling from under it, and every few seconds lightning flashing in it, a bolt out of
 * the front or one side and the whole cloud lit pale from inside (see `pose`).
 */
function storm(rig: CharRig) {
  const weather = new THREE.Group();
  // the puffs' own materials, as they glow with the lightning when this guest's storm flashes
  const lit = owned(new THREE.MeshStandardMaterial({ color: STORM, roughness: 0.95, emissive: LIGHTNING }));
  const litDark = owned(new THREE.MeshStandardMaterial({ color: STORM_DARK, roughness: 0.95, emissive: LIGHTNING }));
  const ring = new THREE.Group();
  put(ring, puffs(false), lit, 0, 0, 0);
  put(ring, puffs(true), litDark, 0, 0, 0);
  weather.add(ring);
  spin(rig, ring, 0.35);
  const flash = owned(
    new THREE.MeshStandardMaterial({ color: BOLT, roughness: 0.4, emissive: BOLT, emissiveIntensity: 1.2 }),
  );
  const bolts = (
    [
      [0.02, 0.3, 0],
      [0.32, 0.05, Math.PI / 2],
      [-0.32, 0.05, -Math.PI / 2],
    ] as const
  ).map(([x, z, ry]) => {
    const b = put(weather, bolt(), flash, x, -0.14, z);
    b.rotation.set(-0.3, ry, 0);
    // dark until it flashes
    b.visible = false;
    return b;
  });
  rig.flash = { bolts, glow: [lit, litDark] };
  // the rain, falling as drops off a wet blanket do
  rig.drips = new THREE.Group();
  const rain = mat(RAIN, 0.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const drop = put(rig.drips, cyl(0.008, 0.008, 0.07, 4), rain, Math.cos(a) * 0.24, 0.3, Math.sin(a) * 0.19);
    drop.userData.y = 0.3;
  }
  weather.position.y = 0.42;
  props(rig, weather, rig.drips);
  rig.torso.add(weather, rig.drips);
}

/**
 * Float a part of someone loose of where it belongs, by `apart` meters to the side, up and forward, and set it drifting
 * up and down `drift` meters and round in a slow circle `circle` meters across, from `phase` round it (see `pose`). The
 * cure eases it back over the puff, and it is left to the rest of the pose from then on (see `endCure`).
 */
function floatApart(
  rig: CharRig,
  part: THREE.Object3D,
  apart: readonly [aside: number, up: number, forward: number],
  drift: number,
  circle: number,
  phase: number,
) {
  part.userData.home = part.position.clone();
  part.userData.apart = new THREE.Vector3(...apart);
  part.userData.drift = drift;
  part.userData.circle = circle;
  part.userData.phase = phase;
  part.position.add(part.userData.apart as THREE.Vector3);
  (rig.spin ??= []).push(part);
}

/**
 * Scattered: in pieces, the head floating well over the shoulders and the body over the legs, each pushed off to one
 * side and forward, drifting up and down and round in slow circles of their own, the head one way as the body goes the
 * other, so daylight shows between them from above; the shards of them still drifting round. Lying down they come
 * together, as the shards are put away then.
 */
function inPieces(rig: CharRig) {
  floatApart(rig, rig.head, [0.07, 0.4, 0.04], 0.03, 0.08, 0);
  floatApart(rig, rig.torso, [-0.05, 0.26, 0.02], 0.025, 0.05, Math.PI);
}

const ROPE = 0xc8a46a;

/**
 * Knotted up: tied up in rope, three coils round the chest and arms and a big knot on the front, the two ends hanging
 * from it.
 */
function rope(rig: CharRig) {
  const tan = mat(ROPE, 0.9);
  const coils = put(
    rig.torso,
    joined('rope coils', [
      [torus(0.32, 0.028), 0, 0.42, 0, Math.PI / 2 + 0.12, 0, 0],
      [torus(0.32, 0.028), 0, 0.3, 0, Math.PI / 2 - 0.1, 0, 0],
      [torus(0.32, 0.028), 0, 0.18, 0, Math.PI / 2 + 0.06, 0, 0],
    ]),
    tan,
    0,
    0,
    0,
  );
  coils.scale.set(1, 1, 0.62);
  const knot = put(
    rig.torso,
    joined('rope knot', [
      [cached('rope knot', () => new THREE.TorusKnotGeometry(0.075, 0.03, 64, 8)), 0, 0, 0],
      [cyl(0.026, 0.026, 0.22, 8), -0.04, -0.1, 0, 0, 0, 0.15],
      [cyl(0.026, 0.026, 0.18, 8), 0.06, -0.08, 0, 0, 0, -0.2],
    ]),
    tan,
    0.02,
    0.3,
    0.21,
  );
  props(rig, coils, knot);
}

/**
 * Chair-shaped: a whole office chair stuck to them, the seat on their behind, the back up theirs and the arms at their
 * sides, carried about on their own bent legs (see `pose`). Put away while they sit or lie on something real, which it
 * would go through.
 */
function officeChair(rig: CharRig) {
  const chair = put(
    rig.body,
    joined('office chair top', [
      [rbox(0.46, 0.08, 0.44, 0.04), 0, 0, 0],
      [rbox(0.44, 0.5, 0.08, 0.04), 0, 0.3, -0.23, -0.12, 0, 0],
      [rbox(0.05, 0.05, 0.26, 0.02), -0.25, 0.17, -0.03],
      [rbox(0.05, 0.05, 0.26, 0.02), 0.25, 0.17, -0.03],
      [rbox(0.04, 0.17, 0.04, 0.01), -0.25, 0.08, -0.12],
      [rbox(0.04, 0.17, 0.04, 0.01), 0.25, 0.08, -0.12],
    ]),
    mat(0x2d3a52, 0.8),
    0,
    0.36,
    -0.05,
  );
  chair.userData.standing = true;
  (rig.spin ??= []).push(chair);
  props(rig, chair);
}

const LOBSTER = 0xd9452f;
const LOBSTER_DARK = 0xa8321f;

/**
 * A lobster's crusher claw, as one shape pointing down along -y from the wrist: a fat oval palm, bumpy along its top,
 * and two curved, tapering fingers with a gap between, the lower one shorter.
 */
const crusher = () =>
  joined('lobster crusher', [
    [cyl(0.04, 0.05, 0.08, 10), 0, 0.02, 0],
    [cached('crusher palm', () => new THREE.SphereGeometry(0.075, 16, 12).scale(1.15, 1.75, 0.8)), 0, -0.13, 0],
    [sph(0.022, 6), 0.06, -0.09, 0.04],
    [sph(0.02, 6), 0.075, -0.15, 0.03],
    [sph(0.018, 6), 0.065, -0.2, 0.035],
    // the fixed finger, on the outside, long
    [cyl(0.045, 0.032, 0.11, 10), 0.045, -0.3, 0, 0, 0, 0.16],
    [cyl(0.032, 0.006, 0.12, 10), 0.012, -0.41, 0, 0, 0, 0.45],
    // the moving finger, on the inside, shorter, opened a little
    [cyl(0.04, 0.028, 0.09, 10), -0.05, -0.28, 0, 0, 0, -0.32],
    [cyl(0.028, 0.006, 0.1, 10), -0.065, -0.37, 0, 0, 0, 0.12],
  ]);

/** Where someone's hand is on its forearm. */
function handAt(fore: THREE.Object3D) {
  const hand = fore.getObjectByName('hand') as THREE.Mesh | undefined;
  if (!hand) return new THREE.Vector3(0, -0.2, 0);
  hand.geometry.computeBoundingBox();
  const box = hand.geometry.boundingBox ?? new THREE.Box3();
  return box.getCenter(new THREE.Vector3()).add(hand.position);
}

/** A lobster's claw on the hand of a forearm, the hand hidden behind it. */
function claw(rig: CharRig, fore: THREE.Object3D) {
  const hand = fore.getObjectByName('hand');
  if (hand) hideUntilCured(rig, [hand]);
  const at = handAt(fore);
  return put(fore, crusher(), mat(LOBSTER, 0.45), at.x, at.y + 0.04, at.z);
}

/** A lobster's long feeler out of the forehead on one side, sweeping up, out and back over the head, thinning to a tip. */
function feeler(side: number): readonly (readonly [number, number, number])[] {
  return [
    [side * 0.05, 0.14, 0.17],
    [side * 0.1, 0.3, 0.22],
    [side * 0.2, 0.48, 0.14],
    [side * 0.32, 0.58, -0.08],
    [side * 0.42, 0.58, -0.36],
    [side * 0.5, 0.48, -0.62],
  ];
}

/**
 * Lobstered: lobster red behind the sunglasses (see `buildCharacter`), a big crusher claw for each hand, and two long
 * feelers out of the forehead sweeping up and back over the head as a lobster's do, thick at the root and thin at the
 * tip, with a pair of short ones out front. The feelers are put away while they lie down, as they would sweep back
 * through what they lie on.
 */
function lobster(rig: CharRig) {
  const red = mat(LOBSTER, 0.45);
  const dark = mat(LOBSTER_DARK, 0.5);
  const feelers = new THREE.Group();
  for (const side of [-1, 1]) {
    const path = feeler(side);
    // thick at the root and thin to the tip: the first stretch fatter, the rest fine
    put(feelers, tube(`lobster feeler root ${side}`, path.slice(0, 3), 0.014), red, 0, 0, 0);
    put(feelers, tube(`lobster feeler ${side}`, path.slice(1), 0.007), dark, 0, 0, 0);
    put(
      feelers,
      tube(
        `lobster feelerette ${side}`,
        [
          [side * 0.03, 0.12, 0.19],
          [side * 0.07, 0.2, 0.28],
          [side * 0.1, 0.22, 0.36],
        ],
        0.008,
      ),
      dark,
      0,
      0,
      0,
    );
  }
  upright(rig, feelers);
  props(rig, feelers, claw(rig, rig.joints.foreL), claw(rig, rig.joints.foreR));
  rig.head.add(feelers);
}

/** Draw a symptom the guest wears whole, if it is one. */
export function bodySymptom(rig: CharRig, visual: Visual | undefined) {
  if (visual === 'cork') bottle(rig);
  else if (visual === 'glass') tumbler(rig);
  else if (visual === 'cactus') cactus(rig);
  else if (visual === 'storm') storm(rig);
  else if (visual === 'shards') inPieces(rig);
  else if (visual === 'knot') rope(rig);
  else if (visual === 'chairshape') officeChair(rig);
  else if (visual === 'sunburn') lobster(rig);
}
