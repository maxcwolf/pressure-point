// The Great Alphorn's gag: the Sound Healer takes an enormous breath, a ring of sound rolls the length of the horn, the
// guest's hat blows off and the frost cracks off them, and a moment later the echo comes back off the mountains. Now
// and then the note sticks, and the horn bulges along its length like a snake that has swallowed an egg. Down, snow
// comes off the roof.

import { MOUTH_Z } from '../../models/items/great-alphorn';
import { bump, span, still, within, wobble } from '../beats';
import type { GagScript } from '../types';

/** Where the ring starts and stops along the horn. */
const FROM_Z = MOUTH_Z - 0.2;
const TO_Z = -1.4;
/** How high the horn is at a point along it. */
const hornY = (z: number) => 0.95 + ((z - TO_Z) / (FROM_Z - TO_Z)) * 0.2;

/** A ring of sound rolls down the horn to the guest in its bell, their hat blows off, and the echo comes back. */
export const GREAT_ALPHORN: GagScript = {
  outro: 1.5,
  hiccup: 0.2,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const { t } = i;
    if (i.stage === 'running') {
      const p = i.progress;
      // the note travels slowly when it sticks, and the horn bulges round it
      const stuck = i.hiccup && within(p, 0.3, 0.6);
      const travel = i.hiccup ? span(p, 0.2, 0.62) : span(p, 0.2, 0.42);
      const z = FROM_Z + (TO_Z - FROM_Z) * travel;
      const sounding = within(p, 0.2, i.hiccup ? 0.62 : 0.42);
      f.parts.ring = { show: sounding && !stuck, x: 0, y: hornY(z), z, s: 0.8 + travel * 0.9 };
      f.parts.bulge = { show: stuck, x: 0, y: hornY(z), z, s: 0.8 + wobble(t, 0.06, 4) };
      // the blast reaches the guest: the bell flares, the hat blows off, the frost cracks, and they lean back into it
      const hit = i.hiccup ? 0.62 : 0.42;
      const blast = bump(p, hit, hit + 0.22);
      f.parts.bell = { s: 1 + 0.12 * blast };
      f.guest = { tilt: -0.22 * blast, z: -0.12 * blast, x: wobble(t, 0.02 * blast, 6) };
      f.emit.frost = within(p, hit, hit + 0.16) ? 1 : 0;
      const off = span(p, hit, hit + 0.25);
      f.parts.hat = { show: within(p, hit, hit + 0.25), y: off * 1.2, z: -off * 1.6, rx: off * 6 };
      // and back comes the echo, from the mountains behind them, smaller and fainter
      const back = span(p, 0.8, 0.98);
      f.parts.echo = { show: within(p, 0.8, 0.98), y: 1.6, z: -4.5 + back * 2.4, s: 1.2 - back * 0.6 };
      f.guest.sy = 1 + 0.05 * bump(p, 0.94, 1);
      return f;
    }
    if (i.down) {
      f.emit.snow = 1;
      return f;
    }
    if (i.stage === 'outro') f.parts.bell = { s: 1 + 0.03 * Math.max(0, 1 - i.since) * Math.sin(i.since * 20) };
    return f;
  },
};
