// What the simulation tells the outside world: sounds, toasts, announcements and floating text.

import { System } from './system';

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

export class Events extends System {
  private queue: SimEvent[] = [];

  /** Queue an event for the outside world. */
  emit(e: SimEvent) {
    this.queue.push(e);
  }

  /** Hand over the queued events and start a fresh queue. */
  drain(): SimEvent[] {
    const e = this.queue;
    this.queue = [];
    return e;
  }

  /** Show the player a short message. */
  toast(text: string, kind: Tone = 'info') {
    this.emit({ type: 'toast', text, kind });
  }

  /** Show a tip, but only the first time it comes up. */
  tipOnce(id: string, text: string, kind: Tone = 'info') {
    if (this.s.seenTips.includes(id)) return;
    this.s.seenTips.push(id);
    this.toast(text, kind);
  }
}
