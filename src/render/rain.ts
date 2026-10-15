// Rain slanting down over the lot while a storm blows.

import * as THREE from 'three';

import { mishapOn } from '../core/sim/mishaps';
import type { Sim } from '../core/sim/sim';
import { flakeHeight, flakeSpot } from './snowfall';

/** How many drops fall at once, how fast, in tiles a second, how long each streak is, and how far the wind blows it. */
const DROPS = 1600;
export const RAIN_FALL = 16;
const STREAK = 0.55;
const SLANT = 0.3;

/** The two ends of a drop's streak at a moment, as x, y and z of its foot and then of its tail. */
export function dropLine(i: number, t: number): [number, number, number, number, number, number] {
  const p = flakeSpot(i);
  const y = flakeHeight(p.start, t, RAIN_FALL);
  return [p.x, y, p.z, p.x - STREAK * SLANT, y + STREAK, p.z];
}

/** Whether it is raining: while a storm blows. */
export const raining = (sim: Sim) => mishapOn(sim.s)?.id === 'storm';

export class RainLayer {
  private drops: THREE.LineSegments;
  private positions = new Float32Array(DROPS * 6);

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.drops = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0xaebfd0, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    // the drops move every frame, so their bounds are never worked out
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    scene.add(this.drops);
  }

  /** Let the rain fall while a storm blows. */
  update(t: number) {
    this.drops.visible = raining(this.sim);
    if (!this.drops.visible) return;
    for (let i = 0; i < DROPS; i++) this.positions.set(dropLine(i, t), i * 6);
    this.drops.geometry.getAttribute('position').needsUpdate = true;
  }
}
