// The Carousel of Rebirth's gag: the carousel turns, faster and faster, three times round, and with each stretch of it
// the guest rides as another of their past lives, in a ruff, a toga, as a goat and as a seagull, and hops off as
// themselves. Now and then they come off still a goat. Down, it goes round on its own. A bored guest's ride, between
// treatments, goes gently round with no past lives.

import { RIDE_RADIUS } from '../../models/items/wheel-of-rebirth';
import { ease, still, within, wobble } from '../beats';
import type { GagScript } from '../types';

/** How many times round a session takes them. */
const TURNS = 3;

/** The past lives, in order, and the stretch of the session each is worn for. */
const LIVES = [
  ['ruff', 0.16, 0.34],
  ['toga', 0.34, 0.52],
  ['goat', 0.52, 0.7],
  ['gull', 0.7, 0.86],
] as const;

export const WHEEL_OF_REBIRTH: GagScript = {
  outro: 1.8,
  hiccup: 0.2,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const { t } = i;
    // a ride for a bored guest goes once gently round as themselves, with no past lives to see, and ends where it began
    if (i.stage === 'running' && i.ride) {
      const angle = Math.PI * 2 * ease(i.progress, 0, 1);
      f.parts.deck = { ry: angle };
      f.parts.canopy = { ry: angle };
      for (let k = 0; k < 4; k++) f.parts[`horse${k}`] = { y: wobble(t, 0.12, 0.8, k * 1.6) };
      f.guest = {
        x: Math.sin(angle) * RIDE_RADIUS,
        z: (Math.cos(angle) - 1) * RIDE_RADIUS,
        spin: angle,
        y: wobble(t, 0.12, 0.8),
      };
      f.emit.notes = 0.4;
      return f;
    }
    if (i.stage === 'running') {
      const p = i.progress;
      // round and round, speeding up then slowing, ending where they got on
      const angle = TURNS * Math.PI * 2 * ease(p, 0.05, 0.95);
      f.parts.deck = { ry: angle };
      f.parts.canopy = { ry: angle };
      for (let k = 0; k < 4; k++) f.parts[`horse${k}`] = { y: wobble(t, 0.12, 0.8, k * 1.6) };
      for (const [life, a, b] of LIVES)
        f.parts[life] = { show: within(p, a, b) || (i.hiccup && life === 'goat' && p >= a) };
      // the guest goes round with their horse, bobbing with it
      f.guest = {
        x: Math.sin(angle) * RIDE_RADIUS,
        z: (Math.cos(angle) - 1) * RIDE_RADIUS,
        spin: angle,
        y: wobble(t, 0.12, 0.8),
      };
      f.emit.notes = 0.6;
      return f;
    }
    if (i.down) {
      f.parts.deck = { ry: t * 1.4 };
      f.parts.canopy = { ry: t * 1.4 };
      f.emit.notes = 0.3;
      return f;
    }
    // the goat, if it stuck, stays a moment after
    f.parts.goat = { show: i.stage === 'outro' && i.hiccup && i.since < 1.2 };
    if (i.stage === 'outro' && !i.healed) f.emit.puff = i.since < 1 ? 1 : 0;
    return f;
  },
};
