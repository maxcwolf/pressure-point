// Which disciplines and modalities are on offer, and whether a table can deliver one properly.

import {
  conditionOf,
  type Discipline,
  DISCIPLINES,
  heatPerUse,
  ITEMS,
  MODALITIES,
  type Modality,
  type ModalityDef,
} from '../data';
import { disciplineOn, techniqueOpen } from '../state/game';
import type { Guest, Item, Staff, StaffState } from '../state/types';
import { worksAt } from './assignments';
import type { SimContext } from './context';
import { hasRoom, machineBuilt } from './inventory';

/** Why a table cannot deliver a modality properly right now ('' when it can). */
export type DeliveryProblem = '' | 'unqualified' | 'no-equipment' | 'out-of-action' | 'cold';

/** Switched on for this game. */
export function enabled(ctx: SimContext, d: Discipline) {
  return disciplineOn(ctx.s, d);
}

/** The center can actually take guests for this discipline: it is on and has a finished room. */
export function offered(ctx: SimContext, d: Discipline) {
  return enabled(ctx, d) && hasRoom(ctx, DISCIPLINES[d].room);
}

/**
 * Whether a modality is available: enough stars (or everything unlocked), or opened early by an ailment going around;
 * its discipline switched on; and for one done only on a machine, that machine's room built.
 */
export function unlocked(ctx: SimContext, m: Modality) {
  return techniqueOpen(ctx.s, m) && enabled(ctx, MODALITIES[m].discipline) && machineBuilt(ctx.s, m);
}

/** The modality that treats a guest's condition. */
export function modalityOf(g: Guest): ModalityDef {
  return MODALITIES[conditionOf(g.condition).modality];
}

/** Working equipment for a modality in the suite around a table. */
export function equipmentProblem(ctx: SimContext, table: Item, def: ModalityDef): DeliveryProblem {
  if (!def.equipment) return '';
  const zone = ctx.world.zoneAt(table.x, table.y);
  const kit = ctx.s.items.filter((i) => i.type === def.equipment && ctx.world.zoneAt(i.x, i.y) === zone);
  if (!kit.length) return 'no-equipment';
  // there, but broken or stopped by a power cut
  const working = kit.filter((i) => ctx.world.usable(i));
  if (!working.length) return 'out-of-action';
  const use = heatPerUse(def.equipment);
  if (use && working.every((i) => i.water < use)) return 'cold';
  return '';
}

/** Can this table, with this therapist, deliver the modality properly? A machine needs no equipment for its own work. */
export function deliveryProblem(
  ctx: SimContext,
  table: Item,
  staff: Staff | undefined,
  def: ModalityDef,
): DeliveryProblem {
  const kit = ITEMS[table.type].machine?.performs.includes(def.id) ? '' : equipmentProblem(ctx, table, def);
  if (kit) return kit;
  if (staff && !staff.quals.includes(def.id)) return 'unqualified';
  return '';
}

/** Staff who will not be seeing anyone for a while: going, or away for days on a course or a house call. */
export const AWAY: readonly StaffState[] = ['leaving', 'toCall', 'away', 'toTrain', 'training'];

/**
 * Whether a guest should wait for a colleague trained in their treatment rather than be seen by this member of staff,
 * who is not: there is someone who is, here and free to work a table that does it, with its specialty item there if it
 * needs one, or a machine that does it. One posted at a table that cannot do it is busy there, and leaves them to be
 * seen as they can. A guest the player put in this line is seen in it all the same.
 */
export function leftForSpecialist(ctx: SimContext, staff: Staff, g: Guest): boolean {
  const mod = modalityOf(g);
  if (g.placed || staff.quals.includes(mod.id)) return false;
  /** Whether a table does the technique properly. */
  const does = (it: Item) =>
    ITEMS[it.type].station?.goal === 'treat' &&
    ctx.world.usable(it) &&
    treatsHere(it, mod) &&
    !deliveryProblem(ctx, it, undefined, mod);
  return ctx.s.staff.some((t) => {
    if (!t.quals.includes(mod.id) || AWAY.includes(t.state)) return false;
    const post = ctx.world.item(t.post);
    if (post && !does(post)) return false;
    return ctx.s.items.some((it) => does(it) && worksAt(ctx, t, it.x, it.y));
  });
}

/** Whether a station takes guests for a technique: a table any of its discipline's but a machine's own, a machine its own. */
export function treatsHere(it: Pick<Item, 'type'>, mod: ModalityDef): boolean {
  const def = ITEMS[it.type];
  if (def.station?.goal !== 'treat' || def.station.discipline !== mod.discipline) return false;
  if (def.machine) return def.machine.performs.includes(mod.id);
  return !mod.machine;
}
