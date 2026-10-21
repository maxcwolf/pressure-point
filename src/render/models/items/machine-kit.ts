// What every treatment machine's model is built with: its moving parts named for its gag, and the smoke it gives off
// when worn and the sparks when it is down.

import * as THREE from 'three';

import { emitter, type EmitterShape } from '../../gags/particles';
import { mat, partsOf, sph } from '../parts';

/** Name a moving part of a machine, for its gag to move. Returns the part. */
export function rig<T extends THREE.Object3D>(g: THREE.Group, name: string, part: T): T {
  const parts = partsOf(g);
  parts.rig ??= {};
  parts.rig[name] = part;
  return part;
}

/** Add a named emitter to a machine at a spot, for its gag to set going. Returns it. */
export function puffs(
  g: THREE.Group,
  name: string,
  shape: EmitterShape,
  at: readonly [number, number, number],
  count: number,
  piece: (i: number) => THREE.Object3D,
): THREE.Group {
  const e = emitter(shape, count, piece);
  e.position.set(...at);
  g.add(e);
  const parts = partsOf(g);
  parts.emitters ??= {};
  parts.emitters[name] = e;
  return e;
}

/** A little ball for an emitter, in a color, glowing or not. */
export const blob =
  (r: number, color: number, glow = 0) =>
  () =>
    new THREE.Mesh(sph(r, 8), mat(color, 0.8, glow));

/** The smoke a worn machine gives off from its top, and the sparks from it once it is down. */
export function wornAndDown(g: THREE.Group, top: readonly [number, number, number]) {
  puffs(g, 'smoke', { kind: 'rise', reach: 1.1, spread: 0.25, speed: 0.45 }, top, 6, blob(0.09, 0x6b6b70));
  puffs(g, 'sparks', { kind: 'spray', reach: 0.5, spread: 0.25, speed: 1.6 }, top, 6, blob(0.03, 0xffd34a, 1.4));
}
