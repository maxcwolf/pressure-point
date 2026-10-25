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

/** Something a member of staff asks for, which waits on a card of its own until it is answered. */
export type StaffRequest = 'raise' | 'promotion';

export type SimEvent =
  | { type: 'float'; text: string; x: number; y: number; kind: Tone }
  | { type: 'toast'; text: string; kind: Tone; about?: Subject; icon?: IconId; request?: StaffRequest }
  | { type: 'sfx'; name: SfxName }
  | { type: 'announce'; text: string }
  | { type: 'star'; stars: number }
  | { type: 'awards'; year: number }
  | { type: 'visit' }
  | { type: 'achievement'; id: AchievementId }
  /** The tutorial ended in this game: done, or skipped at a step. */
  | { type: 'tutorial'; what: 'done' | 'skipped'; step: string }
  /** Something has happened for the first time that a lesson explains, about someone if it is. */
  | { type: 'lesson'; id: LessonId; about?: Subject };

/** Whether an event earns something for the campaign, which is noted at once so its karma can be spent straight away. */
export const earnsForCampaign = (e: SimEvent): boolean => e.type === 'star' || e.type === 'achievement';

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
 * Show the player a short message, optionally about someone or something they can be taken to, and with an icon
 * before it that says at a glance what it is about.
 */
export function toast(ctx: SimContext, text: string, kind: Tone = 'info', about?: Subject, icon?: IconId) {
  emit(ctx, { type: 'toast', text, kind, ...(about && { about }), ...(icon && { icon }) });
}

/**
 * Say what a member of staff asks for: a raise or a promotion. The card for everyone asking says that much, so this is
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
