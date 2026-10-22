// The shape of a machine's gag: what it reads from the game, and what it sets on the model and the guest each frame.
// Plain data, with no THREE in it, so a gag can be worked out and tested anywhere.

/** Where a machine is in its gag: empty, a guest on the way in, a session under way, or just finished. */
export type GagStage = 'idle' | 'approach' | 'running' | 'outro';

/** What a gag is worked out from, all of it already in the game. */
export interface GagInput {
  stage: GagStage;
  /** How far along the session is, from 0 to 1, while running: so a slow session plays the same gag, only slower. */
  progress: number;
  /** Seconds since the session ended, during the outro. */
  since: number;
  /** The session just ended worked. */
  healed: boolean;
  /** This session plays the machine's harmless fake failure. */
  hiccup: boolean;
  /** The time, in seconds, for anything that loops. */
  t: number;
  /** Worn enough to smoke, which says it may overload. */
  smoking: boolean;
  /** Broken down or overloaded. */
  down: boolean;
  /** A bored guest is having a ride on it, not a treatment: running, with `progress` how far through the ride. */
  ride?: boolean;
}

/** How a named part moves away from where it was built: added to its position and turn, times its size, and shown. */
export interface PartMove {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Its size, times this, the same every way, or along one axis. */
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  /** Shown or hidden; left as built when not given. */
  show?: boolean;
}

/** How the guest inside moves, in the machine's own frame: hidden inside it, moved, spun, tipped or squashed. */
export interface GuestMove {
  hide?: boolean;
  x?: number;
  y?: number;
  z?: number;
  /** Turned about the vertical, in radians. */
  spin?: number;
  /** Tipped forward, in radians. */
  tilt?: number;
  /** Their size, times this, and their height on its own. */
  s?: number;
  sy?: number;
}

/** One frame of a gag: how each named part moves, how the guest does, and how fast each emitter puffs, 0 to 1. */
export interface GagFrame {
  parts: Record<string, PartMove>;
  guest: GuestMove;
  emit: Record<string, number>;
  /** How brightly the machine's glow shines, if it has one; as built when not given. */
  shine?: number;
}

/** A machine's gag: how long its outro lasts, how often it plays its fake failure, and what each frame looks like. */
export interface GagScript {
  /** Seconds the outro plays after a session. */
  outro: number;
  /** The share of sessions that play the fake failure. It changes nothing in the game. */
  hiccup: number;
  frame: (i: GagInput) => GagFrame;
}
