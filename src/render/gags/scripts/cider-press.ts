// The Cider Press of Rebirth's gag: the Shaman turns the great screw and the lid comes down on the guest in the vat,
// dark purple sourness runs out of the spout, the lid lifts and the guest springs up rosy as an apple. Now and then the
// juice runs gold, the wrong vintage, and they press again. Down, a barrel bursts.

import { bump, ease, still, within } from '../beats';
import type { GagScript } from '../types';

/** How far the lid comes down, onto the guest in the vat. */
const DROP = 1.05;

export const CIDER_PRESS: GagScript = {
  outro: 1.6,
  hiccup: 0.2,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    if (i.stage === 'running') {
      const p = i.progress;
      // down comes the lid as the screw is turned, and up again; twice, for the wrong vintage
      const first = ease(p, 0.12, 0.38) * (1 - ease(p, 0.6, 0.75));
      const second = i.hiccup ? ease(p, 0.74, 0.8) * (1 - ease(p, 0.86, 0.92)) : 0;
      const down = Math.max(first, second);
      f.parts.lid = { y: -DROP * down };
      f.parts.screw = { y: -DROP * down, ry: down * Math.PI * 6 };
      // the guest is squashed down into the vat, out of sight, and springs back up
      f.guest = { sy: 1 - 0.75 * down + 0.2 * bump(p, 0.9, 1), hide: down > 0.85 };
      // and out runs the sour, or the inheritance
      const running = within(p, 0.35, 0.62);
      f.emit[i.hiccup ? 'gold' : 'juice'] = running ? 1 : 0;
      if (i.hiccup && within(p, 0.8, 0.9)) f.emit.juice = 1;
      return f;
    }
    if (i.down) {
      f.emit.spill = 1;
      return f;
    }
    if (i.stage === 'outro') f.emit[i.healed ? 'apples' : 'puff'] = i.since < 1.2 ? 1 : 0;
    return f;
  },
};
