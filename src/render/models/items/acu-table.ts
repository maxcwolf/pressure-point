// The Acupuncture Table model.

import * as THREE from 'three';

import { at } from '../../../core/util';
import { linensMaterial } from '../linens';
import { capsule, CHROME, CREAM, cyl, GLASS, LACQUER, mat, partsOf, put, rbox, soft, sph } from '../parts';

/** Build the Acupuncture Table model. */
export function buildAcuTable(g: THREE.Group) {
  for (const [x, z] of [
    [-0.3, -0.75],
    [0.3, -0.75],
    [-0.3, 0.75],
    [0.3, 0.75],
  ])
    put(g, soft(0.09, 0.5, 0.09), mat(LACQUER), x, 0.25, z);
  put(g, soft(0.8, 0.07, 1.82), mat(LACQUER), 0, 0.5, 0);
  put(g, rbox(0.74, 0.12, 1.76, 0.06), mat(0x9ad0b8), 0, 0.58, 0);
  const linens = linensMaterial(CREAM);
  put(g, rbox(0.7, 0.03, 1.1, 0.015), linens, 0, 0.645, 0.2);
  const bolster = put(g, capsule(0.09, 0.44), mat(0xb5523e), 0, 0.68, -0.72);
  bolster.rotation.z = Math.PI / 2;
  // what gets put on the guest's back, one set per technique
  /** Stand one needle with a colored tip at a spot. */
  const needle = (parent: THREE.Object3D, x: number, z: number, color: number) => {
    put(parent, cyl(0.01, 0.01, 0.16, 6), mat(CHROME, 0.3), x, 1.0, z).castShadow = false;
    put(parent, sph(0.024, 8), mat(color, 0.4), x, 1.08, z).castShadow = false;
  };
  const spots: [number, number][] = [
    [-0.07, -0.2],
    [0.07, -0.2],
    [-0.08, -0.05],
    [0.08, -0.05],
    [-0.07, 0.1],
    [0.07, 0.1],
    [-0.05, 0.25],
    [0.05, 0.25],
  ];
  const needles = new THREE.Group();
  spots.forEach(([x, z], i) => needle(needles, x, z, at([0xe5484d, 0xf2c14e, 0x4a9fe0], i % 3)));
  const cups = new THREE.Group();
  for (const [x, z] of spots.slice(0, 6)) {
    const cup = put(cups, sph(0.062, 12), GLASS, x, 0.95, z);
    cup.scale.y = 0.8;
    cup.castShadow = false;
  }
  const moxa = new THREE.Group();
  for (const [x, z] of [
    [0, -0.18],
    [0, 0.02],
    [0, 0.22],
  ]) {
    put(moxa, cyl(0.018, 0.03, 0.09, 8), mat(0x6b5a3a, 0.9), x, 0.97, z).castShadow = false;
    put(moxa, sph(0.022, 8), mat(0xff7a2f, 0.4, 1.2), x, 1.02, z).castShadow = false;
  }
  const electro = new THREE.Group();
  spots.slice(0, 4).forEach(([x, z], i) => {
    needle(electro, x, z, i % 2 ? 0x2a2a2e : 0xe5484d);
    const wire = put(electro, cyl(0.01, 0.01, 0.5, 6), mat(i % 2 ? 0x2a2a2e : 0xe5484d), x - 0.25, 1.1, z);
    wire.rotation.z = Math.PI / 2 - 0.12;
    wire.castShadow = false;
  });
  const session = { needling: needles, cupping: cups, moxa, electro };
  for (const group of Object.values(session)) {
    group.visible = false;
    g.add(group);
  }
  partsOf(g).session = session;
  partsOf(g).linens = linens;
}
