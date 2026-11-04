// Complaints: a guest the center let down, by a wait that ran out or an accident in the waiting area, leaves one, and
// can be asked back, free and first in line, to win back half of what they cost. Their arrival is in `arrivals`, the
// front of the line in `lines`, and the visit going free in `stations`.

import { COMP_SHARE, COMPLAINT_DAYS, conditionOf } from '../data';
import type { Complaint, ComplaintEnd, GameState, Guest } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { emit, toast } from './events';

/**
 * Whether a visit, as it ends, leaves a complaint: a guest who stormed out, went home worse off or went home after an
 * accident. Not one put off by a price, an emergency guest, a class-goer, or someone already asked back once.
 */
export const complains = (g: Guest) =>
  g.comp === undefined &&
  !g.emergency &&
  !g.classDay &&
  (g.outcome === 'worse' || (g.outcome === 'stormed' && !g.feelings.includes('pricey')));

/** How the visit that left a complaint ended. */
const endOf = (g: Guest): ComplaintEnd =>
  g.outcome === 'worse' ? 'worse' : g.feelings.includes('accident') ? 'accident' : 'stormed';

/**
 * File a complaint for a guest leaving let down, with what it really cost the center's name, read before and after
 * the loss so the damping toward the ends of the scale is in it. Nothing for a visit that leaves none.
 */
export function fileComplaint(ctx: SimContext, g: Guest, cost: number) {
  if (!complains(g)) return;
  ctx.s.complaints.push({
    id: g.id,
    name: g.name,
    look: { ...g.look },
    condition: g.condition,
    diagnosis: g.diagnosis,
    ...(g.goal === 'treat' && { modality: conditionOf(g.condition).modality }),
    end: endOf(g),
    day: ctx.s.day,
    cost,
    ...(g.regular !== undefined && { regular: g.regular }),
  });
}

/** The complaints still waiting for an answer, oldest first. */
export const openComplaints = (s: GameState) => s.complaints.filter((c) => c.due === undefined);

/** The guest asked back who is due soonest, if any is due by now. */
export const dueComplaint = (s: GameState): Complaint | undefined =>
  s.complaints.filter((c) => c.due !== undefined && c.due <= s.day).sort((a, b) => (a.due ?? 0) - (b.due ?? 0))[0];

/** Whether a regular has a complaint open or is due back for one, which holds their place and their next visit. */
export const complaintHolds = (s: GameState, regular: number) => s.complaints.some((c) => c.regular === regular);

/** Ask a guest back for a complaint still open: they are due the next day. False if there is no such complaint. */
export function answerComplaint(ctx: SimContext, id: number): boolean {
  const c = openComplaints(ctx.s).find((x) => x.id === id);
  if (!c) return false;
  c.due = Math.floor(ctx.s.day) + 1;
  return true;
}

/** Let a complaint still open go. False if there is no such complaint. */
export function dropComplaint(ctx: SimContext, id: number): boolean {
  const c = openComplaints(ctx.s).find((x) => x.id === id);
  if (!c) return false;
  closeComplaint(ctx, c);
  return true;
}

/** Let go every complaint left unanswered for `COMPLAINT_DAYS`. Once a day. */
export function lapseComplaints(ctx: SimContext) {
  for (const c of openComplaints(ctx.s)) if (ctx.s.day >= c.day + COMPLAINT_DAYS) closeComplaint(ctx, c);
}

/**
 * Take a complaint off the list, its guest arrived or never asked back. A regular whose loyalty that visit took to
 * nothing, kept for their complaint, goes now if they were never asked back, as they would have gone then.
 */
export function closeComplaint(ctx: SimContext, c: Complaint, arrived = false) {
  const s = ctx.s;
  s.complaints = s.complaints.filter((x) => x !== c);
  if (arrived || c.regular === undefined) return;
  const r = s.regulars.find((x) => x.id === c.regular);
  if (!r || r.loyalty > 0) return;
  s.regulars = s.regulars.filter((x) => x !== r);
  toast(ctx, `${r.name} has had enough, and will not be coming back.`, 'bad', undefined, 'ui-heart-broken');
}

/**
 * A guest asked back is healed: in place of what a heal usually does for the center's name, half of what their
 * complaint cost comes back, added straight so it is never more than half, whatever the reputation or the settings.
 */
export function madeRight(ctx: SimContext, g: Guest) {
  ctx.s.reputation = clamp(ctx.s.reputation + (g.comp ?? 0) * COMP_SHARE, 0, 100);
  emit(ctx, { type: 'float', text: 'Made right', x: g.x, y: g.y, kind: 'good' });
}
