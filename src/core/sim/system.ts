// The base every system builds on.

import type { GameState } from '../state/types';
import type { World } from '../world';
import type { Systems } from './systems';

/** One part of the simulation. It can see the game's state, the world and every other system. */
export abstract class System {
  constructor(protected readonly sim: Systems) {}

  /** The game in progress. */
  protected get s(): GameState {
    return this.sim.s;
  }

  /** The tile grid. */
  protected get world(): World {
    return this.sim.world;
  }
}
