// The gags of the big machines for techniques done on tables too: the Hot Stone Kiln, the Octopus and the Geode, and the
// two that help every session in their room, the Gong of Last Resort and the Spirit Fog Machine.

import { OCTOPUS_ARMS } from '../../models/items/octopus';
import { bump, ease, span, still, within, wobble } from '../beats';
import type { GagScript } from '../types';

/** The kiln opens, a tray of hot stones comes out onto the guest's back and steams there. Down, a stone rolls away. */
export const STONE_KILN: GagScript = {
  outro: 1,
  hiccup: 0,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    if (i.stage === 'running') {
      const p = i.progress;
      const open = ease(p, 0.02, 0.1) * (1 - ease(p, 0.2, 0.28)) + ease(p, 0.84, 0.9) * (1 - ease(p, 0.94, 1));
      f.parts.door = { ry: -1.6 * open };
      // the tray goes out to the guest, and back in at the end
      const out = ease(p, 0.08, 0.2) * (1 - ease(p, 0.84, 0.94));
      f.parts.stones = { z: 0.7 * out, y: 0.0 * out };
      f.emit.steam = within(p, 0.2, 0.84) ? 1 : 0;
      f.shine = 0.8 + 1.4 * bump(p, 0, 1);
      return f;
    }
    if (i.down) {
      // a stone rolls off across the floor, and round again
      const roll = (i.t * 0.4) % 1;
      f.parts.rogue = { show: true, x: roll * 1.2, rz: -roll * 12 };
      f.shine = 0.2;
      return f;
    }
    f.shine = 0.8;
    return f;
  },
};

/** The octopus reaches out one arm after another and sets its cups, wiggling. Now and then one keeps its cup. */
export const OCTOPUS: GagScript = {
  outro: 1.2,
  hiccup: 0.25,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const { t } = i;
    const p = i.stage === 'running' ? i.progress : 0;
    for (let k = 0; k < OCTOPUS_ARMS; k++) {
      const reach = i.stage === 'running' ? ease(p, 0.05 + k * 0.03, 0.12 + k * 0.03) * (1 - ease(p, 0.84, 0.94)) : 0;
      const kept = i.hiccup && k === 3 && p > 0.5;
      f.parts[`arm${k}`] = i.down
        ? { rx: wobble(t, 0.6, 2, k), rz: wobble(t, 0.4, 1.5, k * 2) }
        : { rx: 0.9 * reach + wobble(t, 0.08, 0.7, k), rz: kept ? 1.2 : 0 };
      f.parts[`cup${k}`] = { show: !(kept && p > 0.6) };
    }
    f.parts.head = { ry: wobble(t, 0.15, 0.3), y: wobble(t, 0.03, 0.6) };
    if (i.stage === 'outro' && i.healed) f.emit.hearts = i.since < 1 ? 1 : 0;
    return f;
  },
};

/** The geode closes round the guest, glows, and opens again. */
export const GEODE: GagScript = {
  outro: 1,
  hiccup: 0,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    const p = i.stage === 'running' ? i.progress : 0;
    const shut = i.stage === 'running' ? ease(p, 0.05, 0.2) * (1 - ease(p, 0.85, 0.97)) : 0;
    f.parts.left = { ry: 0.55 * (1 - shut) };
    f.parts.right = { ry: -0.55 * (1 - shut) };
    f.shine = i.down ? 0 : 0.3 + 1.6 * bump(p, 0.15, 0.9);
    f.emit.sparkle = within(p, 0.25, 0.85) ? 1 : 0;
    return f;
  },
};

/** The gong swings and shimmers once a loop of the session, and a ring of sound rolls off it. */
export const BIG_GONG: GagScript = {
  outro: 0,
  hiccup: 0,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    if (i.stage !== 'running') return f;
    const p = i.progress;
    const strike = bump(p, 0.1, 0.22);
    f.parts.mallet = { rz: 0.9 * strike };
    const ring = span(p, 0.2, 0.8);
    f.parts.disc = {
      rx: 0.12 * Math.sin(ring * Math.PI * 4) * (1 - ring),
      s: 1 + 0.02 * Math.sin(i.t * 40) * (1 - ring),
    };
    f.parts.wave = { show: within(p, 0.2, 0.7), s: 1 + ring * 2, z: ring * 0.6 };
    return f;
  },
};

/** The fog machine puffs while a ceremony goes on in its lodge. */
export const FOG_MACHINE: GagScript = {
  outro: 0,
  hiccup: 0,
  /** One frame of the gag. */
  frame(i) {
    const f = still();
    f.emit.fog = i.stage === 'running' && !i.down ? 1 : 0;
    return f;
  },
};
