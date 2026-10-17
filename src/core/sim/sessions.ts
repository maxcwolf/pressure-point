// Group sessions: in a Sound Bath Studio guests lie on mats while one Sound Healer plays for them all from the bowls.
// The mats are stations without a staff position of their own; whoever works the room's lead station serves them.
// A session waits a little for the mats to fill, then plays for everyone lying down.

import { conditionOf, ITEMS, MODALITIES, SESSION_WAIT } from '../data';
import type { Guest, Item, Staff } from '../state/types';
import { guestById, staffById } from './chars';
import type { SimContext } from './context';

/** Whether an item is a group station, served from its room's lead station. */
export const isGroupStation = (it: Item) => !!ITEMS[it.type].station?.group;

/** Whether an item is a lead station, where a member of staff serves every group station in the room. */
export const isLeadStation = (it: Item) => ITEMS[it.type].station?.goal === 'lead';

/** The lead station in the same room as an item, if there is one. */
export function leadOf(ctx: SimContext, it: Item): Item | undefined {
  const zone = ctx.world.zoneAt(it.x, it.y);
  if (zone <= 0) return undefined;
  return ctx.s.items.find((o) => isLeadStation(o) && ctx.world.zoneAt(o.x, o.y) === zone);
}

/** The group stations in a lead station's room. */
export function matsOf(ctx: SimContext, lead: Item): Item[] {
  const zone = ctx.world.zoneAt(lead.x, lead.y);
  return ctx.s.items.filter((o) => isGroupStation(o) && ctx.world.zoneAt(o.x, o.y) === zone);
}

/** The member of staff posted at a station: its own, or for a group station, whoever is at its room's lead station. */
export function stationStaff(ctx: SimContext, it: Item): Staff | undefined {
  const post = isGroupStation(it) ? leadOf(ctx, it) : it;
  const st = post && staffById(ctx, post.staffId);
  return st?.post === post?.id ? st : undefined;
}

/**
 * How long a session has waited for its mats to fill, a step on. Nobody lying down, it has not started; every mat
 * taken, it starts at once; otherwise it starts once the wait is up. Once started it plays until the mats empty.
 */
export function sessionWait(waited: number, lying: number, mats: number, dt: number): number {
  if (lying === 0) return 0;
  if (lying >= mats) return SESSION_WAIT;
  return Math.min(SESSION_WAIT, waited + dt);
}

/** Whether a session is playing, from how long it has waited. */
export const sessionPlaying = (waited: number) => waited >= SESSION_WAIT;

/** Whether the session in a group station's room is playing. */
export function playingFor(ctx: SimContext, mat: Item): boolean {
  const lead = leadOf(ctx, mat);
  return !!lead && sessionPlaying(lead.progress);
}

/**
 * Run a lead station's session for a step: how long it has waited, which keeps on the lead station's progress, and
 * whether the healer is busy and how hard on them it is, by the hardest technique anyone is having.
 */
export function updateSession(ctx: SimContext, lead: Item, staff: Staff | undefined, dt: number) {
  const mats = matsOf(ctx, lead);
  const lying = mats.flatMap((m) => {
    const g = guestById(ctx, m.serving);
    return g?.state === 'served' ? [g] : [];
  });
  lead.progress = staff ? sessionWait(lead.progress, lying.length, mats.length, dt) : 0;
  if (!staff) return;
  // anyone lying down keeps the healer at the bowls, waiting for the rest or playing
  staff.busy = lying.length > 0;
  staff.strain = lying.length ? Math.max(...lying.map((g) => MODALITIES[conditionOf(g.condition).modality].strain)) : 1;
}

/** The guest being seen at a station: its own, or at a lead station, the first lying on the mats it plays for. */
export function servedAt(ctx: SimContext, it: Item): Guest | undefined {
  if (!isLeadStation(it)) return guestById(ctx, it.serving);
  for (const m of matsOf(ctx, it)) {
    const g = guestById(ctx, m.serving);
    if (g?.state === 'served') return g;
  }
  return undefined;
}

/** How a lead station's session stands: how many of its mats have someone lying on them, and whether it is playing. */
export function sessionState(ctx: SimContext, lead: Item): { lying: number; mats: number; playing: boolean } {
  const mats = matsOf(ctx, lead);
  const lying = mats.filter((m) => guestById(ctx, m.serving)?.state === 'served').length;
  return { lying, mats: mats.length, playing: lying > 0 && sessionPlaying(lead.progress) };
}
