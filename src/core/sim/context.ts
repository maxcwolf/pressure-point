// What every part of the simulation works on.

import { H, W } from '../data';
import type { GameState } from '../state/types';
import { World } from '../world';
import type { SimEvent } from './events';

/** The game in progress and the working data kept alongside it. Every simulation function takes one. */
export interface SimContext {
  /** The game's state: everything that is saved. */
  readonly s: GameState;
  /** The tile grid built from that state. */
  readonly world: World;
  /** Things waiting to be shown or played by the interface. */
  events: SimEvent[];
  /** How pleasant each tile is, from nearby decor and litter. */
  readonly attract: Float32Array;
}

/** Set up the working data for a game. */
export function createContext(s: GameState): SimContext {
  return { s, world: new World(s), events: [], attract: new Float32Array(W * H) };
}
