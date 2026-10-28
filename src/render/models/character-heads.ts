// The symptoms that take the place of a guest's head, so the ailment reads from across the room at the game's usual
// distance rather than as a speck over the head: a scrambled noggin's head is an egg with its top knocked off, a flat
// battery's a battery on its side, a stress head's a whistling kettle, a noisy mind's a boombox left on too loud,
// someone who has lost their way has a signpost growing out of the top of theirs, a tension headband's is screwed down
// in a G-clamp, a bad apple's is an apple core, a blue screen's an old monitor, someone with crossed wires has a wall
// plug for a head, its cable wound round and round them, and someone snowed in is in a snow globe, snowed up to the
// nose. The face stays on, so how the guest feels still shows, and the head comes back halfway through the cure.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Visual } from '../../core/data';
import { owned } from '../disposal';
import type { CharRig } from './character';
import { cached, cyl, joined, mat, type Piece, put, rbox, sph, torus, tube } from './parts';

/** Keep a symptom's parts from casting shadows, and note them as the symptom's, to go when the guest is healed. */
export function props(rig: CharRig, ...parts: THREE.Object3D[]) {
  for (const p of parts) {
    p.traverse((o) => (o.castShadow = false));
    rig.props.push(p);
  }
}

/**
 * Set a symptom's part turning about its upright by so much a second, rattling side to side, or pulsing bigger on a
 * beat (see `pose`).
 */
export function spin(rig: CharRig, o: THREE.Object3D, turn: number, rattle = 0, pulse = 0) {
  o.userData.spin = turn;
  o.userData.rattle = rattle;
  o.userData.pulse = pulse;
  (rig.spin ??= []).push(o);
}

/** Hide parts of a person while a symptom stands in for them, to be shown again halfway through the cure. */
export function hideUntilCured(rig: CharRig, parts: THREE.Object3D[]) {
  for (const p of parts) {
    if (!p.visible) continue;
    p.visible = false;
    (rig.restore ??= []).push(() => (p.visible = true));
  }
}

/** The parts of a head with these names: its hair, moustache and beard, say. */
export const named = (head: THREE.Object3D, ...names: string[]) => head.children.filter((o) => names.includes(o.name));

/** Swell the head while the symptom lasts, across and up, to go down again with the cure. */
export function swell(rig: CharRig, across: number, up: number) {
  rig.swell = [across, up];
  rig.head.scale.set(across / rig.wide, up, across / rig.wide);
}

/** Move the face forward, part by part, to sit on whatever stands in for the head, and back with the cure. */
export function faceOut(rig: CharRig, by: { eyes: number; brows: number; mouth: number }) {
  const { face } = rig;
  const parts: [THREE.Object3D, number][] = [
    [face.eyes, by.eyes],
    [face.glints, by.eyes],
    [face.brows, by.brows],
    [face.mouth, by.mouth],
  ];
  for (const [part, dz] of parts) part.position.z += dz;
  (rig.restore ??= []).push(() => {
    for (const [part, dz] of parts) part.position.z -= dz;
  });
}

/**
 * An egg's outline, [radius, height] points from `from` to `to` of the way up: rounder below and narrower above, `h`
 * tall and about `r` across at the widest, its middle at the origin.
 */
function eggOutline(r: number, h: number, from: number, to: number, n = 22): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (from + ((to - from) * i) / n) * 2 - 1;
    points.push(
      new THREE.Vector2(Math.max(0.0005, r * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.13 * t)), (t * h) / 2),
    );
  }
  return points;
}

/** How thick an eggshell is drawn, in meters: enough to show as a rim where it is broken. */
const SHELL_THICK = 0.012;

/**
 * A piece of eggshell from `from` to `to` of the way up an egg `h` tall and `r` across, its broken edges zigzagged `amp`
 * meters up and down: an outer face and an inner one turned inward, in one shape so the crowd can draw it in a batch.
 */
function shell(r: number, h: number, from: number, to: number, amp: number) {
  return cached(`eggshell ${r}|${h}|${from}|${to}|${amp}`, () => {
    const around = 22;
    /** One face of the shell, `radius` across, turned out or in, its broken edges zigzagged. */
    const face = (radius: number, inward: boolean) => {
      const points = eggOutline(radius, h, from, to);
      if (inward) points.reverse();
      const geo = new THREE.LatheGeometry(points, around);
      const at = geo.getAttribute('position');
      const per = points.length;
      // the rows at either broken edge, the first and last of each column round the egg
      for (let j = 0; j <= around; j++) {
        const zig = (j % 2 ? 1 : -1) * amp;
        const [low, high] = inward ? [j * per + per - 1, j * per] : [j * per, j * per + per - 1];
        if (to < 1) at.setY(high, at.getY(high) + zig);
        if (from > 0) at.setY(low, at.getY(low) + zig);
      }
      geo.computeVertexNormals();
      return geo;
    };
    return mergeGeometries([face(r, false), face(r - SHELL_THICK, true)]);
  });
}

const SHELL = 0xf6efe2;
const YOLK = 0xf2a81e;

/** How big the egg is, across and tall, and how far up the head its middle sits. */
const EGG = { r: 0.25, h: 0.62, y: 0.06 } as const;
/** How far up the egg its top was knocked off. */
const BROKEN = 0.72;

/**
 * A scrambled noggin: the head an egg with its top knocked off and the yolk showing, the broken cap floating over it
 * among the stars (bobbing as anything hovering over a head does, and put away lying down), the face on its front.
 * Lying down, the egg rests on the pillow.
 */
function egg(rig: CharRig) {
  const { head } = rig;
  hideUntilCured(rig, [rig.headMesh, ...named(head, 'hair', 'moustache', 'beard', 'glasses')]);
  faceOut(rig, { eyes: 0.05, brows: 0.045, mouth: 0.05 });
  const shellMat = mat(SHELL, 0.5);
  const body = put(head, shell(EGG.r, EGG.h, 0, BROKEN, 0.025), shellMat, 0, EGG.y, 0);
  const pool = put(head, sph(0.15, 18), mat(YOLK, 0.3), 0, 0.19, 0);
  pool.scale.y = 0.3;
  const cap = new THREE.Group();
  // the cap's own middle is the egg's, so it is lifted back down by where its broken edge was
  put(cap, shell(EGG.r, EGG.h, BROKEN, 1, 0.025), shellMat, 0, -0.2, 0);
  cap.position.set(0.04, 0.36, -0.02);
  cap.rotation.set(-0.3, 0, 0.35);
  head.add(cap);
  rig.bob = cap;
  pool.castShadow = false;
  for (const o of cap.children) o.castShadow = false;
  rig.props.push(body, pool);
  swell(rig, 1.08, 1.08);
  rig.pillow = 0.08;
}

/** A battery's casing, its band and its silver end, and the empty cells of its gauge. */
const CASING = 0x2b2f36;
const BAND = 0x8cc63f;
const SILVER = 0xc9ced6;
const EMPTY = 0x4a4f57;
/** The cream of the label the face is on, which would be lost on the dark casing. */
const LABEL = 0xf2e6c8;

/**
 * A flat battery: the head a battery lying on its side, its band to one side and its silver end out of the other, the
 * gauge along the top with three cells empty and the last one blinking red, and the face on a cream label on its front.
 */
function battery(rig: CharRig) {
  const { head } = rig;
  hideUntilCured(rig, [rig.headMesh, ...named(head, 'hair', 'moustache', 'beard', 'glasses')]);
  const cell = new THREE.Group();
  put(cell, rbox(0.46, 0.34, 0.36, 0.08), mat(CASING, 0.45), 0, 0.02, 0);
  put(cell, rbox(0.12, 0.345, 0.365, 0.06), mat(BAND, 0.45), -0.17, 0.02, 0);
  put(cell, rbox(0.04, 0.12, 0.12, 0.02), mat(SILVER, 0.25), 0.25, 0.02, 0);
  // the gauge along the top, where the camera sees it
  const empty = mat(EMPTY, 0.5);
  for (let i = 0; i < 3; i++) put(cell, rbox(0.06, 0.02, 0.1, 0.005), empty, 0.03 + i * 0.07, 0.195, 0);
  rig.blink = owned(new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff3b30, emissiveIntensity: 1 }));
  put(cell, rbox(0.06, 0.02, 0.1, 0.005), rig.blink, -0.04, 0.195, 0);
  put(cell, rbox(0.3, 0.27, 0.012, 0.006), mat(LABEL, 0.7), 0.02, 0, 0.181);
  faceOut(rig, { eyes: 0.006, brows: 0.004, mouth: 0.004 });
  props(rig, cell);
  head.add(cell);
  swell(rig, 1.1, 1.1);
}

/** A kettle's red enamel, its steel lid and handle, its black knob and whistle, and the wood of its grip. */
const ENAMEL = 0xd23c2a;
const STEEL = 0xc9ced6;
const KNOB = 0x1d1f24;
const GRIP = 0xa86f3c;

/**
 * A thin wire handle over the top of the head from one side to the other, `across` between its feet and `up` high,
 * standing in the head's left-right plane: an arch drawn out tall without growing thicker at the top, as a stretched
 * ring would.
 */
const bail = (across: number, up: number, tube: number) =>
  cached(`bail ${across}|${up}|${tube}`, () => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      points.push(new THREE.Vector3((Math.cos(a) * across) / 2, Math.sin(a) * up, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, tube, 8);
  });

/** How a kettle's spout grows out of the side of the head: where its root is, how far it leans out, and how long. */
const SPOUT = { root: [0.03, -0.1], lean: 0.88, length: 0.44 } as const;

/**
 * A stress head: the head itself a whistling kettle in red enamel under a steel lid with a black knob, a tall thin
 * steel handle over it with a wooden grip across the top, and a thick spout growing out of the cheek, the steam
 * puffing out of the black whistle on its tip.
 */
function kettle(rig: CharRig) {
  const { head } = rig;
  hideUntilCured(rig, named(head, 'hair', 'moustache', 'beard', 'glasses'));
  rig.headMesh.material = mat(ENAMEL, 0.35);
  const kettle = new THREE.Group();
  const lid = put(kettle, sph(0.15, 20), mat(STEEL, 0.25), 0, 0.19, 0);
  lid.scale.y = 0.4;
  const black = mat(KNOB, 0.4);
  put(kettle, sph(0.04, 12), black, 0, 0.26, 0);
  // the handle's feet in the head, and the grip across its top
  put(kettle, bail(0.3, 0.25, 0.012), mat(STEEL, 0.3), 0, 0.12, -0.02);
  put(kettle, cyl(0.028, 0.028, 0.13, 14), mat(GRIP, 0.6), 0, 0.37, -0.02).rotation.z = Math.PI / 2;
  // the spout rooted deep in the head, so it grows out of the side without a seam
  const { root, lean, length } = SPOUT;
  const dir = new THREE.Vector2(Math.sin(lean), Math.cos(lean));
  const mid = new THREE.Vector2(...root).addScaledVector(dir, length / 2);
  const tip = new THREE.Vector2(...root).addScaledVector(dir, length);
  put(kettle, cyl(0.032, 0.068, length, 14), mat(ENAMEL, 0.35), mid.x, mid.y, 0.03).rotation.z = -lean;
  put(kettle, cyl(0.04, 0.034, 0.06, 12), black, tip.x, tip.y, 0.03).rotation.z = -lean;
  rig.steam?.position.set(tip.x + dir.x * 0.05, tip.y + dir.y * 0.05, 0.03);
  props(rig, kettle);
  head.add(kettle);
  swell(rig, 1.2, 1.2);
}

/** A note of music, its head, stem and flag, as one shape. */
const note = () =>
  joined('note', [
    [sph(0.035, 10), 0, 0, 0],
    [cyl(0.008, 0.008, 0.12, 6), 0.03, 0.06, 0],
    [rbox(0.05, 0.02, 0.012, 0.004), 0.05, 0.11, 0, 0, 0, -0.5],
  ]);

/** A boombox's black case, its speakers' cones and their middles, its silver, and its red record button. */
const CASE = 0x24272d;
const CONE = 0x2b2f36;
const CONE_MIDDLE = 0x4a4f57;
const BOOMBOX_SILVER = 0xc9ced6;
const RECORD = 0xd9362f;

/** Where a boombox's two speakers are on its front, and how big they are across. */
const SPEAKERS = { x: 0.24, y: -0.03, z: 0.095, r: 0.13 } as const;

/**
 * A boombox's silver, as one shape: the cassette deck the face is on, the rims of its speakers, four of the buttons
 * along the top, and the handle over it on its two posts.
 */
const boomboxSilver = () =>
  joined('boombox silver', [
    [rbox(0.24, 0.28, 0.02, 0.02), 0, -0.03, 0.09],
    ...[-1, 1].map(
      (side) => [torus(SPEAKERS.r, SPEAKERS.r * 0.12), side * SPEAKERS.x, SPEAKERS.y, SPEAKERS.z + 0.012] as const,
    ),
    ...[0, 1, 2, 3].map((i) => [rbox(0.04, 0.025, 0.05, 0.006), -0.1 + i * 0.05, 0.17, 0.02] as const),
    ...[-1, 1].map((side) => [cyl(0.014, 0.014, 0.1, 8), side * 0.26, 0.2, -0.04] as const),
    [cyl(0.016, 0.016, 0.54, 8), 0, 0.25, -0.04, 0, 0, Math.PI / 2],
  ]);

/** An aerial, its rod and the ball on its tip, as one shape. */
const aerial = (length: number) =>
  joined(`aerial ${length}`, [
    [cyl(0.006, 0.01, length, 6), 0, length / 2, 0],
    [sph(0.016, 8), 0, length, 0],
  ]);

/**
 * A noisy mind: the head a black boombox left on too loud, wider than the shoulders, a big speaker either side of the
 * face on its silver cassette deck, buttons along the top and a handle over it. The speakers pump on the beat, the
 * aerial rattles, the whole set shakes a little, and notes of music rise off it as steam off a stress head (see `pose`).
 */
function boombox(rig: CharRig) {
  const { head } = rig;
  hideUntilCured(rig, [rig.headMesh, ...named(head, 'hair', 'moustache', 'beard', 'glasses')]);
  const box = new THREE.Group();
  const silver = mat(BOOMBOX_SILVER, 0.25);
  put(box, rbox(0.74, 0.36, 0.22, 0.05), mat(CASE, 0.45), 0, -0.02, -0.02);
  put(box, boomboxSilver(), silver, 0, 0, 0);
  put(box, rbox(0.04, 0.025, 0.05, 0.006), mat(RECORD, 0.4), 0.1, 0.17, 0.02);
  // the speakers' cones, pumping on the beat
  for (const side of [-1, 1]) {
    const cone = put(
      box,
      cyl(SPEAKERS.r * 0.92, SPEAKERS.r * 0.5, 0.03, 20),
      mat(CONE, 0.7),
      side * SPEAKERS.x,
      SPEAKERS.y,
      SPEAKERS.z,
    );
    cone.rotation.x = Math.PI / 2;
    const middle = put(
      box,
      sph(SPEAKERS.r * 0.3, 12),
      mat(CONE_MIDDLE, 0.5),
      side * SPEAKERS.x,
      SPEAKERS.y,
      SPEAKERS.z + 0.01,
    );
    middle.scale.z = 0.5;
    spin(rig, cone, 0, 0, 0.14);
    spin(rig, middle, 0, 0, 0.3);
  }
  // the aerial out of one end, leaning out and rattling
  const lean = new THREE.Group();
  lean.rotation.z = 0.4;
  const rod = put(lean, aerial(0.46), silver, -0.32, 0.16, -0.06);
  box.add(lean);
  spin(rig, rod, 0, 0.1);
  spin(rig, box, 0, 0.025);
  rig.steam = new THREE.Group();
  const ink = mat(0x1d1f24, 0.4);
  for (let i = 0; i < 3; i++) put(rig.steam, note(), ink, (i - 1) * 0.16, 0, 0);
  rig.steam.position.set(0, 0.27, 0.02);
  box.add(rig.steam);
  faceOut(rig, { eyes: -0.02, brows: -0.025, mouth: -0.02 });
  props(rig, box);
  head.add(box);
  swell(rig, 1.05, 1.05);
}

const SIGN_WOOD = 0x9a6a3c;
const SIGN_BOARD = 0xf2e6c8;
const SIGN_TIP = 0xd9362f;

/** A signpost's arrow board pointing out along its length, the tip a square turned on its corner, as one shape. */
const arrow = () =>
  joined('signpost arrow', [
    [rbox(0.26, 0.07, 0.02, 0.008), 0.15, 0, 0],
    [rbox(0.075, 0.075, 0.02, 0.008), 0.28, 0, 0, 0, 0, Math.PI / 4],
  ]);

/**
 * Lost their way: a wooden signpost growing out of the top of the head, four arrows pointing every which way and a red
 * finial on top, the whole post turning slowly as they try one way after another (see `pose`).
 */
function signpost(rig: CharRig) {
  const post = new THREE.Group();
  put(post, cyl(0.022, 0.026, 0.56, 8), mat(SIGN_WOOD, 0.8), 0, 0.46, 0);
  const board = mat(SIGN_BOARD, 0.7);
  for (const [y, a] of [
    [0.66, 0.3],
    [0.58, 2.1],
    [0.5, 3.6],
    [0.42, 5.0],
  ] as const) {
    const arm = new THREE.Group();
    arm.position.y = y;
    arm.rotation.y = a;
    put(arm, arrow(), board, 0, 0, 0);
    post.add(arm);
  }
  put(post, rbox(0.075, 0.075, 0.024, 0.008), mat(SIGN_TIP, 0.5), 0, 0.74, 0).rotation.z = Math.PI / 4;
  spin(rig, post, 0.5);
  // put away while they lie down, so it never pokes off the end of a table
  upright(rig, post);
  props(rig, post);
  rig.head.add(post);
}

/**
 * Set a symptom's part to be put away while they lie down, where it would poke into what they lie on or off the end of
 * it (see `pose`).
 */
export function upright(rig: CharRig, o: THREE.Object3D) {
  o.userData.upright = true;
  if (!rig.spin?.includes(o)) (rig.spin ??= []).push(o);
}

/**
 * A tension headband: a red G-clamp screwed down on the crown, its frame down the left side of the head, where the
 * game's camera sees it, clear of the face, to rest on the shoulder, the head squashed short and wide under it. Lying
 * down, the frame lies flat beside the head, on what they lie on.
 */
function gClamp(rig: CharRig) {
  const g = new THREE.Group();
  put(
    g,
    joined('g clamp', [
      [rbox(0.42, 0.06, 0.07, 0.02), 0.1, 0.36, 0],
      [rbox(0.07, 0.66, 0.07, 0.02), 0.31, 0.06, 0],
      [rbox(0.16, 0.06, 0.07, 0.02), 0.24, -0.24, 0],
    ]),
    mat(0xd9362f, 0.45),
    0,
    0,
    0,
  );
  put(
    g,
    joined('g clamp screw', [
      [cyl(0.018, 0.018, 0.26, 8), 0, 0.32, 0],
      [cyl(0.07, 0.07, 0.02, 14), 0, 0.195, 0],
      [cyl(0.012, 0.012, 0.26, 8), 0, 0.45, 0, Math.PI / 2, 0, 0],
    ]),
    mat(0x8a96a3, 0.3),
    0,
    0,
    0,
  );
  swell(rig, 1.12, 0.84);
  // the head is squeezed, not the clamp, nor widened by the build the body is
  const s = rig.head.scale;
  g.scale.set(1 / (s.x * rig.wide), 1 / s.y, 1 / (s.z * rig.wide));
  props(rig, g);
  rig.head.add(g);
}

/** A shape turned round its upright from a profile of [radius, height] points, made once under a name and shared. */
const lathe = (key: string, profile: readonly [number, number][]) =>
  cached(
    `lathe ${key}`,
    () =>
      new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r, y)),
        28,
      ),
  );

const APPLE = 0x8a3f26;
const FLESH = 0xe8d4a0;

/** A soft dark patch of rot `r` across, flattened against the skin it sits in. */
const rotSpot = (r: number) => cached(`rot spot ${r}`, () => new THREE.SphereGeometry(r, 10, 8).scale(1, 0.8, 0.25));

/**
 * A patch of rot on the outside of the core at a height, `a` radians round from the front, `out` from its middle and
 * sunk a little into it, its flat face turned outward.
 */
const rotAt = (r: number, a: number, y: number, out: number): Piece => [
  rotSpot(r),
  Math.sin(a) * (out - r * 0.2),
  y,
  Math.cos(a) * (out - r * 0.2),
  0,
  a,
  0,
];

/**
 * A bad apple, rotten to the core as the croquet club says: the head an apple core, red top and bottom and bitten to
 * the pips between, the face on the bitten middle and three flies going round it. Lying down, the core rests on the
 * pillow.
 */
function appleCore(rig: CharRig) {
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);
  const g = new THREE.Group();
  const caps = joined('core caps', [
    [
      lathe('core bottom', [
        [0.001, -0.3],
        [0.12, -0.3],
        [0.22, -0.26],
        [0.26, -0.18],
        [0.24, -0.12],
        [0.15, -0.1],
        [0.001, -0.1],
      ]),
      0,
      0,
      0,
    ],
    [
      // narrower than the bottom and flaring little over the bite, so from above it leaves the face in sight
      lathe('core top', [
        [0.001, 0.11],
        [0.13, 0.11],
        [0.18, 0.13],
        [0.21, 0.18],
        [0.19, 0.24],
        [0.11, 0.28],
        [0.03, 0.26],
        [0.001, 0.26],
      ]),
      0,
      0,
      0,
    ],
  ]);
  put(g, caps, mat(APPLE, 0.5), 0, 0, 0);
  put(
    g,
    lathe('core flesh', [
      [0.17, -0.12],
      [0.13, -0.06],
      [0.12, 0],
      [0.13, 0.06],
      [0.17, 0.12],
    ]),
    mat(FLESH, 0.7),
    0,
    0,
    0,
  );
  // the pips round the sides and back, long like seeds, off the line of the eyes so they never read as more of them,
  // and patches of rot on the red, the same dark brown so they draw with the pips
  const pip = cached('core pip', () => new THREE.SphereGeometry(0.02, 8, 6).scale(0.8, 1.5, 0.8));
  put(
    g,
    joined('core pips', [
      [pip, -0.125, -0.05, -0.03, 0, 0, 0.3],
      [pip, 0.125, -0.07, -0.05, 0, 0, -0.3],
      [pip, 0.02, -0.06, -0.13],
      rotAt(0.055, 0.75, -0.19, 0.258),
      rotAt(0.04, 2.5, -0.15, 0.25),
      rotAt(0.06, -2.3, -0.19, 0.258),
      rotAt(0.035, -0.6, -0.23, 0.24),
      rotAt(0.04, 1.0, 0.19, 0.208),
      rotAt(0.045, -2.6, 0.2, 0.203),
    ]),
    mat(0x3a2414, 0.5),
    0,
    0,
    0,
  );
  put(
    g,
    // the stalk sunk well into the top, and its leaf growing out of its side near the top, up and out
    joined('apple stalk', [
      [cyl(0.012, 0.016, 0.12, 6), 0, 0.25, 0, 0, 0, 0.2],
      [rbox(0.1, 0.012, 0.05, 0.01), 0.038, 0.313, 0, 0, 0, 0.5],
    ]),
    mat(0x4a3a24, 0.8),
    0,
    0.04,
    0,
  );
  const flies = new THREE.Group();
  put(
    flies,
    joined('flies', [
      [sph(0.018, 6), 0.34, 0.04, 0],
      [sph(0.018, 6), -0.2, -0.04, 0.28],
      [sph(0.018, 6), -0.16, 0.08, -0.3],
    ]),
    mat(0x1d1f24, 0.4),
    0,
    0,
    0,
  );
  flies.position.y = 0.05;
  spin(rig, flies, 2.6);
  g.add(flies);
  faceOut(rig, { eyes: -0.065, brows: -0.05, mouth: -0.045 });
  props(rig, g);
  rig.head.add(g);
  rig.pillow = 0.07;
}

/**
 * A blue screen: the head an old beige monitor, the face on its blue screen over two lines of white error text.
 */
function oldMonitor(rig: CharRig) {
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);
  const g = new THREE.Group();
  put(
    g,
    joined('monitor case', [
      [rbox(0.5, 0.42, 0.24, 0.04), 0, 0.02, 0.06],
      [rbox(0.36, 0.3, 0.2, 0.06), 0, 0.02, -0.14],
    ]),
    mat(0xd9cfb4, 0.6),
    0,
    0,
    0,
  );
  put(g, rbox(0.4, 0.31, 0.012, 0.03), mat(0x2b5fd9, 0.4, 0.7), 0, 0.03, 0.18);
  put(
    g,
    joined('error text', [
      [rbox(0.2, 0.014, 0.004, 0.002), -0.04, -0.09, 0],
      [rbox(0.14, 0.014, 0.004, 0.002), -0.07, -0.12, 0],
    ]),
    // plain white, not glowing as the screen does, so the crowd draws it with everyone's white in a batch
    mat(0xffffff, 0.4),
    0,
    0.03,
    0.188,
  );
  faceOut(rig, { eyes: -0.005, brows: -0.008, mouth: -0.005 });
  props(rig, g);
  rig.head.add(g);
}

/** Points along a cable wound round and round the body, wobbling, from the back of the neck down to the hips. */
function wound(turns: number, from: number, to: number, rx: number, rz: number, wobble: number, phase: number) {
  const points: [number, number, number][] = [[0, from + 0.06, -0.16]];
  const n = Math.round(turns * 8);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = phase + f * turns * Math.PI * 2;
    const w = 1 + Math.sin(i * 2.3 + phase) * wobble;
    points.push([Math.sin(a) * rx * w, from + (to - from) * f + Math.sin(i * 1.7) * 0.04, -Math.cos(a) * rz * w]);
  }
  return points;
}

/**
 * Crossed wires: the head a white wall plug, two brass prongs out of the top and the face on its front, its black cable
 * wound three times round the body every which way, an orange extension cord tangled in with it, and the two plugs at
 * their ends dangling at the hips.
 */
function plugHead(rig: CharRig) {
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);
  const g = new THREE.Group();
  put(g, rbox(0.42, 0.46, 0.38, 0.09), mat(0xf4f1ea, 0.45), 0, 0, -0.01);
  put(
    g,
    joined('plug prongs', [
      [rbox(0.045, 0.16, 0.014, 0.004), -0.08, 0.3, 0],
      [rbox(0.045, 0.16, 0.014, 0.004), 0.08, 0.3, 0],
    ]),
    mat(0xc9a13a, 0.25),
    0,
    0,
    0,
  );
  props(rig, g);
  rig.head.add(g);
  faceOut(rig, { eyes: -0.01, brows: -0.012, mouth: -0.01 });
  const black = wound(3, 0.56, -0.12, 0.31, 0.21, 0.18, 0);
  black.push([0.24, -0.24, 0.12]);
  const orange = wound(2.5, 0.46, -0.04, 0.34, 0.24, 0.22, 2.1);
  orange.push([-0.24, -0.22, 0.14]);
  const cable = put(rig.torso, tube('plug cable wound', black, 0.022), mat(0x1d1f24, 0.5), 0, 0, 0);
  const cord = put(rig.torso, tube('extension cord wound', orange, 0.022), mat(0xf08a24, 0.5), 0, 0, 0);
  const plugs = put(
    rig.torso,
    joined('dangling plugs', [
      [rbox(0.06, 0.09, 0.05, 0.012), 0.24, -0.3, 0.12],
      [rbox(0.06, 0.09, 0.05, 0.012), -0.24, -0.28, 0.14],
    ]),
    mat(0xf4f1ea, 0.45),
    0,
    0,
    0,
  );
  props(rig, cable, cord, plugs);
  swell(rig, 1.04, 1.04);
}

/**
 * The glass of a snow globe, one for every guest in one. It is see-through, so the crowd cannot draw it in a batch and
 * it draws itself; it is shared, so it is never freed.
 */
const GLOBE = new THREE.MeshStandardMaterial({
  color: 0xe8f4fa,
  transparent: true,
  opacity: 0.32,
  roughness: 0.05,
  depthWrite: false,
});

/** How far over the globe's middle the snow in it is heaped: up to the nose, just under the eyes. */
const SNOWED_TO = -0.13;

/** The snow heaped in the bottom of a globe of a radius, up to a height over its middle, with a few lumps on top. */
const heap = (r: number, top: number) =>
  joined(`globe snow ${r} ${top}`, [
    [new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.acos(top / r), Math.PI - Math.acos(top / r)), 0, 0, 0],
    [new THREE.CircleGeometry(Math.sqrt(r * r - top * top), 24), 0, top, 0, -Math.PI / 2, 0, 0],
    [sph(0.07, 10), 0.16, top, 0.12],
    [sph(0.06, 10), -0.18, top, -0.06],
    [sph(0.05, 10), 0.04, top, -0.2],
  ]);

/**
 * Snowed in: the head and shoulders inside a snow globe on a wooden base, the snow heaped up inside it to the nose and
 * the flakes still swirling over it, only the eyes and the top of the head clear.
 */
function snowGlobe(rig: CharRig) {
  const snow = mat(0xffffff, 0.6);
  const g = new THREE.Group();
  put(g, sph(0.36, 24), GLOBE, 0, 0.12, 0);
  put(g, cyl(0.24, 0.3, 0.12, 20), mat(0x8a5a2c, 0.6), 0, -0.22, 0);
  put(g, cyl(0.25, 0.25, 0.03, 20), mat(0xc9a13a, 0.3), 0, -0.15, 0);
  put(g, heap(0.345, SNOWED_TO), snow, 0, 0.12, 0);
  const flakes = new THREE.Group();
  put(
    flakes,
    joined(
      'globe flakes',
      Array.from({ length: 9 }, (_, i): Piece => {
        const a = i * 2.4;
        const r = 0.24 + (i % 3) * 0.04;
        return [sph(0.018, 6), Math.cos(a) * r, 0.06 + ((i * 0.37) % 0.4), Math.sin(a) * r];
      }),
    ),
    snow,
    0,
    0,
    0,
  );
  g.add(flakes);
  spin(rig, flakes, 0.9);
  props(rig, g);
  rig.head.add(g);
}

/** Draw a symptom that stands in for the head, if it is one. */
export function headSymptom(rig: CharRig, visual: Visual | undefined) {
  if (visual === 'egg') egg(rig);
  else if (visual === 'battery') battery(rig);
  else if (visual === 'steam') kettle(rig);
  else if (visual === 'gears') boombox(rig);
  else if (visual === 'compass') signpost(rig);
  else if (visual === 'band') gClamp(rig);
  else if (visual === 'rotten') appleCore(rig);
  else if (visual === 'bluescreen') oldMonitor(rig);
  else if (visual === 'wires') plugHead(rig);
  else if (visual === 'snowcap') snowGlobe(rig);
}
