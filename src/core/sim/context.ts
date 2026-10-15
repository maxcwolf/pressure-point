// What every part of the simulation works on.

import { H, IDEAL_TEMP, W } from '../data';
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
  /** How noisy each tile is, from nearby items and crowds, and how warm, in degrees Fahrenheit. */
  readonly noise: Float32Array;
  readonly warmth: Float32Array;
  /** The announcer's latest lines, so none comes round again too soon. */
  readonly announced: string[];
}

/** Set up the working data for a game. */
export function createContext(s: GameState): SimContext {
  return {
    s,
    world: new World(s),
    events: [],
    attract: new Float32Array(W * H),
    noise: new Float32Array(W * H),
    warmth: new Float32Array(W * H).fill(IDEAL_TEMP),
    announced: [],
  };
}
