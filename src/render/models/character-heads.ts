// The symptoms that take the place of a guest's head, so the ailment reads from across the room at the game's usual
// distance rather than as a speck over the head: a scrambled noggin's head is an egg with its top knocked off, and a
// flat battery's a battery on its side. The face stays on, so how the guest feels still shows, and the head comes back
// halfway through the cure.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Visual } from '../../core/data';
import { owned } from '../disposal';
import type { CharRig } from './character';
import { cached, mat, put, rbox, sph } from './parts';

/** Keep a symptom's parts from casting shadows, and note them as the symptom's, to go when the guest is healed. */
export function props(rig: CharRig, ...parts: THREE.Object3D[]) {
  for (const p of parts) {
    p.traverse((o) => (o.castShadow = false));
    rig.props.push(p);
  }
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

/** Draw a symptom that stands in for the head, if it is one. */
export function headSymptom(rig: CharRig, visual: Visual | undefined) {
  if (visual === 'egg') egg(rig);
  else if (visual === 'battery') battery(rig);
}
