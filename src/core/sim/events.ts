// What the simulation tells the outside world: sounds, toasts, announcements and floating text.

import type { AchievementId, IconId } from '../data';
import type { SimContext } from './context';
import type { LessonId } from './lessons';

/** Whether a message is good news, bad news or neither. */
export type Tone = 'good' | 'bad' | 'info';

/** The sound effects the game can ask for. */
export type SfxName =
  | 'blip'
  | 'place'
  | 'error'
  | 'cash'
  | 'sell'
  | 'hire'
  | 'build'
  | 'heal'
  | 'fail'
  | 'payday'
  | 'announce'
  | 'fanfare'
  | 'yelp'
  | 'alarm';

/** What a message is about, so clicking it can take the player there. */
export interface Subject {
  kind: 'guest' | 'staff' | 'visitor' | 'item' | 'room';
  id: number;
}

/** The town paper on top of a payday's message: its name, the issue, the lead headline in capitals, and the "Also". */
export interface Headline {
  name: string;
  issue: number;
  lead: string;
  also?: string;
}

/**
 * Something a member of staff asks for, which waits on a card of its own until it is answered: a raise, a promotion,
 * or the training a promotion they have the experience for still needs.
 */
export type StaffRequest = 'raise' | 'promotion' | 'training';

export type SimEvent =
  | { type: 'float'; text: string; x: number; y: number; kind: Tone }
  | {
      type: 'toast';
      text: string;
      kind: Tone;
      about?: Subject;
      icon?: IconId;
      request?: StaffRequest;
      /** Which message this is, if it is kept up to date: one with the same key on screen gives way to it. */
      key?: string;
      /** The town paper's headlines, on the payday that prints it. */
      headline?: Headline;
    }
  | { type: 'sfx'; name: SfxName }
  | { type: 'announce'; text: string }
  | { type: 'star'; stars: number }
  /** An ailment is going around: its dialog, a week before its guests come. */
  | { type: 'wave' }
  | { type: 'awards'; year: number }
  | { type: 'visit' }
  | { type: 'achievement'; id: AchievementId }
  /** A gift to the Foundation has been made: how many have been, all told. */
  | { type: 'gift'; n: number }
  /** The tutorial ended in this game: done, or skipped at a step. */
  | { type: 'tutorial'; what: 'done' | 'skipped'; step: string }
  /** Something has happened for the first time that a lesson explains, about someone if it is. */
  | { type: 'lesson'; id: LessonId; about?: Subject };

/** Whether an event earns something for the campaign, which is noted at once so its karma can be spent straight away. */
export const earnsForCampaign = (e: SimEvent): boolean =>
  e.type === 'star' || e.type === 'achievement' || e.type === 'gift';

/** Queue an event for the outside world. */
export function emit(ctx: SimContext, e: SimEvent) {
  ctx.events.push(e);
}

/** Hand over the queued events and start a fresh queue. */
export function drainEvents(ctx: SimContext): SimEvent[] {
  const e = ctx.events;
  ctx.events = [];
  return e;
}

/**
 * Show the player a short message, optionally about someone or something they can be taken to, with an icon before
 * it that says at a glance what it is about, and with a key if it is kept up to date while it is on screen.
 */
export function toast(
  ctx: SimContext,
  text: string,
  kind: Tone = 'info',
  about?: Subject,
  icon?: IconId,
  key?: string,
) {
  emit(ctx, { type: 'toast', text, kind, ...(about && { about }), ...(icon && { icon }), ...(key && { key }) });
}

/**
 * Say what a member of staff asks for: a raise, a promotion or training. The card for everyone asking says that much, so this is
 * what they said in their own words, kept for it rather than shown as a message of its own.
 */
export function staffRequest(ctx: SimContext, st: { id: number }, request: StaffRequest, text: string, kind: Tone) {
  emit(ctx, { type: 'toast', text, kind, about: { kind: 'staff', id: st.id }, request });
}

/** Show a tip, but only the first time it comes up, with an icon before it if one says what it is about. */
export function tipOnce(
  ctx: SimContext,
  id: string,
  text: string,
  kind: Tone = 'info',
  about?: Subject,
  icon?: IconId,
) {
  if (ctx.s.seenTips.includes(id)) return;
  ctx.s.seenTips.push(id);
  toast(ctx, text, kind, about, icon);
}

/** Say something over the speakers, but only the first time it comes up in a game. */
export function announceOnce(ctx: SimContext, id: string, text: string) {
  if (ctx.s.seenTips.includes(id)) return;
  ctx.s.seenTips.push(id);
  emit(ctx, { type: 'announce', text });
}
