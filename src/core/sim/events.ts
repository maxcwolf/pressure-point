import type { SimContext } from './context';
// What the simulation tells the outside world: sounds, toasts, announcements and floating text.

/** Whether a message is good news, bad news or neither. */
export type Tone = 'good' | 'bad' | 'info';

/** The sound effects the game can ask for. */
export type SfxName =
  'blip' | 'place' | 'error' | 'cash' | 'sell' | 'hire' | 'build' | 'heal' | 'fail' | 'payday' | 'announce' | 'fanfare';

export type SimEvent =
  | { type: 'float'; text: string; x: number; y: number; kind: Tone }
  | { type: 'toast'; text: string; kind: Tone }
  | { type: 'sfx'; name: SfxName }
  | { type: 'announce'; text: string }
  | { type: 'star'; stars: number };

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

/** Show the player a short message. */
export function toast(ctx: SimContext, text: string, kind: Tone = 'info') {
  emit(ctx, { type: 'toast', text, kind });
}

/** Show a tip, but only the first time it comes up. */
export function tipOnce(ctx: SimContext, id: string, text: string, kind: Tone = 'info') {
  if (ctx.s.seenTips.includes(id)) return;
  ctx.s.seenTips.push(id);
  toast(ctx, text, kind);
}
