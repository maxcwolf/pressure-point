// Which disciplines and modalities are on offer, and whether a table can deliver one properly.

import {
  conditionOf,
  type Discipline,
  DISCIPLINES,
  MODALITIES,
  type Modality,
  type ModalityDef,
  STONE_USE,
} from '../data';
import { refillCandidates } from '../people';
import { rnd } from '../random';
import { disciplineOn, unlockedUpTo } from '../state/game';
import type { Emergency, Guest, Item, Staff } from '../state/types';
import type { SimContext } from './context';
import { toast } from './events';
import { hasRoom } from './progress';

/** Why a table cannot deliver a modality properly right now ('' when it can). */
export type DeliveryProblem = '' | 'unqualified' | 'no-equipment' | 'cold';

/** Switched on for this game. */
export function enabled(ctx: SimContext, d: Discipline) {
  return disciplineOn(ctx.s, d);
}

/** Switch an optional discipline on or off. What is already built stays, but its guests stop arriving. */
export function setDiscipline(ctx: SimContext, d: Discipline, on: boolean) {
  if (!DISCIPLINES[d].optional) return;
  const s = ctx.s;
  s.options[d] = on;
  refillCandidates(s);
  if (on) return;
  /** Whether an emergency is for this discipline. */
  const forThis = (e: Emergency | null) => !!e && MODALITIES[conditionOf(e.condition).modality].discipline === d;
  // an emergency on the table for a discipline switched off is withdrawn: its guests would have nowhere to go
  if (forThis(s.offer)) s.offer = null;
  // and one under way is called off, not failed: those already here stay to be seen, but nobody more is sent
  if (forThis(s.emergency)) {
    for (const g of s.guests) g.emergency = false;
    s.emergency = null;
    s.nextEmergency = s.day + rnd(50, 80);
    toast(ctx, `Emergency called off: ${DISCIPLINES[d].name} is switched off.`, 'info');
  }
}

/** The center can actually take guests for this discipline: it is on and has a finished room. */
export function offered(ctx: SimContext, d: Discipline) {
  return enabled(ctx, d) && hasRoom(ctx, DISCIPLINES[d].room);
}

/** Whether a modality is available: enough stars (or everything unlocked), and its discipline switched on. */
export function unlocked(ctx: SimContext, m: Modality) {
  return unlockedUpTo(ctx.s) >= MODALITIES[m].star && enabled(ctx, MODALITIES[m].discipline);
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
  if (def.equipment === 'stone_warmer' && kit.every((i) => i.water < STONE_USE)) return 'cold';
  return '';
}

/** Can this table, with this therapist, deliver the modality properly? */
export function deliveryProblem(
  ctx: SimContext,
  table: Item,
  staff: Staff | undefined,
  def: ModalityDef,
): DeliveryProblem {
  const kit = equipmentProblem(ctx, table, def);
  if (kit) return kit;
  if (staff && !staff.quals.includes(def.id)) return 'unqualified';
  return '';
}
