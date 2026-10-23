// A new item settling into place as it is put down: a quick squash as it lands, then back to its own shape, so a
// placement reads as done.

import type * as THREE from 'three';

/** How long a settle takes, in seconds. */
export const SETTLE_SECONDS = 0.15;
/** How far a settling item squashes down at the most, as a share of its height. */
const SQUASH = 0.14;

/** How much a settling item is squashed `age` seconds after it lands: [across, up] as scales of its own shape. */
export function settleScale(age: number): [across: number, up: number] {
  const f = Math.min(1, Math.max(0, age / SETTLE_SECONDS));
  const dip = Math.sin(Math.PI * f) * SQUASH;
  return [1 + dip / 2, 1 - dip];
}

/** The items settling into place, each squashed a little less each frame until it is back to its own shape. */
export class Settling {
  private list: { model: THREE.Object3D; base: THREE.Vector3; age: number }[] = [];

  /** Start an item settling, from the shape it has now. */
  add(model: THREE.Object3D) {
    this.list.push({ model, base: model.scale.clone(), age: 0 });
  }

  /** How many items are settling now. */
  get count(): number {
    return this.list.length;
  }

  /** Move every settling item a frame of `dt` seconds on, putting each back to its own shape once it has settled. */
  update(dt: number) {
    this.list = this.list.filter((s) => {
      s.age += dt;
      const [across, up] = settleScale(s.age);
      s.model.scale.set(s.base.x * across, s.base.y * up, s.base.z * across);
      return s.age < SETTLE_SECONDS;
    });
  }
}
