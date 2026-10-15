// Snow falling over the lot while a center is snowed in.

import * as THREE from 'three';

import { H, W } from '../core/data';
import type { Sim } from '../core/sim/sim';
import { hash } from './shared';

/** How many flakes fall at once, how high they start, and how fast they fall, in tiles a second. */
const FLAKES = 2400;
const TOP = 9;
const FALL = 1.2;
/** How far past the edges of the lot the snow reaches, in tiles. */
const MARGIN = 6;

/** Where a flake falls from: its spot over the ground, and how far through its fall it starts. */
export function flakeSpot(i: number): { x: number; z: number; start: number } {
  return {
    x: -MARGIN + hash(i, 1) * (W + MARGIN * 2),
    z: -MARGIN + hash(i, 2) * (H + MARGIN * 2),
    start: hash(i, 3),
  };
}

/** How high a flake is at a moment: falling from the top to the ground, then starting again at the top. */
export function flakeHeight(start: number, t: number): number {
  const through = (start + (t * FALL) / TOP) % 1;
  return TOP * (1 - through);
}

export class SnowfallLayer {
  private flakes: THREE.Points;
  private spots = Array.from({ length: FLAKES }, (_, i) => flakeSpot(i));
  private positions = new Float32Array(FLAKES * 3);

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.flakes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    // the flakes move every frame, so their bounds are never worked out
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    scene.add(this.flakes);
  }

  /** Let the snow fall while the center is snowed in, swaying a little as it comes down. */
  update(t: number) {
    this.flakes.visible = this.sim.snowedIn();
    if (!this.flakes.visible) return;
    this.spots.forEach((p, i) => {
      this.positions[i * 3] = p.x + Math.sin(t * 0.8 + i) * 0.2;
      this.positions[i * 3 + 1] = flakeHeight(p.start, t);
      this.positions[i * 3 + 2] = p.z;
    });
    const attr = this.flakes.geometry.getAttribute('position');
    attr.needsUpdate = true;
  }
}
