// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body, by the ailment's look: `&worm=2` for the second Earworm, say. Round 9 reworks the ones picked
// with changes: Earworm 2 with a longer worm (`worm`), Wires 1 more tangled (`wires`), the giant phone clear of the
// shoulder (`neck`), the snow globe with the snow up to the face (`snowcap=3`, beside the globe as it was, `=1`) and a
// second pass at Lobster 1 (`sunburn`). The face stays on every one, so how the guest feels still shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, spin, swell } from './character-heads';
import { cached, cyl, joined, mat, put, rbox, sph } from './parts';

/** Take away the symptom drawn before, standing in for it: every prop, and whatever hovered or went round them. */
function dropOld(rig: CharRig) {
  for (const p of rig.props) p.visible = false;
  for (const old of [rig.bob, rig.orbit]) {
    if (!old) continue;
    old.removeFromParent();
    rig.props = rig.props.filter((p) => p !== old);
  }
  delete rig.bob;
  delete rig.orbit;
}

/** Hide the head, its hair and whatever else is on it, while something stands in for it. */
const hideHead = (rig: CharRig) =>
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);

/** A tube along a smooth line through points, made once under a name and shared. */
const tube = (key: string, points: readonly (readonly [number, number, number])[], r: number) =>
  cached(
    `tube ${key}`,
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
        points.length * 10,
        r,
        8,
      ),
  );

/** Where someone's hand is on its forearm. */
function handAt(fore: THREE.Object3D) {
  const hand = fore.getObjectByName('hand') as THREE.Mesh | undefined;
  if (!hand) return new THREE.Vector3(0, -0.2, 0);
  hand.geometry.computeBoundingBox();
  const box = hand.geometry.boundingBox ?? new THREE.Box3();
  return box.getCenter(new THREE.Vector3()).add(hand.position);
}

const WORM = 0xe98fa6;

/** A worm's head with two black eyes, pointing along +x, nodding along. */
function wormHead(rig: CharRig, at: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  put(g, sph(0.055, 12), mat(WORM, 0.6), 0, 0, 0);
  put(
    g,
    joined('worm eyes', [
      [sph(0.013, 6), 0.04, 0.022, 0.024],
      [sph(0.013, 6), 0.04, 0.022, -0.024],
    ]),
    mat(0x1d1f24, 0.3),
    0,
    0,
    0,
  );
  spin(rig, g, 0, 0.12);
  at.add(g);
  return g;
}

/** A note of music: a head and a stem, as one shape. */
const note = () =>
  joined('earworm note', [
    [sph(0.03, 8), 0, 0, 0],
    [rbox(0.012, 0.09, 0.012, 0.004), 0.024, 0.045, 0],
  ]);

/**
 * Earworm 2, longer: a big pair of headphones on the guest, and a long fat worm out of one cup, down round the side of
 * the neck and up in an arch high over the headband, its head nodding along out front; the notes of the jingle rising
 * off the other side.
 */
export function earworm(rig: CharRig) {
  dropOld(rig);
  const g = new THREE.Group();
  put(
    g,
    joined('big headphones', [
      [cyl(0.12, 0.12, 0.08, 18), -0.24, 0, 0, 0, 0, Math.PI / 2],
      [cyl(0.12, 0.12, 0.08, 18), 0.24, 0, 0, 0, 0, Math.PI / 2],
      [rbox(0.06, 0.03, 0.06, 0.01), -0.27, 0.15, 0],
      [rbox(0.06, 0.03, 0.06, 0.01), 0.27, 0.15, 0],
    ]),
    mat(0x1d1f24, 0.4),
    0,
    0,
    0,
  );
  const band = put(
    g,
    cached('headphone band', () => new THREE.TorusGeometry(0.27, 0.025, 8, 20, Math.PI)),
    mat(0xd9362f, 0.4),
    0,
    0.12,
    0,
  );
  band.scale.y = 0.75;
  put(
    g,
    tube(
      'earworm long',
      [
        [-0.29, 0.0, 0.02],
        [-0.37, -0.08, 0.08],
        [-0.42, -0.02, 0.16],
        [-0.45, 0.14, 0.12],
        [-0.42, 0.32, 0.02],
        [-0.3, 0.46, -0.04],
        [-0.12, 0.54, 0.0],
        [0.04, 0.55, 0.08],
        [0.14, 0.5, 0.16],
      ],
      0.042,
    ),
    mat(WORM, 0.6),
    0,
    0,
    0,
  );
  const head = wormHead(rig, g, 0.17, 0.47, 0.19);
  head.rotation.set(0, -0.6, -0.5);
  rig.steam = new THREE.Group();
  const ink = mat(0x1d1f24, 0.4);
  for (let i = 0; i < 3; i++) put(rig.steam, note(), ink, i * 0.09, 0, 0);
  rig.steam.position.set(0.3, 0.22, 0);
  g.add(rig.steam);
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
 * Crossed Wires 1, more tangled: the head a white wall plug, two brass prongs out of the top and the face on its front,
 * its black cable wound three times round the body every which way, an orange extension cord tangled in with it, and
 * the two plugs at their ends dangling at the hips.
 */
export function plugged(rig: CharRig) {
  dropOld(rig);
  hideHead(rig);
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
  const cables = put(rig.torso, tube('plug cable wound', black, 0.022), mat(0x1d1f24, 0.5), 0, 0, 0);
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
  props(rig, cables, cord, plugs);
  swell(rig, 1.04, 1.04);
}

/**
 * Text Neck, the giant phone: the phone in their hand as big as their chest, its screen glowing, held out in front of
 * them from its near end rather than through the shoulder and chest. Their own head, bent over it.
 */
export function phoneHead(rig: CharRig) {
  const phone = rig.joints.foreR.getObjectByName('phone');
  if (!phone) return;
  const at = phone.position.clone();
  phone.scale.setScalar(2.8);
  phone.position.add(PHONE_OUT);
  (rig.restore ??= []).push(() => {
    phone.scale.setScalar(1);
    phone.position.copy(at);
  });
}

/**
 * How far the giant phone is moved from where the small one sits, in the forearm's frame: out past the hand, so its near
 * end is at the hand rather than in the chest, and a little down, below the face.
 */
const PHONE_OUT = new THREE.Vector3(0, -0.28, -0.1);

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

/** The snow heaped in the bottom of a globe, up to a height over its middle, with a few lumps on top. */
const heap = (r: number, top: number) =>
  joined(`globe snow ${r} ${top}`, [
    [new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.acos(top / r), Math.PI - Math.acos(top / r)), 0, 0, 0],
    [new THREE.CircleGeometry(Math.sqrt(r * r - top * top), 24), 0, top, 0, -Math.PI / 2, 0, 0],
    [sph(0.07, 10), 0.16, top, 0.12],
    [sph(0.06, 10), -0.18, top, -0.06],
    [sph(0.05, 10), 0.04, top, -0.2],
  ]);

/**
 * Snowed In, the snow globe: the head and shoulders inside a snow globe on a wooden base, the snow swirling round them;
 * 3, the same globe with the snow heaped inside it up to the nose, only the eyes and brows clear of it.
 */
export function snowedIn(rig: CharRig, variant: number) {
  dropOld(rig);
  const snow = mat(0xffffff, 0.6);
  const g = new THREE.Group();
  put(g, sph(0.36, 24), GLOBE, 0, 0.12, 0);
  put(g, cyl(0.24, 0.3, 0.12, 20), mat(0x8a5a2c, 0.6), 0, -0.22, 0);
  put(g, cyl(0.25, 0.25, 0.03, 20), mat(0xc9a13a, 0.3), 0, -0.15, 0);
  // up to the nose, from the middle of the globe: just under the eyes
  if (variant === 3) put(g, heap(0.345, -0.13), snow, 0, 0.12, 0);
  const flakes = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.24 + (i % 3) * 0.04;
    put(
      flakes,
      sph(0.018, 6),
      snow,
      Math.cos(a) * r,
      (variant === 3 ? 0.06 : -0.05) + ((i * 0.37) % 0.4),
      Math.sin(a) * r,
    );
  }
  g.add(flakes);
  spin(rig, flakes, 0.9);
  props(rig, g);
  rig.head.add(g);
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
 * Lobstered 1, a second pass: lobster red behind the sunglasses, a big crusher claw for each hand, and two long feelers
 * out of the forehead sweeping up and back over the head as a lobster's do, thick at the root and thin at the tip, with a
 * pair of short ones out front.
 */
export function lobster(rig: CharRig) {
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
  props(rig, feelers, claw(rig, rig.joints.foreL), claw(rig, rig.joints.foreR));
  rig.head.add(feelers);
}
