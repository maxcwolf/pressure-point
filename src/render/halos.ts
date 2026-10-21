// Rings at people's feet for the people overlays, colored by how each is doing and following them as they walk, so the
// overlay marks the person rather than a tile they cover and leave behind.

import * as THREE from 'three';

import { streetEnds } from '../core/sim/chars';
import type { Sim } from '../core/sim/sim';
import type { Guest, Staff } from '../core/state/types';
import { conditionColor } from './heatmap';
import { streetFade } from './people';

/** How someone is doing, from 0 (badly) to 1 (well), or null to leave them unringed. */
export type HaloValue = (c: Guest | Staff) => number | null;

/** How many rings there is room for at first; more is made when a crowd outgrows it. */
const START = 64;

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

  /** Ring people by how they are doing, or clear the rings with null. */
  set(value: HaloValue | null) {
    this.value = value;
    if (!value) this.mesh.visible = this.through.visible = false;
  }

  /** Put a ring at the feet of everyone the overlay covers, as they stand this frame. */
  update() {
    const value = this.value;
    if (!value) return;
    const s = this.sim.s;
    const ends = streetEnds(this.sim.world.building, this.sim.world.w);
    const people = [...s.guests, ...s.staff];
    if (people.length > this.mesh.instanceMatrix.count) this.grow(people.length);
    let n = 0;
    for (const c of people) {
      if (c.kind === 'staff' && c.state === 'away') continue;
      const v = value(c);
      if (v === null) continue;
      const size = streetFade(c.x, c.y, ends);
      if (size <= 0.02) continue;
      this.matrix.makeScale(size, 1, size).setPosition(c.x, c.h + 0.03, c.y);
      this.mesh.setMatrixAt(n, this.matrix);
      this.mesh.setColorAt(n, conditionColor(v, this.color));
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
