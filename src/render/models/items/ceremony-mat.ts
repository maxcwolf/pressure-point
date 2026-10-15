// The Ceremony Mat model: a woven mat and a blanket on the floor, a cushion beside it for the Shaman, and what each
// ceremony brings over the guest while it goes on.

import * as THREE from 'three';

import { at } from '../../../core/util';
import { linensMaterial } from '../linens';
import { cyl, mat, partsOf, put, rbox, sph } from '../parts';

/** The colors a psychedelic ceremony swirls in. */
const TRIP_COLORS = [0xe5484d, 0xf2c14e, 0x3bb273, 0x4a9fe0, 0x9b6fd1, 0xf08ac0];

/** A ring of glowing orbs over the guest, each a color of the trip, that the view turns while the ceremony goes on. */
function swirl(count: number, radius: number, size: number, y: number): THREE.Group {
  const ring = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const orb = put(ring, sph(size, 10), mat(at(TRIP_COLORS, i % TRIP_COLORS.length), 0.3, 1.1));
    orb.position.set(Math.cos(a) * radius, Math.sin(i * 1.7) * 0.05, Math.sin(a) * radius);
    orb.castShadow = false;
  }
  ring.position.y = y;
  return ring;
}

/** Build the Ceremony Mat model. */
export function buildCeremonyMat(g: THREE.Group) {
  // the woven mat, striped at either end, and a rolled blanket for a pillow
  put(g, rbox(0.8, 0.05, 1.86, 0.02), mat(0xc9a66b, 0.95), 0, 0.025, 0);
  for (const z of [-0.82, 0.82]) put(g, rbox(0.8, 0.052, 0.08, 0.01), mat(0x8a3b2a, 0.9), 0, 0.027, z);
  const linens = linensMaterial(0xc96a3a);
  put(g, rbox(0.7, 0.04, 1.0, 0.02), linens, 0, 0.07, 0.36);
  const pillow = put(g, cyl(0.08, 0.08, 0.56, 14), mat(0x3f6b5a, 0.9), 0, 0.1, -0.74);
  pillow.rotation.z = Math.PI / 2;
  // the Shaman's cushion, beside the mat
  put(g, cyl(0.2, 0.22, 0.08, 16), mat(0x8a4b2a, 0.9), -0.8, 0.04, 0);

  // a spirit animal, glowing softly over the guest while it is read
  const reading = new THREE.Group();
  const ghost = mat(0x9fd6f0, 0.3, 0.9);
  put(reading, sph(0.12, 12), ghost, 0, 0, 0).scale.set(1.4, 0.8, 0.8);
  put(reading, sph(0.08, 12), ghost, 0.17, 0.07, 0);
  for (const z of [-0.04, 0.04]) put(reading, sph(0.025, 8), ghost, 0.17, 0.14, z);
  put(reading, cyl(0.02, 0.035, 0.18, 8), ghost, -0.2, 0.02, 0).rotation.z = 1.2;
  reading.position.y = 0.95;
  // the little dark cloud pulled out of them, with a pair of startled eyes
  const cloud = new THREE.Group();
  for (const [x, y, r] of [
    [-0.08, 0, 0.08],
    [0.02, 0.04, 0.1],
    [0.11, 0, 0.07],
  ] as const)
    put(cloud, sph(r, 10), mat(0x2b2833, 0.9), x, y, 0);
  for (const x of [-0.03, 0.06]) put(cloud, sph(0.022, 8), mat(0xffffff, 0.4), x, 0.05, 0.08);
  const extraction = new THREE.Group();
  extraction.add(cloud);
  // steam rising off a guest in the sweat lodge
  const steam = new THREE.Group();
  for (let i = 0; i < 4; i++) put(steam, sph(0.08, 8), mat(0xffffff, 0.9, 0.25), (i - 1.5) * 0.12, 0, 0.1 * i - 0.15);
  steam.position.y = 0.3;
  const sweat = new THREE.Group();
  sweat.add(steam);
  // colors swirling over the guest on a trip: a ring for mushrooms, and a bigger double ring for ayahuasca
  const mushroom = new THREE.Group();
  const shrooms = swirl(6, 0.32, 0.05, 0.7);
  mushroom.add(shrooms);
  const ayahuasca = new THREE.Group();
  const outer = swirl(9, 0.48, 0.055, 0.75);
  const inner = swirl(6, 0.24, 0.045, 0.95);
  ayahuasca.add(outer, inner);
  const session = { reading, extraction, sweat, mushroom, ayahuasca };
  for (const group of Object.values(session)) {
    group.visible = false;
    for (const o of group.children) o.castShadow = false;
    g.add(group);
  }
  partsOf(g).session = session;
  partsOf(g).ceremony = { spirit: reading, cloud, steam, swirls: [shrooms, outer, inner] };
  partsOf(g).linens = linens;
}
