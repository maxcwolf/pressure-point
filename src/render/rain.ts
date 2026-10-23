// Rain slanting down over the lot while a storm blows, outside the building, never through the roof the game leaves
// off so its rooms can be seen.

import * as THREE from 'three';

import { mishapOn } from '../core/sim/mishaps';
import type { Sim } from '../core/sim/sim';
import { flakeHeight, flakeSpot, type Indoors, indoorsOf } from './snowfall';

/** How many drops fall at once, how fast, in tiles a second, how long each streak is, and how far the wind blows it. */
const DROPS = 1600;
export const RAIN_FALL = 16;
const STREAK = 0.55;
const SLANT = 0.3;
/**
 * How wide a streak is, in meters: a ribbon, not a line a pixel wide whatever the zoom, so the rain reads at the
 * game's usual distance and thickens as the camera comes in.
 */
export const DROP_W = 0.035;

/** The two ends of a drop's streak at a moment over a map so wide, as x, y and z of its foot and then of its tail. */
export function dropLine(
  i: number,
  t: number,
  width?: number,
  indoors?: Indoors,
): [number, number, number, number, number, number] {
  const p = flakeSpot(i, width, indoors);
  const y = flakeHeight(p.start, t, RAIN_FALL);
  return [p.x, y, p.z, p.x - STREAK * SLANT, y + STREAK, p.z];
}

/** Whether it is raining: while a storm blows. */
export const raining = (sim: Sim) => mishapOn(sim.s)?.id === 'storm';

/**
 * The corners of a drop's two ribbons, crossed so one or the other faces the camera from whichever side it looks: one
 * across the map and one down it, each as wide as `DROP_W` about the streak.
 */
function ribbons(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  out: Float32Array,
  at: number,
) {
  const w = DROP_W / 2;
  // prettier-ignore
  out.set(
    [
      x0 - w, y0, z0, x0 + w, y0, z0, x1 + w, y1, z1, x1 - w, y1, z1,
      x0, y0, z0 - w, x0, y0, z0 + w, x1, y1, z1 + w, x1, y1, z1 - w,
    ],
    at,
  );
}

export class RainLayer {
  private drops: THREE.Mesh;
  private positions = new Float32Array(DROPS * 8 * 3);
  /** Each drop's spot, laid out round the building as it stood at the world's version `laidFor`. */
  private laidFor = -1;
  private spots: { x: number; z: number; start: number }[] = [];

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    // two quads a drop, each two triangles
    const index: number[] = [];
    for (let d = 0; d < DROPS * 2; d++) {
      const v = d * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    geo.setIndex(index);
    this.drops = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xaebfd0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    // the drops move every frame, so their bounds are never worked out
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    /** The rain is not there to be clicked: a click goes through it. */
    this.drops.raycast = () => undefined;
    scene.add(this.drops);
  }

  /** Let the rain fall while a storm blows. */
  update(t: number) {
    this.drops.visible = raining(this.sim);
    if (!this.drops.visible) return;
    // laid out again whenever the building may have grown
    if (this.laidFor !== this.sim.world.version) {
      this.laidFor = this.sim.world.version;
      const indoors = indoorsOf(this.sim);
      this.spots = Array.from({ length: DROPS }, (_, i) => flakeSpot(i, this.sim.world.w, indoors));
    }
    this.spots.forEach((p, i) => {
      const y = flakeHeight(p.start, t, RAIN_FALL);
      ribbons(p.x, y, p.z, p.x - STREAK * SLANT, y + STREAK, p.z, this.positions, i * 24);
    });
    this.drops.geometry.getAttribute('position').needsUpdate = true;
  }
}
