// The tutorial's lessons: a card over the game the first time something happens that is worth explaining, such as
// the first guest walking in or the first payday, each once a game and never two in a day.

import type { IconId } from '../data';
import type { SimContext } from './context';
import { emit, type Subject } from './events';
import { PRIMER_TIRING } from './primer';

/** The lessons, in the order they are checked. */
export const LESSON_IDS = ['guest', 'heal', 'tired', 'payday', 'failed', 'stormed', 'raise'] as const;

export type LessonId = (typeof LESSON_IDS)[number];

/** A picture in a lesson's strip: an icon, a word under it and a line on it. */
export interface LessonPanel {
  icon: IconId;
  label: string;
  note: string;
}

/** What a lesson's card says: a title, a line to open with, a strip of pictures, and a closing word. */
export interface Lesson {
  title: string;
  intro: string;
  panels: LessonPanel[];
  body: string;
}

/** Every lesson's card. */
export const LESSONS: Readonly<Record<LessonId, Lesson>> = {
  guest: {
    title: 'Your first guest',
    intro: 'Your first guest has walked in. Every visit goes the same way.',
    panels: [
      { icon: 'item-reception-desk', label: 'Check in', note: 'They check in at the Reception Desk.' },
      {
        icon: 'room-consult',
        label: 'Consultation',
        note: 'A Wellness Consultant works out what ails them, for a fee.',
      },
      { icon: 'room-massage', label: 'Treatment', note: 'They wait their turn for the treatment it calls for.' },
      { icon: 'ui-money', label: 'Paying', note: 'Each treatment is paid for as it is given.' },
    ],
    body: 'Everyone has a Patience bar, which drains while they wait, and a Condition bar, which worsens. Click anyone to see theirs.',
  },
  heal: {
    title: 'Your first heal',
    intro: 'A guest has gone home healed. That is the whole idea.',
    panels: [
      { icon: 'ui-money', label: 'Money', note: 'The bottom bar keeps the bank, and what came in today.' },
      {
        icon: 'ui-reputation',
        label: 'Reputation',
        note: 'Each heal lifts it, each failure lowers it, and it brings more guests.',
      },
      { icon: 'ui-target', label: 'Objectives', note: 'The objectives at the top left count toward a star.' },
    ],
    body: 'A star opens new rooms, treatments and items. Click any objective for the numbers behind it.',
  },
  tired: {
    title: 'Staff tire',
    intro: 'Your staff are starting to tire. Everyone has an Energy bar that drains as they work.',
    panels: [
      { icon: 'bubble-exhausted', label: 'Worn out', note: 'Tired staff work slowly and botch treatments.' },
      { icon: 'room-staffroom', label: 'Staff Room', note: 'A break in a Staff Room puts their energy back.' },
      { icon: 'ui-staff', label: 'Staff menu', note: "The Staff menu shows everyone's energy at a glance." },
    ],
    body: 'The Policy menu sets when staff go on a break. Too late and they are worn out; too soon and stations stand empty.',
  },
  payday: {
    title: 'Payday',
    intro: 'A month has ended, and the wages have gone out.',
    panels: [
      { icon: 'ui-wages', label: 'Wages', note: 'Everyone on the staff is paid at the end of each month.' },
      {
        icon: 'ui-books',
        label: 'Payroll',
        note: "The Money menu's Payroll tab shows the next payday against the bank.",
      },
      { icon: 'ui-loan', label: 'Loans', note: 'A loan from the Money menu covers a short month.' },
    ],
    body: 'Below zero, the bank charges for the overdraft, and the staff start to worry. Keep the takings ahead of the wages.',
  },
  failed: {
    title: 'A treatment failed',
    intro: 'A treatment did not work, and the guest went home unhealed.',
    panels: [
      {
        icon: 'ui-target',
        label: 'Chance',
        note: "A guest's inspector shows their chance of success, and what lowers it.",
      },
      { icon: 'feeling-bad-vibes', label: 'Bad vibes', note: 'A failure leaves bad vibes in the room it was in.' },
      {
        icon: 'course-smudging',
        label: 'Smudging',
        note: 'A Caretaker trained in Smudging, or a Reiki Practitioner, clears them.',
      },
    ],
    body: 'Skilled, rested staff and a sure diagnosis fail less often. A room with bad vibes says so when you select it.',
  },
  stormed: {
    title: 'Losing patience',
    intro: 'A guest ran out of patience and stormed out, paying nothing.',
    panels: [
      { icon: 'item-bench', label: 'Benches', note: 'Sitting down, guests lose patience more slowly.' },
      { icon: 'item-tea-station', label: 'Tea', note: 'A drink keeps them going, and earns a little.' },
      { icon: 'room-restroom', label: 'Restroom', note: 'Nobody waits patiently while bursting.' },
      {
        icon: 'overlay-patience',
        label: 'The line',
        note: "A station's inspector moves guests up or sends them home.",
      },
    ],
    body: 'The Patience overlay shows where guests are wearing thin. More staff on a busy station shortens the wait.',
  },
  raise: {
    title: 'A raise',
    intro: 'Someone on your staff has asked for a raise.',
    panels: [
      { icon: 'bubble-raise', label: 'Asking', note: 'Staff paid under the going rate ask, then quit if unhappy.' },
      { icon: 'bubble-promoted', label: 'Ranks', note: 'As they gain skill they rise in rank, and expect more.' },
      { icon: 'ui-wages', label: 'The card', note: 'The card at the right gives the raise in a click.' },
    ],
    body: 'Select them to see their pay against the going rate. A Staff Room and a pleasant place to work help too.',
  },
};

/** Whether a lesson's moment has come, and who it is about if anyone. */
function moment(ctx: SimContext, id: LessonId): { about?: Subject } | null {
  const s = ctx.s;
  switch (id) {
    case 'guest': {
      // walked in, not still on the way up the path or already gone
      const g = s.guests.find((x) => x.state !== 'enter' && x.state !== 'leaving');
      return g ? { about: { kind: 'guest', id: g.id } } : null;
    }
    case 'heal':
      return s.stats.healed >= 1 ? {} : null;
    case 'tired': {
      const st = s.staff.find((x) => x.state !== 'leaving' && x.energy < PRIMER_TIRING);
      return st ? { about: { kind: 'staff', id: st.id } } : null;
    }
    case 'payday':
      return s.months.length >= 1 ? {} : null;
    case 'failed':
      return s.stats.failed >= 1 ? {} : null;
    case 'stormed':
      return s.stats.stormed >= 1 ? {} : null;
    case 'raise': {
      const st = s.staff.find((x) => x.state !== 'leaving' && x.raiseAsked);
      return st ? { about: { kind: 'staff', id: st.id } } : null;
    }
  }
}

/** The tip a lesson is kept under once shown, so it is shown once a game. */
export const lessonTip = (id: LessonId) => `lesson-${id}`;

/**
 * Once a second, while the lessons are on: the first lesson whose moment has come and that has not been shown, raised
 * for the interface to show, unless one has been shown already today.
 */
export function checkLessons(ctx: SimContext) {
  const s = ctx.s;
  if (!s.lessons) return;
  const today = Math.floor(s.day);
  if (s.lastLesson >= today) return;
  for (const id of LESSON_IDS) {
    if (s.seenTips.includes(lessonTip(id))) continue;
    const m = moment(ctx, id);
    if (!m) continue;
    s.seenTips.push(lessonTip(id));
    s.lastLesson = today;
    emit(ctx, { type: 'lesson', id, ...(m.about && { about: m.about }) });
    return;
  }
}
