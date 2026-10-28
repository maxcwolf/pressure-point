// The symptoms of the ailments only a machine cures, drawn on a guest: an office chair stuck to them, shopping bags, an old
// monitor for a head, a beach umbrella over the head, a crust of salt, seaweed, an echo, a snow globe, a bunch of sour
// grapes, an apple core for a head, a flat cap and walking stick, and a Tudor ruff. The chair is drawn with the symptoms
// worn whole, in character-bodies.ts, and the two heads and the globe with the others that stand in for a head, in
// character-heads.ts.

import * as THREE from 'three';

import type { Visual } from '../../core/data';
import { owned } from '../disposal';
import type { CharRig } from './character';
import { bodySymptom } from './character-bodies';
import { detailCap } from './character-detail';
import { headSymptom } from './character-heads';
import { capsule, cyl, mat, put, rbox, sph, torus } from './parts';

/** The parts of a person a symptom hangs from, and how far up the forearm the hand is. */
export interface Body {
  head: THREE.Group;
  torso: THREE.Group;
  holdR: THREE.Group;
  foreL: THREE.Group;
  handUp: number;
}

/** Keep small parts from casting shadows, and note them as the symptom's, to go when the guest is healed. */
function props(rig: CharRig, ...parts: THREE.Object3D[]) {
  for (const p of parts) {
    p.traverse((o) => (o.castShadow = false));
    rig.props.push(p);
  }
}

/** Put a cap on a head and return it. */
function capOn(head: THREE.Group, cloth: THREE.Material, kind: 'peaked' | 'flat'): THREE.Object3D {
  detailCap(head, cloth, kind);
  return head.getObjectByName('cap') ?? new THREE.Group();
}

/** A shopping bag, hanging from a hand: a paper bag in a color, with a handle. */
function bag(color: number): THREE.Group {
  const g = new THREE.Group();
  put(g, rbox(0.17, 0.2, 0.08, 0.01), mat(color, 0.8), 0, -0.12, 0);
  put(g, torus(0.04, 0.008), mat(0x3b3f4a, 0.6), 0, 0, 0);
  return g;
}

/** Draw a machine ailment's symptom on a guest, if it is one. */
export function machineSymptom(rig: CharRig, visual: Visual | undefined, b: Body) {
  const { head, torso } = b;
  if (visual === 'chairshape') {
    bodySymptom(rig, visual);
  } else if (visual === 'bags') {
    // somebody else's shopping, a bag in each hand
    const right = bag(0xd9a93a);
    right.position.set(0, -0.36 + b.handUp, 0.06);
    b.holdR.add(right);
    const left = bag(0xc0392b);
    left.position.set(0, -0.36 + b.handUp, 0.06);
    b.foreL.add(left);
    props(rig, right, left);
  } else if (visual === 'bluescreen') {
    headSymptom(rig, visual);
  } else if (visual === 'beachhead') {
    // a beach umbrella over the head, and sunglasses on, wherever they are
    const brolly = new THREE.Group();
    put(brolly, cyl(0.01, 0.3, 0.12, 8), mat(0xe5484d, 0.6), 0, 0.2, 0);
    put(brolly, cyl(0.008, 0.008, 0.22, 6), mat(0xf4f1ea, 0.5), 0, 0.08, 0);
    brolly.position.y = 0.3;
    head.add(brolly);
    rig.bob = brolly;
    const shades = mat(0x1d1f24, 0.2);
    for (const x of [-0.075, 0.075]) props(rig, put(head, rbox(0.1, 0.06, 0.02, 0.01), shades, x, 0.025, 0.205));
  } else if (visual === 'salt') {
    // crusted in salt, head and shoulders
    const salt = mat(0xf7f7f2, 0.9);
    for (const [x, y, z, on] of [
      [-0.12, 0.18, 0.05, head],
      [0.1, 0.22, -0.04, head],
      [0.02, 0.24, 0.08, head],
      [-0.18, 0.46, 0.02, torso],
      [0.19, 0.45, -0.02, torso],
    ] as const)
      props(rig, put(on, rbox(0.07, 0.04, 0.06, 0.01), salt, x, y, z));
  } else if (visual === 'seaweed') {
    // draped in seaweed, over the head and down the shoulders
    const weed = mat(0x3f7a3a, 0.7);
    for (const [x, z, r] of [
      [-0.1, 0.05, 0.3],
      [0.08, -0.06, -0.3],
      [0.15, 0.08, -0.5],
    ] as const) {
      const strand = put(head, capsule(0.025, 0.2), weed, x, 0.08, z);
      strand.rotation.z = r;
      props(rig, strand);
    }
    for (const x of [-0.2, 0.2]) props(rig, put(torso, capsule(0.03, 0.18), weed, x, 0.38, 0.05));
  } else if (visual === 'echo') {
    // rings going out round the head, like the same words coming back
    rig.orbit = new THREE.Group();
    const ring = owned(
      new THREE.MeshStandardMaterial({ color: 0x9fd6f0, transparent: true, opacity: 0.55, emissive: 0x9fd6f0 }),
    );
    for (const [r, y] of [
      [0.3, 0],
      [0.38, 0.02],
    ] as const)
      put(rig.orbit, torus(r, 0.012), ring, 0, y, 0).rotation.x = Math.PI / 2;
    rig.orbit.position.y = 0.05;
    head.add(rig.orbit);
  } else if (visual === 'snowcap') {
    headSymptom(rig, visual);
  } else if (visual === 'grapes') {
    // a bunch of sour grapes hanging over them, and a sour look
    const bunch = new THREE.Group();
    const purple = mat(0x5a2e6a, 0.4);
    for (const [x, y] of [
      [-0.04, 0],
      [0.04, 0],
      [0, -0.06],
      [-0.07, -0.05],
      [0.07, -0.05],
      [-0.03, -0.11],
      [0.03, -0.11],
      [0, -0.16],
    ] as const)
      put(bunch, sph(0.035, 8), purple, x, y, 0);
    put(bunch, cyl(0.006, 0.006, 0.06, 5), mat(0x6b4f33, 0.8), 0, 0.05, 0);
    bunch.position.y = 0.5;
    head.add(bunch);
    rig.bob = bunch;
  } else if (visual === 'rotten') {
    headSymptom(rig, visual);
  } else if (visual === 'oldsoul') {
    // a flat cap and a walking stick, at thirty-four
    const stick = put(b.holdR, cyl(0.015, 0.015, 0.72, 8), mat(0x6b4f33, 0.7), 0, -0.4 + b.handUp, 0.08);
    props(rig, stick, capOn(head, mat(0x6b6458, 0.9), 'flat'));
  } else if (visual === 'ruff') {
    // a Tudor ruff, and the bearing of a duke
    const ruff = put(torso, torus(0.15, 0.06), mat(0xffffff, 0.8), 0, 0.55, 0);
    ruff.rotation.x = Math.PI / 2;
    props(rig, ruff);
  }
}
