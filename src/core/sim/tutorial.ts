// The tutorial: a new Willow Lane game walked through its opening a step at a time, each step with a card in the
// advisor's spot and a ring on what it wants, then the first game's heads-ups as steps of their own, and a word to hand
// over once all of it is done.

import {
  CAMPAIGN,
  GENERAL_COURSES,
  type ItemType,
  LOAN_RATE,
  OVERDRAFT_RATE,
  type Role,
  ROLES,
  ROOMS,
  type RoomType,
} from '../data';
import { money, pct } from '../format';
import type { SimContext } from './context';
import { monthlyPayroll } from './economy';
import { emit, type Subject, toast } from './events';
import { primerDone, primerLines, primerNotes, type PrimerStepId } from './primer';
import { hasItem, hasRoom, hasStaff } from './progress';

/**
 * What a step wants the player to do, which the interface rings: look around, stop or start the clock, or an item,
 * room or hire.
 */
export type Want =
  | { kind: 'look' }
  | { kind: 'pause' }
  | { kind: 'play' }
  | { kind: 'item'; type: ItemType }
  | { kind: 'room'; type: RoomType }
  | { kind: 'hire'; role: Role };

/** A step of the opening: its line on the list, what its card says (worked out from the game if need be), and what it wants. */
interface Opening {
  id: OpeningId;
  title: string;
  text: string | ((ctx: SimContext) => string);
  want: Want;
}

type OpeningId =
  'look' | 'pause' | 'desk' | 'receptionist' | 'consult' | 'consultant' | 'massage' | 'therapist' | 'play' | 'benches';

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
    text: 'This is your center. W, A, S and D or the edges of the screen move the camera, Q and E turn it, and the mouse wheel zooms. Move and turn it to have a look.',
    want: { kind: 'look' },
  },
  {
    id: 'pause',
    title: 'Pause the clock',
    text: 'The clock at the bottom right is running. Press Space, or its pause button, to stop it while you set up: nothing happens, and nobody arrives, until you start it again.',
    want: { kind: 'pause' },
  },
  {
    id: 'desk',
    title: 'Place a Reception Desk',
    // the first thing bought, so it says where the money comes from; the rest of the word on money waits for its lesson
    text: 'Guests check in at a Reception Desk before anything else. Open the Items menu, pick the Reception Desk and place it near the entrance. It comes out of the bank in the bottom bar, as everything does.',
    want: { kind: 'item', type: 'reception_desk' },
  },
  {
    id: 'receptionist',
    title: 'Hire a Receptionist',
    text: "A desk needs a face behind it. Open the Hire menu and take on a Receptionist. Each applicant's card gives their rank, a star for each, their pay a month, and their quirks, green where they help and red where they cost you. Any of them will do to open, and the lower the rank, the less they ask.",
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
    text: 'The Consultation Room needs someone to run it. Hire a Wellness Consultant. The better their rank, the surer their diagnoses, so fewer guests come back for a second look: weigh that against the pay.',
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
    text: 'Once the clock runs, the center opens and guests come. A Massage Therapist is who treats them in the Massage Suite: hire one before the first is through the consultation. Their card lists the treatments they know: every Therapist knows Swedish massage, which your first guests come for, and some arrive trained in more.',
    want: { kind: 'hire', role: 'therapist' },
  },
  {
    id: 'play',
    title: 'Start the clock',
    text: 'Everything is in place. Press Space, or the play button at the bottom right, to start the clock: the center opens, and the first guests are on their way.',
    want: { kind: 'play' },
  },
  {
    id: 'benches',
    title: 'Put down two Benches',
    text: 'Guests wait for the desk and the rooms, and on their feet they lose patience fast. Place two Benches from the Items menu where the lines form.',
    want: { kind: 'item', type: 'bench' },
  },
];

/** Whether the opening is built and staffed: the desk, the two rooms and the three hires. */
function openingBuilt(ctx: SimContext): boolean {
  return (
    hasItem(ctx, 'reception_desk') &&
    hasStaff(ctx, 'receptionist') &&
    hasRoom(ctx, 'consult') &&
    hasStaff(ctx, 'consultant') &&
    hasRoom(ctx, 'massage') &&
    hasStaff(ctx, 'therapist')
  );
}

/**
 * Whether a step of the opening matters yet: all from the start, but starting the clock once the opening is built and
 * staffed, and the Benches once guests are coming in.
 */
function openingDue(ctx: SimContext, id: OpeningId): boolean {
  switch (id) {
    case 'play':
      return openingBuilt(ctx);
    case 'benches':
      return ctx.s.open;
    default:
      return true;
  }
}

/**
 * Whether a step of the opening is done. The clock counts as paused once the desk is down, the player having got on
 * with it either way, and as started once the opening is built and it runs, so a player who never paused is not asked
 * to start it.
 */
function openingDone(ctx: SimContext, id: OpeningId): boolean {
  const s = ctx.s;
  switch (id) {
    case 'look':
      return s.seenTips.includes(LOOKED_TIP) || s.day >= LOOK_DAYS;
    case 'pause':
      return s.speed === 0 || hasItem(ctx, 'reception_desk');
    case 'play':
      return openingBuilt(ctx) && s.speed > 0;
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

/**
 * What a heads-up step wants rung, by its id: a hire or a room, or nothing for what has no one place to point at. Every
 * heads-up has its case, as in primer.ts, so a new one is not left without a word on what it points at.
 */
function headsWant(ctx: SimContext, id: PrimerStepId): Want | undefined {
  switch (id) {
    // walked through as the opening's own steps
    case 'open':
      return undefined;
    case 'caretaker':
      return { kind: 'hire', role: 'caretaker' };
    case 'smudging':
      return hasRoom(ctx, 'training') ? undefined : { kind: 'room', type: 'training' };
    case 'staffroom':
      return { kind: 'room', type: 'staffroom' };
    // the land for sale is seen with Expand, beside Rooms, which the heads-up says; Show me has nothing to go to
    case 'land':
      return undefined;
  }
}

/** What a heads-up step would spend: once, and every month in a wage. */
function headsSpend(ctx: SimContext, id: PrimerStepId): { cost: number; wage: number } {
  switch (id) {
    case 'caretaker':
      return { cost: 0, wage: ROLES.caretaker.baseSalary };
    case 'smudging':
      return { cost: (hasRoom(ctx, 'training') ? 0 : ROOMS.training.cost) + GENERAL_COURSES.smudging.cost, wage: 0 };
    case 'staffroom':
      return { cost: ROOMS.staffroom.cost, wage: 0 };
    case 'open':
    case 'land':
      return { cost: 0, wage: 0 };
  }
}

/**
 * The word that goes on a step that would leave the bank, on its own, with less than a month's wages: what it would
 * leave, and that the loan is cheaper than the red. Nothing while the bank can take it.
 */
export function spendNote(ctx: SimContext, cost: number, wage: number): string {
  const s = ctx.s;
  const month = monthlyPayroll(s) + wage;
  const after = s.money - cost;
  if (after >= month) return '';
  const leaves =
    after < 0
      ? `would put the bank ${money(-after)} in the red`
      : `would leave ${money(after)} in the bank, less than a month's wages (${money(month)})`;
  return ` This ${leaves}: a loan from the Money menu, at ${pct(LOAN_RATE)} a month, is cheaper than the red at ${pct(OVERDRAFT_RATE)}.`;
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
  return ctx.s.tutorial ? chain(ctx) : [];
}

/** Every step, the opening and then the heads-ups, with whether each is due and done, whether the tutorial is on or not. */
function chain(ctx: SimContext): Step[] {
  const opening = OPENING.map((o) => ({
    id: o.id,
    title: o.title,
    text: typeof o.text === 'string' ? o.text : o.text(ctx),
    want: o.want,
    done: openingDone(ctx, o.id),
    due: openingDue(ctx, o.id),
  }));
  // the heads-up for opening is the opening itself, walked through above; the one on land comes at the first star,
  // long after the rest, so it stays a heads-up of its own rather than hold the tutorial open until then
  const notes = primerNotes(ctx);
  const heads = primerLines(ctx)
    .filter((l) => l.id !== 'open' && l.id !== 'land')
    .map((l) => {
      const note = notes.find((n) => n.id === l.id);
      const want = headsWant(ctx, l.id);
      const { cost, wage } = headsSpend(ctx, l.id);
      return {
        id: l.id,
        title: l.label,
        text: note ? note.text + spendNote(ctx, cost, wage) : '',
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

/**
 * Which step is in hand: the first not yet done that is due, except that the Benches wait behind a heads-up that is
 * due, since a heads-up has trouble coming behind it and the Benches only make the wait kinder. -1 while none is.
 */
function inHand(all: readonly Step[]): number {
  const live = all.flatMap((st, i) => (!st.done && st.due ? [i] : []));
  return live.find((i) => all[i]?.id !== 'benches') ?? live[0] ?? -1;
}

/** Whether a step in hand asks for a hire of this role, which hiring one does. False with no step in hand. */
export const wantsHire = (step: TutorialStep | null, role: Role) =>
  step?.want?.kind === 'hire' && step.want.role === role;

/** The step in hand, or null while none is (or the tutorial is off). */
export function currentStep(ctx: SimContext): TutorialStep | null {
  const all = steps(ctx);
  const i = inHand(all);
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
  const current = inHand(all);
  return all.map((st, i) => ({ id: st.id, label: st.title, done: st.done, current: i === current }));
}

/** The word the tutorial hands over with, once every step is done. */
export const HANDOFF =
  "That's the basics. From here the advisor speaks up when something needs you, and the objectives at the top left earn your first star: click one for the numbers behind it.";

/** The tip noted once the tutorial has handed over, which it does once a game at most. */
export const HANDED_OVER_TIP = 'tutorial-done';

/**
 * Once a second: hand over once every step is done, ending the tutorial for good in this game, and the heads-ups too
 * if they are all in place, so they go without a word of their own. The heads-up on land, which is no step, is left
 * to come at the first star, and ends them then without a word, the handoff having said it.
 */
export function warnTutorial(ctx: SimContext) {
  const s = ctx.s;
  if (!s.tutorial) return;
  const all = steps(ctx);
  if (!all.every((st) => st.done)) return;
  s.tutorial = false;
  if (s.seenTips.includes(HANDED_OVER_TIP)) return;
  s.seenTips.push(HANDED_OVER_TIP);
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

/**
 * Turn the tutorial, and the cards that explain things, on or off in the game in progress. The steps are Willow Lane's
 * alone, so anywhere else only the cards come on, as they do in a game that has handed over already or has every step
 * done: there is nothing left to walk through.
 */
export function setTutorial(ctx: SimContext, on: boolean) {
  const s = ctx.s;
  s.lessons = on;
  s.tutorial =
    on && s.center === CAMPAIGN[0] && !s.seenTips.includes(HANDED_OVER_TIP) && !chain(ctx).every((st) => st.done);
}

/** Whether the tutorial is on in the game in progress: its steps, or the cards that explain things, or both. */
export const tutorialOn = (ctx: SimContext) => ctx.s.tutorial || ctx.s.lessons;

/** The camera has been moved and turned, which is looking around done. */
export function noteLooked(ctx: SimContext) {
  if (!ctx.s.seenTips.includes(LOOKED_TIP)) ctx.s.seenTips.push(LOOKED_TIP);
}
