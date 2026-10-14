// The Reiki Table model.

import * as THREE from 'three';

import { at } from '../../../core/util';
import { cyl, mat, partsOf, put, rbox, sph, torus, WOOD } from '../parts';

/** Pale purple quartz, a little see-through. */
const QUARTZ = new THREE.MeshStandardMaterial({
  color: 0xd9c8f5,
  roughness: 0.15,
  transparent: true,
  opacity: 0.85,
  emissive: 0x9b7fd1,
  emissiveIntensity: 0.35,
});

/** The colors of the seven chakras, from the root up to the crown. */
const CHAKRAS = [0xe5484d, 0xf08a4b, 0xf2c14e, 0x3bb273, 0x4a9fe0, 0x5b5fc7, 0x9b6fd1];

/** Build the Reiki Table model. */
export function buildReikiTable(g: THREE.Group) {
  for (const [x, z] of [
    [-0.3, -0.75],
    [0.3, -0.75],
    [-0.3, 0.75],
    [0.3, 0.75],
  ])
    put(g, rbox(0.09, 0.5, 0.09, 0.02), mat(WOOD), x, 0.25, z);
  put(g, rbox(0.8, 0.07, 1.82, 0.03), mat(WOOD), 0, 0.5, 0);
  put(g, rbox(0.76, 0.14, 1.78, 0.07), mat(0xc9b6e4), 0, 0.59, 0);
  // a folded blanket over the foot, and a round pillow at the head
  put(g, rbox(0.78, 0.05, 0.5, 0.02), mat(0x7a5aa8), 0, 0.68, 0.6);
  const pillow = put(g, cyl(0.1, 0.1, 0.5, 14), mat(0xf5ecdb), 0, 0.72, -0.72);
  pillow.rotation.z = Math.PI / 2;

  // what goes on or over the guest, one set per technique
  const usui = new THREE.Group();
  const glow = put(usui, torus(0.2, 0.025), mat(0xf7e7a8, 0.3, 1.4), 0, 1.15, 0);
  glow.rotation.x = Math.PI / 2;
  glow.castShadow = false;
  const crystal = new THREE.Group();
  for (const [x, z] of [
    [0, -0.25],
    [-0.09, -0.08],
    [0.09, -0.08],
    [0, 0.08],
    [0, 0.25],
  ]) {
    const point = put(crystal, cyl(0.002, 0.032, 0.11, 6), QUARTZ, x, 0.99, z);
    point.castShadow = false;
  }
  const sound = new THREE.Group();
  const bowl = put(sound, sph(0.08, 14), mat(0xc9963f, 0.3), 0, 0.97, 0);
  bowl.scale.y = 0.55;
  bowl.castShadow = false;
  put(sound, torus(0.08, 0.008), mat(0x8a6420, 0.3), 0, 1.0, 0).rotation.x = Math.PI / 2;
  const chakra = new THREE.Group();
  CHAKRAS.forEach((_, i) => {
    put(chakra, sph(0.026, 8), mat(at(CHAKRAS, i), 0.3, 0.9), 0, 0.97, 0.3 - i * 0.09).castShadow = false;
  });
  const session = { usui, crystal, sound, chakra };
  for (const group of Object.values(session)) {
    group.visible = false;
    g.add(group);
  }
  partsOf(g).session = session;
}
