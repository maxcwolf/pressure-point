// A layer of colored tiles over the floor for the overlays: red where things are bad, through amber, to green.

import * as THREE from 'three';

import { H, W } from '../core/data';
import { at } from '../core/util';

/** A floor tile and how good things are there, from 0 to 1. */
export type HeatTile = [x: number, y: number, value: number];

const BAD = new THREE.Color(0xe5484d);
const MIDDLING = new THREE.Color(0xf5b83d);
const GOOD = new THREE.Color(0x3fbf6f);

/** The color for a value from 0 (bad) to 1 (good). */
export function heatColor(value: number, out = new THREE.Color()): THREE.Color {
  const v = Math.max(0, Math.min(1, value));
  return v < 0.5 ? out.lerpColors(BAD, MIDDLING, v * 2) : out.lerpColors(MIDDLING, GOOD, (v - 0.5) * 2);
}

/** Tiles colored by how good things are on each, drawn just above the floor and under everything else. */
export class Heatmap {
  private mesh: THREE.InstancedMesh;
  private color = new THREE.Color();
  private matrix = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.62, depthWrite: false }),
      W * H,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  /** Color these tiles, or clear the layer. */
  set(tiles: readonly HeatTile[] | null) {
    const list = tiles ?? [];
    const n = Math.min(list.length, W * H);
    for (let i = 0; i < n; i++) {
      const [x, y, v] = at(list, i);
      this.matrix.makeTranslation(x + 0.5, 0.02, y + 0.5);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, heatColor(v, this.color));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
