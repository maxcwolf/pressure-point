// The first game's heads-ups: on a first go at the campaign's first center, what the center will need before long,
// said a little ahead of the trouble rather than once it has come, and kept as a checklist under the objectives.

import { GENERAL_COURSES, ROOMS } from '../data';
import { money } from '../format';
import type { SimContext } from './context';
import type { Subject } from './events';
import { hasItem, hasRoom, hasStaff } from './progress';
import { canSmudge } from './vibes';

/** The things the center will need, in the order they come up, each with its line on the checklist. */
const STEPS = [
  { id: 'open', label: 'Open with a Massage Suite and a Therapist' },
  { id: 'caretaker', label: 'Hire a Caretaker' },
  { id: 'smudging', label: 'Train a Caretaker in Smudging' },
  { id: 'staffroom', label: 'Build a Staff Room' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/** Below this, someone on the staff is tiring, well before they are too worn out to work properly. */
export const PRIMER_TIRING = 50;

/** Whether a step matters yet: its heads-up comes then, a little before the trouble it heads off. */
function due(ctx: SimContext, id: StepId): boolean {
  const s = ctx.s;
  switch (id) {
    case 'open':
      return true;
    case 'caretaker':
      return s.stats.healed >= 1;
    case 'smudging':
      return hasStaff(ctx, 'caretaker') || s.stats.failed >= 1;
    case 'staffroom':
      return s.staff.some((st) => st.state !== 'leaving' && st.energy < PRIMER_TIRING);
  }
}

/** Whether a step is in place. */
function done(ctx: SimContext, id: StepId): boolean {
  switch (id) {
    case 'open':
      return (
        hasItem(ctx, 'reception_desk') &&
        hasRoom(ctx, 'consult') &&
        hasRoom(ctx, 'massage') &&
        hasStaff(ctx, 'receptionist') &&
        hasStaff(ctx, 'consultant') &&
        hasStaff(ctx, 'therapist')
      );
    case 'caretaker':
      return hasStaff(ctx, 'caretaker');
    case 'smudging':
      return ctx.s.staff.some((st) => st.state !== 'leaving' && canSmudge(st));
    case 'staffroom':
      return hasRoom(ctx, 'staffroom');
  }
}

/** A step's heads-up, and who it is about if anyone; none for opening, which the advisor walks through itself. */
function heads(ctx: SimContext, id: StepId): { text: string; about?: Subject } | null {
  switch (id) {
    case 'open':
      return null;
    case 'caretaker':
      return {
        text: 'Your first guests are being healed. Before long there will be litter in the corridors, dirty toilets and worn-out tables, and nobody to see to them. Hire a Caretaker from the Hire menu before it piles up.',
      };
    case 'smudging': {
      const course = GENERAL_COURSES.smudging;
      const why =
        'Sooner or later a treatment fails, and it leaves bad vibes in the room that make the next ones there fail more often.';
      const cost = `(${money(course.cost)}, ${course.days} days)`;
      if (!hasRoom(ctx, 'training'))
        return {
          text: `${why} Build a Training Room (${money(ROOMS.training.cost)}), then send a Caretaker on the Smudging course ${cost}, so they can clear the air.`,
        };
      const caretaker = ctx.s.staff.find(
        (st) => st.role === 'caretaker' && st.state !== 'leaving' && st.training === null,
      );
      return {
        text: `${why} Select a Caretaker and send them on the Smudging course ${cost}, so they can clear the air.`,
        ...(caretaker && { about: { kind: 'staff', id: caretaker.id } }),
      };
    }
    case 'staffroom':
      return {
        text: 'Your staff are starting to tire. Worn out, they work slowly, botch treatments and lose heart. Build a Staff Room so they can take their breaks.',
      };
  }
}

/** A line on the checklist: what it asks, and whether it is in place. */
export interface PrimerLine {
  id: string;
  label: string;
  done: boolean;
}

/** The checklist, while the heads-ups are on: a line for each thing the center will need. */
export function primerLines(ctx: SimContext): PrimerLine[] {
  if (!ctx.s.primer) return [];
  return STEPS.map((st) => ({ id: st.id, label: st.label, done: done(ctx, st.id) }));
}

/** A heads-up: what it says, and who or what it is about, if anyone. */
export interface PrimerNote {
  id: string;
  text: string;
  about?: Subject;
}

/** The heads-ups that matter now and are not yet seen to, in checklist order. */
export function primerNotes(ctx: SimContext): PrimerNote[] {
  if (!ctx.s.primer) return [];
  return STEPS.flatMap((st) => {
    if (done(ctx, st.id) || !due(ctx, st.id)) return [];
    const h = heads(ctx, st.id);
    return h ? [{ id: st.id, ...h }] : [];
  });
}

/** Whether everything on the checklist is in place at once, which ends the heads-ups for good. */
export const primerDone = (ctx: SimContext) => STEPS.every((st) => done(ctx, st.id));
