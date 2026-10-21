// What every part of the simulation works on.

import { type Discipline, IDEAL_TEMP } from '../data';
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
  /*
   * The rest is kept only while the game is running, since none of it changes what happens: it is all about what the
   * speakers say, which nothing else hangs on, and how many random numbers are drawn does not depend on it.
   */
  /** The announcer's latest lines, so none comes round again too soon. */
  readonly announced: string[];
  /** Days at normal speed until a class may be announced as starting again, counting a day at 3x speed as a third. */
  classCallWait?: number;
  /** How many times a class has been announced since the game was loaded, to take turns with the lines. */
  classCalls?: number;
  /** The lines warned about for a guest whose condition has turned poor, and the guests warned about by name. */
  poorLines?: Set<Discipline | 'consult'>;
  worseWarned?: Set<number>;
}

/** Set up the working data for a game. */
export function createContext(s: GameState): SimContext {
  const world = new World(s);
  const tiles = world.w * world.h;
  return {
    s,
    world,
    events: [],
    attract: new Float32Array(tiles),
    noise: new Float32Array(tiles),
    warmth: new Float32Array(tiles).fill(IDEAL_TEMP),
    announced: [],
  };
}
