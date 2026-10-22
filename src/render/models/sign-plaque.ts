// A room's sign: a plaque in the room's trim carrying its icon on both faces, so it reads from either side of its
// wall and so from every turn of the camera, with a lamp on top that shows how the room is doing.

import * as THREE from 'three';

import type { RoomType } from '../../core/data';
import { owned } from '../disposal';
import { PLAQUE_H, PLAQUE_W } from '../shared';
import { iconTexture } from './icons';
import { put, sph } from './parts';

/**
 * How a room is doing, as its lamp shows it: working, nobody here to work it, a piece of its equipment broken, or not
 * yet finished.
 */
export type LampState = 'working' | 'idle' | 'broken' | 'unfinished';

/** Every state a lamp shows, in the order the lab lists them. */
export const LAMP_STATES: readonly LampState[] = ['working', 'idle', 'broken', 'unfinished'];

/** The color each state lights its lamp: green, amber, red, and the grey of a lamp not yet switched on. */
export const LAMP_COLOR: Readonly<Record<LampState, number>> = {
  working: 0x3ad16a,
  idle: 0xffa21f,
  broken: 0xff3b30,
  unfinished: 0x9aa3ad,
};

/** How brightly each state's lamp glows at rest; amber and red pulse about this. */
const LAMP_GLOW: Readonly<Record<LampState, number>> = { working: 1.4, idle: 1.8, broken: 2.1, unfinished: 0.12 };

/** How many times a second the amber and red lamps pulse: red a little quicker, as it is more pressing. */
const PULSE_HZ: Readonly<Record<LampState, number>> = { working: 0, idle: 0.7, broken: 1.1, unfinished: 0 };

/** How brightly a lamp in a state glows at a moment: steady for green and grey, gently pulsing for amber and red. */
export function lampGlow(state: LampState, t: number): number {
  const hz = PULSE_HZ[state];
  const base = LAMP_GLOW[state];
  return hz ? base * (0.7 + 0.3 * Math.sin(t * hz * Math.PI * 2)) : base;
}

/** How big the lamp is, and the soft halo round it, which carries its color across the building. */
const LAMP_R = 0.1;
const HALO = 0.95;
/** How strongly the halo shows at rest. */
const HALO_OPACITY = 0.7;

/** The lamp's glass for each state, shared by every lamp: one material each, however many rooms there are. */
const lampMats = new Map<LampState, THREE.MeshStandardMaterial>();
/** The halo for each state, shared the same way. */
const haloMats = new Map<LampState, THREE.SpriteMaterial>();

/** The shared glass of a lamp in a state. */
export function lampMaterial(state: LampState): THREE.MeshStandardMaterial {
  let m = lampMats.get(state);
  if (!m) {
    const color = LAMP_COLOR[state];
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: LAMP_GLOW[state], roughness: 0.3 });
    lampMats.set(state, m);
  }
  return m;
}

/** A soft round spot, full in the middle and fading to nothing toward the edge, for a lamp's halo. */
function haloTexture(): THREE.DataTexture {
  const N = 32;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
      const i = (y * N + x) * 4;
      data.set([255, 255, 255, Math.round(255 * Math.min(1, Math.max(0, 1 - r) * 1.8) ** 1.6)], i);
    }
  const tex = new THREE.DataTexture(data, N, N);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
let halo: THREE.DataTexture | null = null;

/** The shared halo of a lamp in a state: none for a lamp not yet switched on. */
function haloMaterial(state: LampState): THREE.SpriteMaterial {
  let m = haloMats.get(state);
  if (!m) {
    halo ??= haloTexture();
    m = new THREE.SpriteMaterial({
      map: halo,
      color: LAMP_COLOR[state],
      // laid over what is behind rather than added to it, which would wash out to white on the pale floors
      transparent: true,
      opacity: HALO_OPACITY,
      depthWrite: false,
    });
    haloMats.set(state, m);
  }
  return m;
}

/** Brighten and dim every lamp and halo for a moment: the shared materials, so this is the same work for any number. */
export function pulseLamps(t: number) {
  for (const [state, m] of lampMats) m.emissiveIntensity = lampGlow(state, t);
  for (const [state, m] of haloMats) m.opacity = HALO_OPACITY * Math.min(1, lampGlow(state, t) / LAMP_GLOW[state]);
}

// each room type's icon, as a face of its plaque: one material for each, shared by every plaque of that type
const faces = new Map<RoomType, THREE.MeshStandardMaterial>();

/** The face of a type of room's plaque: its icon, cut out along its edge. */
function faceMaterial(type: RoomType): THREE.MeshStandardMaterial {
  let m = faces.get(type);
  if (!m) {
    const map = iconTexture(`room-${type}`, true);
    // lit faintly from within, as a sign is, so it reads on the side of its wall the sun is not on
    m = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: map,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      alphaTest: 0.5,
      roughness: 0.5,
    });
    faces.set(type, m);
  }
  return m;
}

/** A room's sign as built: the whole of it, and its lamp and halo, which change as the room does. */
export interface SignPlaque {
  root: THREE.Group;
  lamp: THREE.Mesh;
  halo: THREE.Sprite;
}

/** How thick the plaque's board is. */
const BOARD_T = 0.05;

/**
 * Build a room's sign, its bottom edge at the origin and its faces looking either way along z. The board is in the
 * material given, the room's trim; on a post, a short post of it holds the plaque up from below.
 */
export function buildSignPlaque(type: RoomType, board: THREE.Material, post = 0): SignPlaque {
  const root = new THREE.Group();
  // a plain box, as the walls' trim is, so the board and its post are drawn with the trim in the same call
  put(root, owned(new THREE.BoxGeometry(PLAQUE_W, PLAQUE_H, BOARD_T)), board, 0, PLAQUE_H / 2, 0);
  if (post > 0) put(root, owned(new THREE.BoxGeometry(0.05, post, 0.05)), board, 0, -post / 2, 0);
  // the icon on both faces, a little proud of the board, each facing out its own way so it reads the right way round
  const face = faceMaterial(type);
  const side = PLAQUE_H - 0.1;
  const shape = owned(new THREE.PlaneGeometry(side, side));
  for (const out of [1, -1]) {
    const icon = put(root, shape, face, 0, PLAQUE_H / 2, out * (BOARD_T / 2 + 0.003));
    icon.rotation.y = out > 0 ? 0 : Math.PI;
    icon.castShadow = false;
  }
  // the lamp on a little socket on top, and its halo, drawn with it
  put(root, owned(new THREE.BoxGeometry(0.14, 0.04, 0.1)), board, 0, PLAQUE_H + 0.02, 0);
  const lamp = put(root, sph(LAMP_R, 14), lampMaterial('unfinished'), 0, PLAQUE_H + 0.04 + LAMP_R * 0.7, 0);
  lamp.castShadow = false;
  const glow = new THREE.Sprite(haloMaterial('working'));
  glow.scale.setScalar(HALO);
  glow.position.copy(lamp.position);
  glow.visible = false;
  root.add(glow);
  // the lamp and halo change with the room, so merging leaves them be
  root.userData = { lamp, halo: glow };
  return { root, lamp, halo: glow };
}

/** Light a sign's lamp for a state: its glass in that state's color, and a halo unless it is not yet switched on. */
export function setLamp(sign: SignPlaque, state: LampState) {
  sign.lamp.material = lampMaterial(state);
  sign.halo.visible = state !== 'unfinished';
  if (sign.halo.visible) sign.halo.material = haloMaterial(state);
}
