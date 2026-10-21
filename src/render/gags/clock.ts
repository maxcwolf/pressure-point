// Where each machine is in its gag, worked out from the game as it stands: shared by the items and the people drawn, so
// the machine and the guest inside it keep in step.

import { ITEMS } from '../../core/data';
import { smoking } from '../../core/sim/machines';
import type { Sim } from '../../core/sim/sim';
import type { Item } from '../../core/state/types';
import { hiccupOf } from './beats';
import { GAGS } from './scripts';
import type { GagInput } from './types';

/** The last guest a machine took, kept a moment after they are done for the outro. */
interface Last {
  guest: number;
  hiccup: boolean;
  /** When their session ended, by the clock the view keeps, or -1 while it goes on. */
  end: number;
  healed: boolean;
}

/** How long a loop of a booster's gag takes, in seconds, while a session goes on in its room. */
const BOOST_LOOP = 5;

export class GagClock {
  private last = new Map<number, Last>();

  /** Where a machine is in its gag at a moment, or nothing for an item without one. */
  input(sim: Sim, it: Item, t: number): GagInput | undefined {
    const script = GAGS[it.type];
    if (!script) return undefined;
    const base = { progress: 0, since: 0, healed: false, hiccup: false, t, smoking: smoking(it), down: it.wear >= 100 };
    // a booster takes nobody itself, and plays along with the sessions in its room
    if (!ITEMS[it.type].station) {
      const busy = sim.machineBusy(it);
      return { ...base, stage: busy ? 'running' : 'idle', progress: busy ? (t / BOOST_LOOP) % 1 : 0 };
    }
    const g = it.serving ? sim.guest(it.serving) : undefined;
    if (g && (g.state === 'called' || g.state === 'served')) {
      const hiccup = hiccupOf(it.id, g.id, script.hiccup);
      this.last.set(it.id, { guest: g.id, hiccup, end: -1, healed: false });
      const served = g.state === 'served';
      return {
        ...base,
        stage: served ? 'running' : 'approach',
        progress: served ? Math.min(1, it.progress) : 0,
        hiccup,
      };
    }
    const rec = this.last.get(it.id);
    if (rec) {
      if (rec.end < 0) {
        rec.end = t;
        rec.healed = sim.guest(rec.guest)?.outcome === 'healed';
      }
      const since = t - rec.end;
      if (since < script.outro) return { ...base, stage: 'outro', since, healed: rec.healed, hiccup: rec.hiccup };
      this.last.delete(it.id);
    }
    return { ...base, stage: 'idle' };
  }

  /** Forget the machines that are gone. */
  prune(live: ReadonlySet<number>) {
    for (const id of this.last.keys()) if (!live.has(id)) this.last.delete(id);
  }
}
