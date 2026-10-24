// Rings at people's feet for the people overlays, colored by how each is doing and following them as they walk, so the
// overlay marks the person rather than a tile they cover and leave behind; and a red ring under a guest on a really bad
// trip, overlay or not.

import * as THREE from 'three';

import { streetEnds } from '../core/sim/chars';
import type { Sim } from '../core/sim/sim';
import type { Guest, Staff } from '../core/state/types';
import { conditionColor } from './heatmap';
import { drawnAt, streetFade } from './people';

/** How someone is doing, from 0 (badly) to 1 (well), or null to leave them unringed. */
export type HaloValue = (c: Guest | Staff) => number | null;

/** How many rings there is room for at first; more is made when a crowd outgrows it. */
const START = 64;

/** How much bigger the ring under a guest on a really bad trip is than anyone else's. */
const RUNNER_RING = 1.2;

/** How a runner's ring pulses at time `t`, in seconds, as a share of its size: as the ring round whoever is selected. */
export const runnerPulse = (t: number) => 1 + Math.sin(t * 5) * 0.06;

/** Whether someone is a guest on a really bad trip, running about. */
const running = (c: Guest | Staff) => c.kind === 'guest' && c.state === 'running';

/**
 * The ring someone gets: by how they are doing under an overlay, or none; and a guest on a really bad trip always one,
 * bigger and in the bad color, over whatever the overlay says, so a runner can be found from any view.
 */
export function haloOf(c: Guest | Staff, value: HaloValue | null): { v: number; scale: number } | null {
  if (running(c)) return { v: 0, scale: RUNNER_RING };
  const v = value ? value(c) : null;
  return v === null ? null : { v, scale: 1 };
}

export class HalosLayer {
  /** The rings as they show on the floor, and the same rings faintly through whatever stands over them. */
  private mesh: THREE.InstancedMesh;
  private through: THREE.InstancedMesh;
  private value: HaloValue | null = null;
  private color = new THREE.Color();
  private matrix = new THREE.Matrix4();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {
    [this.mesh, this.through] = this.build(START);
  }

  /** Ring people by how they are doing, or clear the rings with null, leaving any runner's. */
  set(value: HaloValue | null) {
    this.value = value;
    if (!value) this.mesh.visible = this.through.visible = false;
  }

  /**
   * Put a ring at the feet of everyone the overlay covers, and of anyone on a really bad trip, as they stand this frame:
   * a runner's pulsing, at time `t` in seconds.
   */
  update(t = performance.now() / 1000) {
    const value = this.value;
    const s = this.sim.s;
    // with no overlay open, only a runner is ringed, and hardly ever is anyone running
    if (!value && !s.guests.some((g) => g.state === 'running')) {
      this.mesh.visible = this.through.visible = false;
      return;
    }
    const ends = streetEnds(this.sim.world.building, this.sim.world.w);
    const people = [...s.guests, ...s.staff];
    if (people.length > this.mesh.instanceMatrix.count) this.grow(people.length);
    let n = 0;
    for (const c of people) {
      if (c.kind === 'staff' && c.state === 'away') continue;
      const halo = haloOf(c, value);
      if (!halo) continue;
      const size = streetFade(c.x, c.y, ends) * halo.scale * (running(c) ? runnerPulse(t) : 1);
      if (size <= 0.02) continue;
      // under them as they are drawn, climbing on or off something or stepping aside
      const d = drawnAt.get(c.id);
      this.matrix.makeScale(size, 1, size).setPosition(d?.x ?? c.x, (d?.y ?? c.h) + 0.03, d?.z ?? c.y);
      this.mesh.setMatrixAt(n, this.matrix);
      this.mesh.setColorAt(n, conditionColor(halo.v, this.color));
      n++;
    }
    this.mesh.count = this.through.count = n;
    this.mesh.visible = this.through.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    // the faint pass shares the rings, colors included, once there are colors to share
    this.through.instanceColor = this.mesh.instanceColor;
  }

  /**
   * Two batches of rings with room for this many, sharing their places: one drawn as it lies, and one faintly over
   * anything in front of it, so a ring under a desk or a body still shows.
   */
  private build(room: number): [THREE.InstancedMesh, THREE.InstancedMesh] {
    // a broad band, so it still reads when zoomed right out
    const ring = new THREE.RingGeometry(0.3, 0.56, 32).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(
      ring,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }),
      room,
    );
    const through = new THREE.InstancedMesh(
      ring,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
      room,
    );
    through.instanceMatrix = mesh.instanceMatrix;
    for (const m of [mesh, through]) {
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
    }
    // over the floor's overlay, under the selection ring
    mesh.renderOrder = 2;
    through.renderOrder = 2;
    return [mesh, through];
  }

  /** Make room for at least this many rings. */
  private grow(least: number) {
    let room = this.mesh.instanceMatrix.count;
    while (room < least) room *= 2;
    this.mesh.geometry.dispose();
    for (const m of [this.mesh, this.through]) {
      this.scene.remove(m);
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
    [this.mesh, this.through] = this.build(room);
  }
}
