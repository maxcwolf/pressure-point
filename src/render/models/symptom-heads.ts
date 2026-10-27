// Round 1 of the heads that become the joke, for approval (see docs/planning/fun/options/symptoms/approvals/): three
// kettles for a stress head and three eggs for a scrambled noggin, each asked for by number in the address
// (`&steam=2`, `&dizzy=3`). The face stays on every one of them, so how the guest feels still shows.

import * as THREE from 'three';

import { owned } from '../disposal';
import type { CharRig } from './character';
import { hideUntilCured, named, props, swell } from './character-transform';
import { cached, cyl, mat, put, sph } from './parts';

/** The black of handles and knobs, and the steel of lids and spouts. */
const BLACK = 0x1d1f24;
const STEEL = 0xc9ced6;

/** An arch over the top of the head from one side to the other, standing in the head's left-right plane. */
const arch = (r: number, tube: number) =>
  cached(`arch ${r}|${tube}`, () => new THREE.TorusGeometry(r, tube, 10, 28, Math.PI));

/** Move the face out to sit on a surface `by` meters further forward than the head's own, part by part. */
function faceOut(rig: CharRig, by: { eyes: number; brows: number; mouth: number }) {
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
 * A spout from the side of the head, `length` long, its root at `root` and leaning out from upright by `lean`, with a
 * whistle in a color on its tip; the steam is moved to puff out of the whistle.
 */
function spout(
  rig: CharRig,
  kettle: THREE.Group,
  root: [number, number],
  lean: number,
  length: number,
  body: number,
  cap = BLACK,
) {
  const dir = new THREE.Vector2(Math.sin(lean), Math.cos(lean));
  const mid = new THREE.Vector2(...root).addScaledVector(dir, length / 2);
  const tip = new THREE.Vector2(...root).addScaledVector(dir, length);
  const pipe = put(kettle, cyl(0.032, 0.068, length, 14), mat(body, 0.35), mid.x, mid.y, 0.03);
  pipe.rotation.z = -lean;
  const whistle = put(kettle, cyl(0.04, 0.034, 0.06, 12), mat(cap, 0.4), tip.x, tip.y, 0.03);
  whistle.rotation.z = -lean;
  rig.steam?.position.set(tip.x + dir.x * 0.05, tip.y + dir.y * 0.05, 0.03);
}

/**
 * A stress head's kettle: 1, the head itself in red enamel, round, under a steel lid, with a black handle arching over
 * and a thick spout from the cheek; 2, a tapering blue enamel stovetop kettle in place of the head, a long steel spout
 * and a black handle; 3, the same stovetop kettle in polished chrome with a red knob and whistle.
 */
export function kettle(rig: CharRig, variant: number) {
  const { head } = rig;
  hideUntilCured(rig, named(head, 'hair', 'moustache', 'beard', 'glasses'));
  const kettle = new THREE.Group();
  const black = mat(BLACK, 0.4);
  if (variant === 1) {
    const enamel = 0xd23c2a;
    rig.headMesh.material = mat(enamel, 0.35);
    const lid = put(kettle, sph(0.15, 20), mat(STEEL, 0.25), 0, 0.19, 0);
    lid.scale.y = 0.4;
    put(kettle, sph(0.04, 12), black, 0, 0.26, 0);
    const handle = put(kettle, arch(0.17, 0.03), black, 0, 0.1, -0.02);
    handle.scale.y = 1.5;
    spout(rig, kettle, [0.17, -0.07], 0.8, 0.3, enamel);
    swell(rig, 1.2, 1.2);
  } else {
    const chrome = variant === 3;
    const body = chrome ? 0xd8dde3 : 0x2f5fb3;
    const shine = chrome ? 0.18 : 0.35;
    hideUntilCured(rig, [rig.headMesh]);
    put(kettle, cyl(0.13, 0.26, 0.36, 32), mat(body, shine), 0, -0.02, 0);
    put(kettle, cyl(0.268, 0.268, 0.035, 32), black, 0, -0.2, 0);
    put(kettle, cyl(0.11, 0.135, 0.04, 24), mat(STEEL, 0.25), 0, 0.18, 0);
    put(kettle, sph(0.038, 12), chrome ? mat(0xd9362f, 0.4) : black, 0, 0.215, 0);
    const handle = put(kettle, arch(0.15, 0.028), black, 0, 0.12, -0.01);
    handle.scale.y = 1.4;
    spout(rig, kettle, [0.17, -0.11], 0.72, 0.36, chrome ? body : STEEL, chrome ? 0xd9362f : BLACK);
    // the face on the kettle's tapering front: the mouth further out where it is wider, the brows in where it narrows
    faceOut(rig, { eyes: 0, brows: -0.012, mouth: 0.032 });
    swell(rig, 1.15, 1.15);
  }
  props(rig, kettle);
  head.add(kettle);
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

/** A piece of eggshell from `from` to `to` of the way up, its broken edges zigzagged, `amp` meters up and down. */
function shell(r: number, h: number, from: number, to: number, amp: number) {
  return cached(`shell ${r}|${h}|${from}|${to}|${amp}`, () => {
    const points = eggOutline(r, h, from, to);
    const around = 22;
    const geo = new THREE.LatheGeometry(points, around);
    const at = geo.getAttribute('position');
    const per = points.length;
    for (let j = 0; j <= around; j++) {
      const zig = (j % 2 ? 1 : -1) * amp;
      if (to < 1) at.setY(j * per + per - 1, at.getY(j * per + per - 1) + zig);
      if (from > 0) at.setY(j * per, at.getY(j * per) + zig);
    }
    geo.computeVertexNormals();
    return geo;
  });
}

const SHELL = 0xf6efe2;
const YOLK = 0xf2a81e;

/**
 * A scrambled noggin's egg: 1, the head inside a cracked shell, its top half lifted and tipped back like a lid and its
 * bottom half cupping the chin, the face looking out of the gap and yolk running down; 2, the head an egg, cracked
 * round the crown, with a heap of scrambled egg spilling out of the top; 3, the head an egg with its top knocked off,
 * the yolk showing, and the broken cap floating above among the stars.
 */
export function egg(rig: CharRig, variant: number) {
  const { head } = rig;
  hideUntilCured(rig, named(head, 'hair', 'moustache', 'beard'));
  const egg = new THREE.Group();
  const yolk = mat(YOLK, 0.3);
  const shellMat = owned(new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.55, side: THREE.DoubleSide }));
  if (variant === 1) {
    // the egg 0.7 tall, from under the chin to well over the crown, broken just below the mouth and just above the brows
    const cup = put(egg, shell(0.27, 0.7, 0, 0.26, 0.022), shellMat, 0, 0.05, 0);
    cup.name = 'cup';
    const lid = new THREE.Group();
    put(lid, shell(0.27, 0.7, 0.61, 1, 0.022), shellMat, 0, 0, 0);
    lid.position.set(0, 0.07, -0.02);
    lid.rotation.set(-0.22, 0, 0.1);
    egg.add(lid);
    const drip = put(egg, sph(0.03, 10), yolk, 0.19, 0.06, 0.12);
    drip.scale.set(0.8, 2.2, 0.8);
    put(egg, sph(0.045, 10), yolk, 0.16, -0.12, 0.17).scale.set(1.3, 0.6, 1);
    swell(rig, 1.05, 1.05);
  } else {
    // the head an egg in place of the skull, a little taller than it and raised to clear the shoulders
    hideUntilCured(rig, [rig.headMesh]);
    faceOut(rig, { eyes: 0.05, brows: 0.045, mouth: 0.05 });
    if (variant === 2) {
      put(
        egg,
        cached('whole egg', () => new THREE.LatheGeometry(eggOutline(0.25, 0.62, 0, 1), 28)),
        mat(SHELL, 0.5),
        0,
        0.06,
        0,
      );
      // a dark zigzag crack across the crown, and the scrambled egg heaped up out of it
      const crack = mat(0x5a4a3a, 0.6);
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI;
        const y = 0.27 + (i % 2) * 0.03;
        const bit = put(egg, cyl(0.008, 0.008, 0.06, 5), crack, Math.sin(a) * 0.17, y, Math.cos(a) * 0.17);
        bit.rotation.set(0, a, i % 2 ? 0.9 : -0.9);
      }
      for (const [x, y, z, s] of [
        [0, 0.38, 0, 0.075],
        [0.07, 0.36, 0.04, 0.06],
        [-0.07, 0.36, 0.03, 0.06],
        [0.03, 0.35, -0.07, 0.06],
        [-0.04, 0.42, -0.02, 0.05],
        [0.05, 0.43, 0.01, 0.045],
        [-0.1, 0.33, -0.04, 0.045],
      ] as const)
        put(egg, sph(s, 10), mat(0xf5cf4a, 0.7), x, y, z).scale.y = 0.75;
    } else {
      // knocked off two-thirds of the way up, the yolk filling the opening, the cap floating over it
      put(egg, shell(0.25, 0.62, 0, 0.72, 0.025), shellMat, 0, 0.06, 0);
      const pool = put(egg, sph(0.15, 18), yolk, 0, 0.19, 0);
      pool.scale.y = 0.3;
      const cap = new THREE.Group();
      put(cap, shell(0.25, 0.62, 0.72, 1, 0.025), shellMat, 0, -0.2, 0);
      cap.position.set(0.04, 0.36, -0.02);
      cap.rotation.set(-0.3, 0, 0.35);
      egg.add(cap);
    }
    swell(rig, 1.08, 1.08);
  }
  props(rig, egg);
  head.add(egg);
}
