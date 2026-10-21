// The Aura Wash's gag: the guest walks the length of the tunnel, through a pink pre-soak, the spinning brushes of
// white-gloved hands, the rinse and the blower, and comes out the far end fluffy and glowing. Now and then a seagull
// rides through on their head and comes out very clean. Down, it foams over.

import { bump, ease, span, still, within, wobble } from '../beats';
import type { GagScript } from '../types';

/** How far along the tunnel the guest walks in a session, from where they step in. */
const WALK = 3.0;
/** Where they step in, along the tunnel from its middle, and how high a gull rides on a head. */
const ENTRY_Z = 1.3;
const HEAD_Y = 1.82;

export const AURA_WASH: GagScript = {
  outro: 1.2,
  hiccup: 0.2,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const { t } = i;
    if (i.stage === 'running') {
      const p = i.progress;
      const along = -WALK * span(p, 0.04, 0.96);
      // a little bob in their step as they go, and a turn in the brushes
      f.guest = { z: along, y: Math.abs(wobble(t, 0.02, 1.6)) };
      const brushing = within(p, 0.22, 0.58);
      const spin = t * (brushing ? 9 : 1.5);
      f.parts.brushL = { ry: spin };
      f.parts.brushR = { ry: -spin };
      f.parts.roller = { rx: brushing ? t * 7 : t };
      if (brushing) f.guest.spin = wobble(t, 0.25, 1.4);
      f.emit.foam = within(p, 0.04, 0.24) ? 1 : 0;
      f.emit.rinse = within(p, 0.56, 0.76) ? 1 : 0;
      f.emit.air = within(p, 0.76, 0.96) ? 1 : 0;
      // the blower leaves them fluffy
      const fluff = ease(p, 0.78, 0.92);
      f.guest.s = 1 + 0.05 * fluff;
      // and now and then a gull rides through on their head
      if (i.hiccup) f.parts.gull = { show: true, y: HEAD_Y, z: ENTRY_Z + along, rz: wobble(t, 0.2, 2) };
      return f;
    }
    if (i.down) {
      f.emit.foam = 1;
      f.parts.brushL = { ry: t * 0.6 };
      f.parts.brushR = { ry: -t * 0.6 };
      return f;
    }
    f.parts.brushL = { ry: t * 0.4 };
    f.parts.brushR = { ry: -t * 0.4 };
    if (i.stage === 'outro') {
      f.emit.sparkle = i.healed && i.since < 1 ? 1 : 0;
      // the gull, very clean, flies off
      if (i.hiccup)
        f.parts.gull = { show: true, y: HEAD_Y + i.since * 1.5, z: ENTRY_Z - WALK - 1, rx: bump(i.since, 0, 1.2) };
    }
    return f;
  },
};
