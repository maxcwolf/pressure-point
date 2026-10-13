// What the simulation tells the outside world: sounds, toasts, announcements and floating text.

import { System } from './system';

export type SimEvent =
  | { type: 'float'; text: string; x: number; y: number; kind: 'good' | 'bad' | 'info' }
  | { type: 'toast'; text: string; kind: 'good' | 'bad' | 'info' }
  | { type: 'sfx'; name: string }
  | { type: 'announce'; text: string }
  | { type: 'star'; stars: number };

export class Events extends System {
  private queue: SimEvent[] = [];

  emit(e: SimEvent) {
    this.queue.push(e);
  }

  drain(): SimEvent[] {
    const e = this.queue;
    this.queue = [];
    return e;
  }

  toast(text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    this.emit({ type: 'toast', text, kind });
  }

  tipOnce(id: string, text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    if (this.s.seenTips.includes(id)) return;
    this.s.seenTips.push(id);
    this.toast(text, kind);
  }
}
