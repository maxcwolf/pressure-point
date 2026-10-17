// Where guests are held up: how busy each station has been and how often it stood staffed, over the last few days, and
// the stage of a visit with the longest line for what it can do.

import { DAY_SECONDS, ITEMS } from '../data';
import type { Item } from '../state/types';
import type { SimContext } from './context';

/** How many days a station's busy and staffed shares look back over, roughly: older days count for less and less. */
export const BUSY_DAYS = 3;
/**
 * A stage holds guests up with at least `line` waiting and at least `each` for every station it has. It is flat out
 * when its stations have been busy `flatOut` of the time, and short-staffed when they stood staffed under `staffed`.
 */
export const BOTTLENECK = { line: 4, each: 2, flatOut: 0.8, staffed: 0.7 };

/**
 * Note a step of a station's work: whether it had a guest called or in hand, and whether someone was at it, ready. Each
 * share drifts toward what this step was, so a share is how it has been over the last few days. A station new to it,
 * or from an older save, starts from how it is now.
 */
export function trackBusy(it: Item, busy: boolean, staffed: boolean, dt: number) {
  const k = Math.min(1, dt / (BUSY_DAYS * DAY_SECONDS));
  const b = busy ? 1 : 0;
  const s = staffed ? 1 : 0;
  it.busy = (it.busy ?? b) + (b - (it.busy ?? b)) * k;
  it.staffed = (it.staffed ?? s) + (s - (it.staffed ?? s)) * k;
}

/** One stage of a visit, as guests wait for it: check-in, consultation, a scan, a discipline's treatment or the shop. */
export interface Stage {
  /** The station goal, or for a treatment its discipline. */
  key: string;
  stations: Item[];
  /** Guests waiting in its lines. */
  waiting: number;
  /** How much of the time its stations have been busy and stood staffed, on average, from 0 to 1. */
  busy: number;
  staffed: number;
}

/** Whether a guest is waiting in line, not yet called. */
const inLine = (ctx: SimContext, id: number, it: Item) => {
  const g = ctx.s.guests.find((x) => x.id === id);
  return g?.station === it.id && (g.state === 'waiting' || g.state === 'toWait');
};

/** Every stage with a working station, and how it is doing. */
export function stages(ctx: SimContext): Stage[] {
  const by = new Map<string, Item[]>();
  for (const it of ctx.s.items) {
    const def = ITEMS[it.type].station;
    if (!def || def.goal === 'lead' || def.goal === 'class' || !ctx.world.usable(it)) continue;
    const key = def.goal === 'treat' ? (def.discipline ?? 'treat') : def.goal;
    by.set(key, [...(by.get(key) ?? []), it]);
  }
  return [...by].map(([key, stations]) => {
    /** The average of something over the stage's stations. */
    const mean = (f: (it: Item) => number) => stations.reduce((sum, it) => sum + f(it), 0) / stations.length;
    return {
      key,
      stations,
      waiting: stations.reduce((sum, it) => sum + it.queue.filter((id) => inLine(ctx, id, it)).length, 0),
      busy: mean((it) => it.busy ?? 0),
      staffed: mean((it) => it.staffed ?? 0),
    };
  });
}

/** The stage holding guests up most, by its line for each station, if any is holding them up at all. */
export function bottleneck(ctx: SimContext): Stage | undefined {
  let worst: Stage | undefined;
  for (const st of stages(ctx)) {
    if (st.waiting < BOTTLENECK.line || st.waiting < BOTTLENECK.each * st.stations.length) continue;
    if (!worst || st.waiting / st.stations.length > worst.waiting / worst.stations.length) worst = st;
  }
  return worst;
}
