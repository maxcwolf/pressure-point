// The tutorial: a new Willow Lane game walked through its opening a step at a time, each step with a card in the
// advisor's spot and a ring on what it wants, then the first game's heads-ups as steps of their own, and a word to hand
// over once all of it is done.

import type { ItemType, Role, RoomType } from '../data';
import type { SimContext } from './context';
import { emit, type Subject, toast } from './events';
import { primerDone, primerLines, primerNotes } from './primer';
import { hasItem, hasRoom, hasStaff } from './progress';

/** What a step wants the player to do, which the interface rings: look around, or an item, room or hire. */
export type Want =
  { kind: 'look' } | { kind: 'item'; type: ItemType } | { kind: 'room'; type: RoomType } | { kind: 'hire'; role: Role };

/** A step of the opening: its line on the list, what its card says, and what it wants. */
interface Opening {
  id: OpeningId;
  title: string;
  text: string;
  want: Want;
}

type OpeningId = 'look' | 'desk' | 'receptionist' | 'consult' | 'consultant' | 'massage' | 'therapist' | 'benches';

/** The game days after which looking around counts as done, whether or not the camera has been moved and turned. */
export const LOOK_DAYS = 2;

/** The tip noted once the camera has been moved and turned. */
export const LOOKED_TIP = 'tutorial-looked';

/** How many Benches the opening asks for. */
const BENCHES = 2;

/** The opening, in order. */
const OPENING: readonly Opening[] = [
  {
    id: 'look',
    title: 'Look around',
    text: 'This is your center. W, A, S and D or the edges of the screen move the camera, Q and E turn it, the mouse wheel zooms, and Space pauses. Move and turn it to have a look.',
    want: { kind: 'look' },
  },
  {
    id: 'desk',
    title: 'Place a Reception Desk',
    text: 'Guests check in at a Reception Desk before anything else. Open the Items menu, pick the Reception Desk and place it near the entrance.',
    want: { kind: 'item', type: 'reception_desk' },
  },
  {
    id: 'receptionist',
    title: 'Hire a Receptionist',
    text: 'A desk needs a face behind it. Open the Hire menu and take on a Receptionist.',
    want: { kind: 'hire', role: 'receptionist' },
  },
  {
    id: 'consult',
    title: 'Build a Consultation Room',
    text: 'Every guest sees a Wellness Consultant first, to find out what ails them. Pick a Consultation Room from the Rooms menu, drag out its floor, add a door, then place the furniture it asks for.',
    want: { kind: 'room', type: 'consult' },
  },
  {
    id: 'consultant',
    title: 'Hire a Wellness Consultant',
    text: 'The Consultation Room needs someone to run it. Hire a Wellness Consultant.',
    want: { kind: 'hire', role: 'consultant' },
  },
  {
    id: 'massage',
    title: 'Build a Massage Suite',
    text: 'Now the main event, where guests are treated. Build a Massage Suite from the Rooms menu, the same way.',
    want: { kind: 'room', type: 'massage' },
  },
  {
    id: 'therapist',
    title: 'Hire a Massage Therapist',
    text: 'Once a Massage Therapist is on the books the center opens, and the first guests come in.',
    want: { kind: 'hire', role: 'therapist' },
  },
  {
    id: 'benches',
    title: 'Put down two Benches',
    text: 'Guests wait for the desk and the rooms, and on their feet they lose patience fast. Place two Benches from the Items menu where the lines form.',
    want: { kind: 'item', type: 'bench' },
  },
];

/** Whether a step of the opening matters yet: all from the start, but the Benches once guests are coming in. */
function openingDue(ctx: SimContext, id: OpeningId): boolean {
  return id === 'benches' ? ctx.s.open : true;
}

/** Whether a step of the opening is done. */
function openingDone(ctx: SimContext, id: OpeningId): boolean {
  const s = ctx.s;
  switch (id) {
    case 'look':
      return s.seenTips.includes(LOOKED_TIP) || s.day >= LOOK_DAYS;
    case 'desk':
      return hasItem(ctx, 'reception_desk');
    case 'receptionist':
      return hasStaff(ctx, 'receptionist');
    case 'consult':
      return hasRoom(ctx, 'consult');
    case 'consultant':
      return hasStaff(ctx, 'consultant');
    case 'massage':
      return hasRoom(ctx, 'massage');
    case 'therapist':
      return hasStaff(ctx, 'therapist');
    case 'benches':
      return s.items.filter((i) => i.type === 'bench' && ctx.world.usable(i)).length >= BENCHES;
  }
}

/** What a heads-up step wants rung, by its id: a hire or a room, or nothing for what has no one place to point at. */
function headsWant(ctx: SimContext, id: string): Want | undefined {
  switch (id) {
    case 'caretaker':
      return { kind: 'hire', role: 'caretaker' };
    case 'smudging':
      return hasRoom(ctx, 'training') ? undefined : { kind: 'room', type: 'training' };
    case 'staffroom':
      return { kind: 'room', type: 'staffroom' };
    default:
      return undefined;
  }
}

/** A step of the tutorial as it stands now. */
interface Step {
  id: string;
  title: string;
  /** What its card says, once it is the step in hand. */
  text: string;
  want?: Want;
  about?: Subject;
  done: boolean;
  due: boolean;
}

/** Every step, the opening and then the heads-ups, with whether each is due and done; none while the tutorial is off. */
function steps(ctx: SimContext): Step[] {
  if (!ctx.s.tutorial) return [];
  const opening = OPENING.map((o) => ({
    id: o.id,
    title: o.title,
    text: o.text,
    want: o.want,
    done: openingDone(ctx, o.id),
    due: openingDue(ctx, o.id),
  }));
  // the heads-up for opening is the opening itself, walked through above
  const notes = primerNotes(ctx);
  const heads = primerLines(ctx)
    .filter((l) => l.id !== 'open')
    .map((l) => {
      const note = notes.find((n) => n.id === l.id);
      const want = headsWant(ctx, l.id);
      return {
        id: l.id,
        title: l.label,
        text: note?.text ?? '',
        ...(want && { want }),
        ...(note?.about && { about: note.about }),
        done: l.done,
        // a heads-up is among the notes once it is due and not yet seen to
        due: !!note,
      };
    });
  return [...opening, ...heads];
}

/** The step in hand: where it comes in the tutorial, what its card says, what it wants, and who it is about. */
export interface TutorialStep {
  id: string;
  /** Which step it is, counted from 1, and of how many. */
  n: number;
  of: number;
  title: string;
  text: string;
  want?: Want;
  about?: Subject;
}

/** The step in hand: the first not yet done that is due, or null while none is (or the tutorial is off). */
export function currentStep(ctx: SimContext): TutorialStep | null {
  const all = steps(ctx);
  const i = all.findIndex((st) => !st.done && st.due);
  const st = all[i];
  if (!st) return null;
  return {
    id: st.id,
    n: i + 1,
    of: all.length,
    title: st.title,
    text: st.text,
    ...(st.want && { want: st.want }),
    ...(st.about && { about: st.about }),
  };
}

/**
 * The steps the advisor's walk-through of the opening gives way to while the tutorial is on: those before the center
 * opens. The Benches come once guests do, so they wait behind anything more pressing, as the heads-ups do.
 */
export const WALKTHROUGH_IDS: ReadonlySet<string> = new Set(OPENING.filter((o) => o.id !== 'benches').map((o) => o.id));

/** A line on the tutorial's list: what it asks, whether it is done, and whether it is the step in hand. */
export interface TutorialLine {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
}

/** The tutorial's list, while it is on: a line for every step. */
export function tutorialLines(ctx: SimContext): TutorialLine[] {
  const all = steps(ctx);
  const current = all.find((st) => !st.done && st.due);
  return all.map((st) => ({ id: st.id, label: st.title, done: st.done, current: st === current }));
}

/** The word the tutorial hands over with, once every step is done. */
export const HANDOFF =
  "That's the basics. From here the advisor speaks up when something needs you, and the objectives at the top left earn your first star: click one for the numbers behind it.";

/**
 * Once a second: hand over once every step is done, ending the tutorial for good in this game, and the heads-ups too
 * if they are all in place, so they go without a word of their own.
 */
export function warnTutorial(ctx: SimContext) {
  const s = ctx.s;
  if (!s.tutorial) return;
  const all = steps(ctx);
  if (!all.every((st) => st.done)) return;
  s.tutorial = false;
  if (s.primer && primerDone(ctx)) s.primer = false;
  toast(ctx, HANDOFF, 'good', undefined, 'ui-advisor');
  emit(ctx, { type: 'tutorial', what: 'done', step: all[all.length - 1]?.id ?? '' });
}

/** Skip the rest of the tutorial and the cards that explain things, saying how to have them back. */
export function skipTutorial(ctx: SimContext) {
  const s = ctx.s;
  if (!s.tutorial && !s.lessons) return;
  const step = currentStep(ctx)?.id ?? '';
  setTutorial(ctx, false);
  toast(ctx, 'The tutorial is off. Settings turns it back on.', 'info', undefined, 'ui-advisor');
  emit(ctx, { type: 'tutorial', what: 'skipped', step });
}

/** Turn the tutorial, and the cards that explain things, on or off in the game in progress. */
export function setTutorial(ctx: SimContext, on: boolean) {
  ctx.s.tutorial = on;
  ctx.s.lessons = on;
}

/** The camera has been moved and turned, which is looking around done. */
export function noteLooked(ctx: SimContext) {
  if (!ctx.s.seenTips.includes(LOOKED_TIP)) ctx.s.seenTips.push(LOOKED_TIP);
}
