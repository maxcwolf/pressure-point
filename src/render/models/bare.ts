// A guest on a really bad trip has nothing on: their clothes go to their own skin, smooth as a doll's with nothing
// modeled, and blocks of gray pixel mosaic cover what a television would hide. The mosaic is a sprite, so it faces the camera
// from every turn; it is drawn a little in front of the body toward the camera, so the body never hides it, and kept big
// enough to read as the camera pulls back, as a speech bubble is. All of it is made the first time someone strips, and
// put away again when they are calmed down.

import * as THREE from 'three';

import { floorScale, pixelsPerMeter } from '../readable';
import type { CharRig } from './character';
import { bareForearm, bareTorso, bareUpperArm } from './character-detail';

/**
 * How big each block of the mosaic is, in meters: about four across the groin, big enough to see as blocks close up and
 * small enough to read as a mosaic at the game's distance. Gray reads as censored on every skin; shades of the skin, and
 * blocks half as big again, were tried and turned down (Max, 1 November 2026).
 */
const BLOCK = 0.055;

/** Where each censor sits on the torso, measured from the hips, and how big it is across and up, in meters. */
const GROIN = { y: -0.06, w: 0.27, h: 0.24 };
const CHEST = { y: 0.27, w: 0.34, h: 0.12 };

/** How far toward the camera a censor is drawn, so the body round it never hides it: a little more than its depth. */
const NUDGE = 0.21;

/** The least a censor covers on screen, up and down, in pixels, as the camera pulls back (but see `MAX_GROWTH`). */
const CENSOR_PX = 20;

/** How far round to the back the camera may be before a censor on the chest is put away: there is nothing to hide. */
const BEHIND = -0.25;

/** The colors of the mosaic's blocks, as a television blurs: grays with a little warmth. */
const GRAYS = [0x9a9089, 0xb7aca3, 0xd2c8bf, 0x7f7670, 0xc4b8ae];

/** What a person with nothing on remembers: what each part wore, and the censors over them. */
export interface Bare {
  on: boolean;
  swaps: Swap[];
  censors: THREE.Sprite[];
}

/** A part of someone that changes as they strip: to skin, to the shape of what is under it, or out of sight. */
interface Swap {
  mesh: THREE.Mesh;
  dressed: THREE.Material;
  skin: THREE.Material;
  shape: THREE.BufferGeometry;
  /** Its shape with nothing on, or null if it goes. */
  bare: THREE.BufferGeometry | null;
}

/** A number from 0 to 1 for a block of a mosaic, the same every time, so the pattern looks scattered but never changes. */
function scatter(i: number, j: number) {
  let h = Math.imul(i + 1, 0x27d4eb2d) ^ Math.imul(j + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 2 ** 32;
}

/** Which of so many colors each block of a mosaic is, row by row, none the same as the block beside it or below it. */
function blockColors(across: number, up: number, count: number): number[] {
  const picks: number[] = [];
  for (let j = 0; j < up; j++)
    for (let i = 0; i < across; i++) {
      const near = [i > 0 ? picks[j * across + i - 1] : -1, j > 0 ? picks[(j - 1) * across + i] : -1];
      let k = Math.floor(scatter(i, j) * count);
      while (near.includes(k)) k = (k + 1) % count;
      picks.push(k);
    }
  return picks;
}

const mosaics = new Map<string, THREE.DataTexture>();

/** A mosaic of so many blocks across and up, one texel each: made once, and shared by everyone. */
function mosaicTexture(across: number, up: number) {
  const key = `${across}x${up}`;
  const made = mosaics.get(key);
  if (made) return made;
  const data = new Uint8Array(across * up * 4);
  const picks = blockColors(across, up, GRAYS.length);
  for (let j = 0; j < up; j++)
    for (let i = 0; i < across; i++) {
      const gray = GRAYS[picks[j * across + i] ?? 0] ?? 0xb7aca3;
      data.set([gray >> 16, (gray >> 8) & 255, gray & 255, 255], (j * across + i) * 4);
    }
  const texture = new THREE.DataTexture(data, across, up);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  mosaics.set(key, texture);
  return texture;
}

const materials = new Map<string, THREE.SpriteMaterial>();

/** The material for a mosaic of so many blocks: with nothing of the wearer's in it, shared by everyone too. */
function mosaicMaterial(across: number, up: number) {
  const key = `${across}x${up}`;
  const made = materials.get(key) ?? new THREE.SpriteMaterial({ map: mosaicTexture(across, up) });
  materials.set(key, made);
  return made;
}

const world = new THREE.Vector3();
const eye = new THREE.Vector3();
const toward = new THREE.Vector3();
const forward = new THREE.Vector3();
const page = new THREE.Vector2();

/**
 * A censor of mosaic over the torso at a height, as near its size as whole blocks make it, facing the camera. Just as it
 * is drawn it is moved toward the camera, grown if the camera is far, and on the chest put away if seen from behind.
 */
function censor(torso: THREE.Object3D, at: typeof GROIN, chest: boolean) {
  const across = Math.max(2, Math.round(at.w / BLOCK));
  const up = Math.max(2, Math.round(at.h / BLOCK));
  const sprite = new THREE.Sprite(mosaicMaterial(across, up));
  sprite.name = 'censor';
  const home = new THREE.Vector3(0, at.y, 0);
  const size = new THREE.Vector3(across * BLOCK, up * BLOCK, 1);
  sprite.position.copy(home);
  sprite.scale.copy(size);
  /** Bring the censor out in front of the body toward the camera, and grow it if it would be too small to read. */
  sprite.onBeforeRender = (renderer, _scene, camera) => {
    sprite.getWorldPosition(world);
    eye.setFromMatrixPosition(camera.matrixWorld);
    toward.subVectors(eye, world).normalize();
    const scale = torso.matrixWorld.getMaxScaleOnAxis();
    const seen = !chest || forward.setFromMatrixColumn(torso.matrixWorld, 2).normalize().dot(toward) > BEHIND;
    const perMeter =
      camera instanceof THREE.PerspectiveCamera
        ? pixelsPerMeter(camera.fov, eye.distanceTo(world), renderer.getSize(page).y)
        : Infinity;
    const grown = seen ? floorScale(size.y * scale, perMeter, CENSOR_PX) : 0;
    sprite.position.copy(torso.worldToLocal(world.addScaledVector(toward, NUDGE * scale)));
    sprite.scale.copy(size).multiplyScalar(grown);
    sprite.updateMatrixWorld();
  };
  /** Put it back where it belongs once drawn. */
  sprite.onAfterRender = () => {
    sprite.position.copy(home);
    sprite.scale.copy(size);
    sprite.updateMatrixWorld();
  };
  torso.add(sprite);
  return sprite;
}

/**
 * What a part of someone is with nothing on: the shirt the body under it, with no collar; the sleeve on the upper arm
 * the arm, and the one on the forearm gone, the hand below it taking the bare forearm, unless a symptom has the hand;
 * the trousers and shoes the legs and feet, and biceps bulging through the sleeves bare biceps, as they are. Undefined for a part that does not change.
 */
function bareShape(mesh: THREE.Mesh, torso: THREE.Object3D): THREE.BufferGeometry | null | undefined {
  const fore = mesh.parent;
  const side = Math.sign(fore?.parent?.position.x ?? 1);
  const handShown = fore?.getObjectByName('hand')?.visible ?? false;
  if (mesh.name === 'shirt') return bareTorso();
  if (mesh.name === 'trousers' || mesh.name === 'shoe' || mesh.name === 'muscle') return mesh.geometry;
  if (mesh.name === 'sleeve') return fore?.parent === torso ? bareUpperArm() : handShown ? null : mesh.geometry;
  if (mesh.name === 'hand' && mesh.visible) return bareForearm(side);
  return undefined;
}

/** Make what someone needs to go without their clothes: their skin for each part, and the censors, put away for now. */
function strip(rig: CharRig, chest: boolean): Bare {
  const hand = rig.body.getObjectByName('hand') as THREE.Mesh | undefined;
  const skin = (hand?.material ?? rig.headMesh.material) as THREE.MeshStandardMaterial;
  const swaps: Swap[] = [];
  rig.body.traverse((o) => {
    if (!(o as Partial<THREE.Mesh>).isMesh) return;
    const mesh = o as THREE.Mesh;
    const bare = bareShape(mesh, rig.torso);
    if (bare === undefined) return;
    swaps.push({ mesh, dressed: mesh.material as THREE.Material, skin, shape: mesh.geometry, bare });
  });
  const censors = [censor(rig.torso, GROIN, false)];
  if (chest) censors.push(censor(rig.torso, CHEST, true));
  for (const c of censors) c.visible = false;
  return { on: false, swaps, censors };
}

/**
 * Take someone's clothes off, or put them back on: off, their clothes go to their skin, smooth, and the mosaic goes
 * over the groin, and over the chest if `chest`. Does nothing if they are already as asked.
 */
export function showBare(rig: CharRig, on: boolean, chest: boolean) {
  if ((rig.bare?.on ?? false) === on) return;
  rig.bare ??= strip(rig, chest);
  rig.bare.on = on;
  for (const s of rig.bare.swaps) {
    s.mesh.material = on ? s.skin : s.dressed;
    if (s.bare) s.mesh.geometry = on ? s.bare : s.shape;
    else s.mesh.visible = !on;
  }
  for (const c of rig.bare.censors) c.visible = on;
}
