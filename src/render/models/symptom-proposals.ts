// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body: two for someone scattered (`&shards=1`), in pieces or with a jigsaw piece missing, and two for
// someone who has lost their way (`&compass=1`), a signpost out of the head or a compass for a head. The face stays on
// every one, so how the guest feels still shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, spin, swell } from './character-heads';
import { cyl, joined, mat, put, rbox, torus } from './parts';

/** Take away the symptom drawn before, standing in for it: the shards round them, or the compass over the head. */
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

/**
 * Float a part of someone `up` meters up from where it belongs and `aside` meters to one side, and set it drifting up
 * and down `drift` meters (see `pose`), to be put back with the cure.
 */
function floatApart(rig: CharRig, part: THREE.Object3D, up: number, aside: number, drift: number) {
  const home = part.position.clone();
  part.position.y += up;
  part.position.x += aside;
  part.userData.drift = drift;
  (rig.spin ??= []).push(part);
  (rig.restore ??= []).push(() => {
    part.userData.drift = 0;
    delete part.userData.floats;
    part.position.copy(home);
  });
}

/** A jigsaw piece, a square with a knob out of its top and one out of its right side, as one shape. */
const jigsaw = () =>
  joined('jigsaw', [
    [rbox(0.16, 0.16, 0.035, 0.01), 0, 0, 0],
    [cyl(0.035, 0.035, 0.035, 12), 0, 0.095, 0, Math.PI / 2, 0, 0],
    [cyl(0.035, 0.035, 0.035, 12), 0.095, 0, 0, Math.PI / 2, 0, 0],
  ]);

/**
 * Scattered: 1, in pieces, the head floating a hand's width over the shoulders and the body over the legs, each a little
 * askew and drifting up and down on its own, the shards still round them; 2, a jigsaw piece missing out of the chest, a dark hole where it
 * was, the piece and two more of them, in the shirt's color, drifting round them.
 */
export function scattered(rig: CharRig, variant: number) {
  if (variant === 1) {
    floatApart(rig, rig.head, 0.2, 0.05, 0.03);
    floatApart(rig, rig.torso, 0.22, -0.04, 0.025);
    return;
  }
  dropOld(rig);
  const shirt = (rig.torso.getObjectByName('shirt') as THREE.Mesh | undefined)?.material;
  const color = shirt instanceof THREE.MeshStandardMaterial ? shirt.color.getHex() : 0x2a9d8f;
  const hole = put(rig.torso, jigsaw(), mat(0x221d26, 0.9), 0, 0.27, 0.13);
  hole.scale.z = 0.6;
  const pieces = new THREE.Group();
  const piece = mat(color, 0.6);
  for (const [a, y, tilt] of [
    [0.4, 0.3, 0.5],
    [2.5, 0.42, -0.4],
    [4.4, 0.18, 0.9],
  ] as const) {
    const p = put(pieces, jigsaw(), piece, Math.sin(a) * 0.45, y, Math.cos(a) * 0.45);
    p.rotation.set(tilt, a, tilt * 0.5);
    p.scale.setScalar(1.5);
  }
  rig.torso.add(pieces);
  spin(rig, pieces, 0.6);
  props(rig, hole, pieces);
}

const WOOD = 0x9a6a3c;
const BOARD = 0xf2e6c8;
const TIP = 0xd9362f;

/** A signpost's arrow board pointing out along its length, the tip a square turned on its corner, as one shape. */
const arrow = () =>
  joined('signpost arrow', [
    [rbox(0.26, 0.07, 0.02, 0.008), 0.15, 0, 0],
    [rbox(0.075, 0.075, 0.02, 0.008), 0.28, 0, 0, 0, 0, Math.PI / 4],
  ]);

const BRASS = 0xc9a13a;

/**
 * Lost their way: 1, a wooden signpost growing out of the top of the head, four arrows pointing every which way, the
 * whole post turning slowly as they try one way after another; 2, the head a brass compass on its edge, the face on its
 * white dial, the ring round the dial with its red north spinning round and round and never settling.
 */
export function lost(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  if (variant === 1) {
    put(g, cyl(0.022, 0.026, 0.56, 8), mat(WOOD, 0.8), 0, 0.46, 0);
    const board = mat(BOARD, 0.7);
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
      g.add(arm);
    }
    put(g, rbox(0.075, 0.075, 0.024, 0.008), mat(TIP, 0.5), 0, 0.74, 0).rotation.z = Math.PI / 4;
    spin(rig, g, 0.5);
    props(rig, g);
    rig.head.add(g);
    return;
  }
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);
  const brass = mat(BRASS, 0.3);
  put(g, cyl(0.25, 0.25, 0.16, 32), brass, 0, 0, 0.12).rotation.x = Math.PI / 2;
  put(g, cyl(0.21, 0.21, 0.02, 32), mat(0xfbfaf6, 0.6), 0, 0, 0.2).rotation.x = Math.PI / 2;
  // the winder and its ring on top, as on a pocket compass
  put(g, cyl(0.035, 0.035, 0.06, 12), brass, 0, 0.28, 0.12);
  put(g, torus(0.045, 0.012), brass, 0, 0.34, 0.12);
  // the ring round the dial, spinning in the dial's plane: turned to face out, then spun about its own upright
  const facing = new THREE.Group();
  facing.position.z = 0.215;
  facing.rotation.x = Math.PI / 2;
  const bezel = new THREE.Group();
  put(bezel, torus(0.2, 0.014), mat(0x3a3f47, 0.4), 0, 0, 0).rotation.x = Math.PI / 2;
  put(bezel, rbox(0.06, 0.012, 0.06, 0.006), mat(TIP, 0.4), 0, 0, -0.185).rotation.y = Math.PI / 4;
  for (const a of [Math.PI / 2, Math.PI, -Math.PI / 2])
    put(
      bezel,
      rbox(0.02, 0.012, 0.04, 0.004),
      mat(0x3a3f47, 0.4),
      Math.sin(a) * 0.185,
      0,
      -Math.cos(a) * 0.185,
    ).rotation.y = -a;
  facing.add(bezel);
  g.add(facing);
  spin(rig, bezel, 1.4);
  faceOut(rig, { eyes: 0.01, brows: 0.005, mouth: 0.01 });
  props(rig, g);
  rig.head.add(g);
  swell(rig, 1.08, 1.08);
}
