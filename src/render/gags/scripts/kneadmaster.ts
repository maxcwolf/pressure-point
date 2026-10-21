// The Kneadmaster 9000's gag: the chair reclines, the arms unfold a pair at a time and knead, gently and then far too
// hard, the chair spins once and the guest gets up straight. Now and then it snaps shut on them like a clam instead,
// and has to be kicked open. Down, it goes on kneading the empty air.

import { bump, ease, still, within, wobble } from '../beats';
import type { GagFrame, GagScript } from '../types';

/** How many arms it has, three a side. */
const ARMS = 6;

/** Set every arm: open from 0 (folded down) to 1, and pumping by so much, so many times a second. */
function arms(f: GagFrame, open: (i: number) => number, pump: number, rate: number, t: number) {
  for (let i = 0; i < ARMS; i++) {
    const side = i < 3 ? -1 : 1;
    const fold = 1 - open(i);
    f.parts[`arm${i}`] = {
      rz: -side * 2.6 * fold,
      rx: wobble(t, pump, rate, i * 1.3),
      sy: 1 + Math.max(0, wobble(t, pump * 0.4, rate, i * 1.3 + 0.6)),
    };
  }
}

export const KNEADMASTER: GagScript = {
  outro: 1.6,
  hiccup: 0.18,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const { t } = i;
    if (i.stage === 'running') {
      const p = i.progress;
      const recline = ease(p, 0, 0.12) * (1 - ease(p, 0.86, 0.97));
      // gentle at first, then very firm indeed
      const hard = ease(p, 0.3, 0.62);
      const kneading = within(p, 0.25, 0.84) ? 1 : 0;
      const rate = 1.2 + hard * 3.2;
      arms(
        f,
        (k) => ease(p, 0.12 + k * 0.025, 0.19 + k * 0.025) * (1 - ease(p, 0.82, 0.9)),
        (0.12 + hard * 0.5) * kneading,
        rate,
        t,
      );
      f.parts.back = { rx: -0.5 * recline };
      f.parts.legrest = { rx: -1.1 * recline };
      f.parts.hood = { y: -0.38 * ease(p, 0.3, 0.38) * (1 - ease(p, 0.74, 0.8)) };
      // one turn of the chair, which takes the guest round with it
      const spin = ease(p, 0.62, 0.72) * Math.PI * 2;
      f.parts.chair = { ry: spin };
      f.guest = {
        spin,
        tilt: -0.3 * recline,
        x: wobble(t, 0.02 * hard * kneading, rate * 1.3),
        y: Math.abs(wobble(t, 0.025 * hard * kneading, rate)),
        // their hair stands on end as it comes round
        sy: 1 + 0.08 * bump(p, 0.7, 0.8),
      };
      if (i.hiccup && within(p, 0.4, 0.58)) {
        // it snaps shut on them like a clam, rattles while it is kicked, and opens again
        const shut = ease(p, 0.4, 0.44) * (1 - ease(p, 0.54, 0.58));
        f.parts.back = { rx: -0.5 * recline + 1.25 * shut };
        f.parts.legrest = { rx: -1.1 * recline - 0.6 * shut };
        f.parts.chair = { x: wobble(t, 0.03 * shut, 7), rz: wobble(t, 0.02 * shut, 5) };
        arms(f, () => 1 - shut, 0, 1, t);
        f.guest = { hide: shut > 0.6 };
      }
      return f;
    }
    if (i.down) {
      // overloaded or broken: it goes on kneading nobody, flat out
      arms(f, () => 1, 0.55, 4.5, t);
      f.parts.chair = { x: wobble(t, 0.02, 6) };
      return f;
    }
    arms(f, () => 0, 0, 1, t);
    if (i.stage === 'outro') f.emit[i.healed ? 'hearts' : 'puff'] = i.since < 1.2 ? 1 : 0;
    return f;
  },
};
