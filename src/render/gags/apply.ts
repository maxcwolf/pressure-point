// Setting a gag's frame on a machine's model, and on the guest inside it.

import * as THREE from 'three';

import type { CharRig } from '../models/character';
import { partsOf } from '../models/parts';
import { animateEmitter } from './particles';
import type { GagFrame, GuestMove, PartMove } from './types';

/** Where a part was built, which its moves are made from. */
interface Rest {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  visible: boolean;
}

const rests = new WeakMap<THREE.Object3D, Rest>();

/** Where a part was built, noted the first time it is moved. */
function restOf(o: THREE.Object3D): Rest {
  let rest = rests.get(o);
  if (!rest) {
    rest = { position: o.position.clone(), rotation: o.rotation.clone(), scale: o.scale.clone(), visible: o.visible };
    rests.set(o, rest);
  }
  return rest;
}

/** Move a part as a frame says, from where it was built: back there when the frame leaves it alone. */
function movePart(o: THREE.Object3D, m: PartMove | undefined) {
  const rest = restOf(o);
  o.position.set(rest.position.x + (m?.x ?? 0), rest.position.y + (m?.y ?? 0), rest.position.z + (m?.z ?? 0));
  o.rotation.set(rest.rotation.x + (m?.rx ?? 0), rest.rotation.y + (m?.ry ?? 0), rest.rotation.z + (m?.rz ?? 0));
  const s = m?.s ?? 1;
  o.scale.set(rest.scale.x * s * (m?.sx ?? 1), rest.scale.y * s * (m?.sy ?? 1), rest.scale.z * s * (m?.sz ?? 1));
  o.visible = m?.show ?? rest.visible;
}

/** Set a frame of a gag on a machine's model: its named parts moved and its emitters puffing. */
export function applyGag(model: THREE.Object3D, frame: GagFrame, t: number) {
  const { rig, emitters, shine } = partsOf(model);
  if (rig) for (const [name, o] of Object.entries(rig)) movePart(o, frame.parts[name]);
  if (emitters) for (const [name, g] of Object.entries(emitters)) animateEmitter(g, frame.emit[name] ?? 0, t);
  if (shine && frame.shine !== undefined) shine.emissiveIntensity = frame.shine;
}

const offset = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Set a frame of a gag on the guest inside a machine, once they have been posed: hidden, moved, spun, tipped,
 * squashed or drawn together, in the machine's own frame, which is turned a quarter `rot` times.
 */
export function applyGuestGag(rig: CharRig, move: GuestMove, rot: number) {
  if (move.hide) {
    rig.group.visible = false;
    rig.pick.visible = false;
    return;
  }
  offset.set(move.x ?? 0, move.y ?? 0, move.z ?? 0).applyAxisAngle(UP, (-rot * Math.PI) / 2);
  rig.group.position.add(offset);
  rig.group.rotation.y += move.spin ?? 0;
  // nothing else tips the whole figure, so it is set outright, and put back upright once the gag is over
  rig.group.rotation.x = move.tilt ?? 0;
  const s = move.s ?? 1;
  rig.group.scale.set(rig.group.scale.x * s, rig.group.scale.y * s * (move.sy ?? 1), rig.group.scale.z * s);
  // pieces floating apart drawn back toward where they belong, from where the pose put them this frame
  const gather = move.gather ?? 0;
  if (gather > 0)
    for (const o of rig.spin ?? []) if (o.userData.drift) o.position.lerp(o.userData.home as THREE.Vector3, gather);
}
