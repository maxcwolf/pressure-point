// What moves outdoors on its own, apart from the game: the wind in the trees and the grass (`wind.ts`), and the small
// life on the lot (`life.ts`). Each is behind its own switch; with both off this does nothing.

import type * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { LifeLayer } from './life';
import { raining } from './rain';
import { blow, WIND } from './wind';

export class OutdoorsLayer {
  /** The small life outdoors, or null with the `life` switch off or when the player asks for less motion. */
  private life: LifeLayer | null;

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    this.life = LifeLayer.make(scene, sim);
  }

  /** Move the wind's clock on, and the life outdoors, to `t` seconds of real time, `dt` since the last frame. */
  update(t: number, dt: number) {
    if (WIND) blow(t, dt, raining(this.sim));
    this.life?.update(t, dt);
  }
}
