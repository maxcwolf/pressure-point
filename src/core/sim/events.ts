// What the simulation tells the outside world: sounds, toasts, announcements and floating text.

import type { AchievementId, IconId } from '../data';
import type { SimContext } from './context';

/** Whether a message is good news, bad news or neither. */
export type Tone = 'good' | 'bad' | 'info';

/** The sound effects the game can ask for. */
export type SfxName =
  'blip' | 'place' | 'error' | 'cash' | 'sell' | 'hire' | 'build' | 'heal' | 'fail' | 'payday' | 'announce' | 'fanfare';

/** What a message is about, so clicking it can take the player there. */
export interface Subject {
  kind: 'guest' | 'staff' | 'visitor' | 'item' | 'room';
  id: number;
}

export type SimEvent =
  | { type: 'float'; text: string; x: number; y: number; kind: Tone }
  | { type: 'toast'; text: string; kind: Tone; about?: Subject; icon?: IconId }
  | { type: 'sfx'; name: SfxName }
  | { type: 'announce'; text: string }
  | { type: 'star'; stars: number }
  | { type: 'awards'; year: number }
  | { type: 'visit' }
  | { type: 'achievement'; id: AchievementId };

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

/** Show a tip, but only the first time it comes up. */
export function tipOnce(ctx: SimContext, id: string, text: string, kind: Tone = 'info', about?: Subject) {
  if (ctx.s.seenTips.includes(id)) return;
  ctx.s.seenTips.push(id);
  toast(ctx, text, kind, about);
}

/** Say something over the speakers, but only the first time it comes up in a game. */
export function announceOnce(ctx: SimContext, id: string, text: string) {
  if (ctx.s.seenTips.includes(id)) return;
  ctx.s.seenTips.push(id);
  emit(ctx, { type: 'announce', text });
}
