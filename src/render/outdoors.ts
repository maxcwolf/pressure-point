// What moves outdoors on its own, apart from the game, while the scene is drawn Full: the wind in the trees and the
// grass (`wind.ts`), and the small life on the lot (`life.ts`). Drawn Plain, the outdoors stands still and empty.

import type * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { fancy } from './fx';
import { LifeLayer } from './life';
import { raining } from './rain';
import { blow } from './wind';

export class OutdoorsLayer {
  /** The small life outdoors, made the first time the scene is drawn Full. */
  private life: LifeLayer | null = null;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** Move the wind's clock on, and the life outdoors, to `t` seconds of real time, `dt` since the last frame. */
  update(t: number, dt: number) {
    const full = fancy();
    if (full) {
      blow(t, dt, raining(this.sim));
      this.life ??= new LifeLayer(this.scene, this.sim);
    }
    this.life?.update(t, dt, full);
  }
}
