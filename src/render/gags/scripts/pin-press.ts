// The Pin Press's gag: the guest presses into the pins, their outline rises on the back, one pin sticks out, and the
// Acupuncturist's little hammer taps it back in, and the guest reboots. Now and then the outline is Brent's, and they
// have to press again. Down, every pin is stuck out.

import { bump, ease, still, within, wobble } from '../beats';
import type { GagScript } from '../types';

export const PIN_PRESS: GagScript = {
  outro: 1.4,
  hiccup: 0.2,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const { t } = i;
    if (i.stage === 'running') {
      const p = i.progress;
      // in they press, and out again at the end
      const press = ease(p, 0.02, 0.15) * (1 - ease(p, 0.84, 0.95));
      f.guest = { z: -0.14 * press };
      f.parts.field = { sz: 1 + 0.8 * press };
      // their outline rises on the back, or Brent's does, first time, now and then
      const brent = i.hiccup && within(p, 0.1, 0.48);
      const again = i.hiccup ? ease(p, 0.5, 0.58) : 1;
      const rise = ease(p, 0.15, 0.3) * (1 - ease(p, 0.86, 0.96));
      f.parts.outline = { show: !brent && rise * again > 0.02, sz: rise * again };
      f.parts.brent = { show: brent, sz: ease(p, 0.15, 0.3) * (1 - ease(p, 0.42, 0.48)) };
      if (brent) f.guest.x = wobble(t, 0.02, 3);
      // the one pin that will not go back in, and the hammer taps it home
      const out = ease(p, 0.38, 0.45) * (1 - ease(p, 0.74, 0.76));
      f.parts.stuck = { z: -0.25 * out };
      const tapping = within(p, 0.58, 0.76);
      f.parts.hammer = { show: within(p, 0.5, 0.82), rx: tapping ? -Math.abs(wobble(t, 0.9, 2.2)) : 0 };
      // and the guest reboots, with a little jolt
      f.guest.sy = 1 + 0.07 * bump(p, 0.76, 0.84);
      f.emit.sparkle = within(p, 0.76, 0.86) ? 1 : 0;
      return f;
    }
    if (i.down) {
      f.parts.field = { sz: 2.2 + wobble(t, 0.2, 3) };
      f.parts.stuck = { z: -0.25 };
      return f;
    }
    if (i.stage === 'outro' && !i.healed) f.emit.puff = i.since < 1 ? 1 : 0;
    return f;
  },
};
