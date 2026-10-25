// Snow falling over the lot while a center is snowed in, round flakes drifting down outside, never through the roof
// the game leaves off so its rooms can be seen; and a light snow, a few flakes drifting slower, in a winter's flurries.

import * as THREE from 'three';

import { H, LOT_W } from '../core/data';
import type { Sim } from '../core/sim/sim';
import { hash } from './shared';

/** How many flakes fall at once, how high they start, and how fast they fall, in tiles a second. */
const FLAKES = 2400;
const TOP = 9;
const FALL = 1.2;
/** How many of the flakes fall in a flurry of light snow, and how fast and how big they are. */
const LIGHT_FLAKES = FLAKES / 5;
const LIGHT_FALL = 0.8;
const LIGHT_SIZE = 0.16;
/** How big a flake of heavy snow is. */
const SIZE = 0.2;
/** How far past the edges of the lot the snow reaches, in tiles. */
const MARGIN = 6;
/** How many times a spot that falls inside the building is tried again elsewhere before it is left be. */
const TRIES = 12;

/** Whether a point over the ground is inside the building, where neither snow nor rain falls. */
export type Indoors = (x: number, z: number) => boolean;

/**
 * Where a flake falls from over a map so wide: its spot over the ground, and how far through its fall it starts. Given
 * the building, a spot inside it is tried again elsewhere, so nothing falls on the floors of rooms the game shows with
 * no roof.
 */
export function flakeSpot(i: number, width = LOT_W, indoors?: Indoors): { x: number; z: number; start: number } {
  let x = 0;
  let z = 0;
  for (let k = 0; k < TRIES; k++) {
    x = -MARGIN + hash(i + k * FLAKES, 1) * (width + MARGIN * 2);
    z = -MARGIN + hash(i + k * FLAKES, 2) * (H + MARGIN * 2);
    if (!indoors?.(x, z)) break;
  }
  return { x, z, start: hash(i, 3) };
}

/** How high a flake is at a moment: falling from the top to the ground, then starting again at the top. */
export function flakeHeight(start: number, t: number, fall = FALL): number {
  const through = (start + (t * fall) / TOP) % 1;
  return TOP * (1 - through);
}

/** How the snow looks: how many flakes fall, how fast in tiles a second, and how big each is. */
export interface SnowLook {
  flakes: number;
  fall: number;
  size: number;
}

/**
 * How the snow looks, if any falls: heavy while the center is snowed in, light in a flurry, and none otherwise. Snowed
 * in wins over a flurry.
 */
export function snowLook(snowedIn: boolean, flurrying: boolean): SnowLook | null {
  if (snowedIn) return { flakes: FLAKES, fall: FALL, size: SIZE };
  if (flurrying) return { flakes: LIGHT_FLAKES, fall: LIGHT_FALL, size: LIGHT_SIZE };
  return null;
}

/** Whether a point over the ground is inside the building as the sim has it now. */
export const indoorsOf =
  (sim: Sim): Indoors =>
  (x, z) =>
    sim.world.inside(Math.floor(x), Math.floor(z));

/** A soft round dot, for a flake: full in the middle and fading at its edge, so a flake is round, not square. */
function flakeTexture(): THREE.DataTexture {
  const N = 16;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
      data.set([255, 255, 255, Math.round(255 * THREE.MathUtils.clamp((1 - r) * 3, 0, 1))], (y * N + x) * 4);
    }
  const tex = new THREE.DataTexture(data, N, N);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class SnowfallLayer {
  private flakes: THREE.Points;
  private spots: { x: number; z: number; start: number }[] = [];
  /** The building the spots were laid out round, as the world's version when they were. */
  private laidFor = -1;
  private positions = new Float32Array(FLAKES * 3);

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.flakes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: SIZE,
        map: flakeTexture(),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    // the flakes move every frame, so their bounds are never worked out
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    scene.add(this.flakes);
  }

  /** Let the snow fall while the center is snowed in, or a light snow in a flurry, swaying a little as it comes down. */
  update(t: number) {
    const look = snowLook(this.sim.snowedIn(), this.sim.flurrying());
    this.flakes.visible = !!look;
    if (!look) return;
    // laid out again whenever the building may have grown
    if (this.laidFor !== this.sim.world.version) {
      this.laidFor = this.sim.world.version;
      const indoors = indoorsOf(this.sim);
      this.spots = Array.from({ length: FLAKES }, (_, i) => flakeSpot(i, this.sim.world.w, indoors));
    }
    // a light snow is the first few of the same flakes, so only those move and are drawn
    for (let i = 0; i < look.flakes; i++) {
      const p = this.spots[i];
      if (!p) break;
      this.positions[i * 3] = p.x + Math.sin(t * 0.8 + i) * 0.2;
      this.positions[i * 3 + 1] = flakeHeight(p.start, t, look.fall);
      this.positions[i * 3 + 2] = p.z;
    }
    this.flakes.geometry.setDrawRange(0, look.flakes);
    (this.flakes.material as THREE.PointsMaterial).size = look.size;
    const attr = this.flakes.geometry.getAttribute('position');
    attr.needsUpdate = true;
  }
}
