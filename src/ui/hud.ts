// The interface's own state: which menu and dialog are open, and the messages on screen.
// The components draw it; the rest of the app talks to it.

import type { Role } from '../core/data';
import type { SimEvent, Subject, Tone } from '../core/sim/events';
import type { GameHost } from './host';
import type { ItemKind, Place } from './lib/catalog';

export type MenuId = 'rooms' | 'items' | 'hire' | 'staff' | 'treatments' | 'finance' | 'stats';
export type DialogId = 'pause' | 'settings' | 'saves' | 'confirm-new' | 'star';

/** A message that fades after a few seconds. */
export interface Toast {
  id: number;
  text: string;
  kind: Tone;
  /** Who or what it is about, if clicking it should take the player there. */
  about?: Subject;
  /** Fading out, about to be removed. */
  leaving: boolean;
}

/** Text that drifts up from a point in the world, such as money earned. */
export interface Floater {
  id: number;
  text: string;
  kind: Tone;
  x: number;
  y: number;
}

/** How many toasts are kept on screen at once. */
const MAX_TOASTS = 4;

export class HudState {
  /** The build menu that is open, if any. */
  menu: MenuId | null = null;
  /** The tab showing in the Hire menu. */
  hireRole: Role = 'receptionist';
  /** What the Items menu is filtered to: a place and a kind of item. */
  itemPlace: Place = 'all';
  itemKind: ItemKind | 'all' = 'all';
  /** The deadline of an emergency offer put aside to decide on later, which tells it from any later offer. */
  offerAside: number | null = null;
  /** The dialog over the game, if any. */
  dialog: DialogId | null = null;
  /** The star being celebrated while its dialog is open. */
  star = 0;
  toasts: Toast[] = [];
  floaters: Floater[] = [];
  announcement = '';

  private listeners = new Set<() => void>();
  private nextId = 1;
  private announceTimer = 0;
  /** The game speed to go back to when the dialog closes. */
  private pausedBy: number | null = null;

  constructor(readonly host: GameHost) {}

  /** Call a function whenever the interface should redraw. Returns a way to stop. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Redraw the interface from the current state of the game. */
  update() {
    for (const listener of this.listeners) listener();
  }

  /** Whether a dialog is open and holding the game's input. */
  get blocking(): boolean {
    return this.dialog !== null;
  }

  /** Open the pause menu. */
  openPauseMenu() {
    this.open('pause');
  }

  /** Close whatever dialog is open and carry on playing. */
  dismiss() {
    if (this.dialog) this.close();
  }

  /** Open a build menu, or close it if it is the one already open. */
  toggleMenu(id: MenuId) {
    // an open blueprint stays open while you fetch something from a menu
    this.host.tools.setAside();
    this.menu = this.menu === id ? null : id;
  }

  /** Close the open build menu. False if none was open. */
  closeMenu(): boolean {
    if (!this.menu) return false;
    this.menu = null;
    this.update();
    return true;
  }

  /** Take the player to what a message is about: select it, show its inspector and glide the camera over. */
  show(about: Subject) {
    const spot = this.host.sim.whereIs(about);
    if (!spot) return;
    // a build menu shares the space the inspector needs
    this.menu = null;
    this.host.tools.select(about);
    this.host.view.lookAt(spot[0], spot[1]);
    this.update();
  }

  /** Open a dialog over the game, pausing it. */
  open(dialog: DialogId) {
    this.pause();
    // the list of saved games should include the game as it is right now
    if (dialog === 'saves') this.host.save();
    this.dialog = dialog;
    this.update();
  }

  /** Close the dialog and restore the game speed it paused. */
  close() {
    this.dialog = null;
    if (this.pausedBy !== null) {
      this.host.sim.s.speed = this.pausedBy;
      this.pausedBy = null;
    }
    this.update();
  }

  /** Pause the game, remembering the speed to return to. */
  private pause() {
    const s = this.host.sim.s;
    this.pausedBy ??= s.speed;
    s.speed = 0;
  }

  /** React to game events: sounds, toasts, announcements, star awards and floating text. */
  handle(events: SimEvent[]) {
    const { view, audio } = this.host;
    for (const e of events) {
      if (e.type === 'sfx') audio.play(e.name);
      else if (e.type === 'toast') this.toast(e.text, e.kind, e.about);
      else if (e.type === 'announce') this.announce(e.text);
      else if (e.type === 'star') {
        this.star = e.stars;
        this.open('star');
      } else this.float(e.text, e.kind, view.project(e.x, e.y, 1.6));
    }
  }

  /** Show a message that fades after a few seconds. */
  toast(text: string, kind: Tone = 'info', about?: Subject) {
    const toast: Toast = { id: this.nextId++, text, kind, leaving: false, ...(about && { about }) };
    this.toasts = [...this.toasts, toast].slice(-MAX_TOASTS);
    setTimeout(() => {
      toast.leaving = true;
      this.update();
    }, 6500);
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t !== toast);
      this.update();
    }, 7000);
    this.update();
  }

  /** Show a banner announcement for a few seconds, with a chime. */
  private announce(text: string) {
    this.announcement = text;
    this.host.audio.play('announce');
    clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      this.announcement = '';
      this.update();
    }, 8000);
    this.update();
  }

  /** Show text drifting up from a point on screen. */
  private float(text: string, kind: Tone, at: { x: number; y: number }) {
    const floater: Floater = { id: this.nextId++, text, kind, x: at.x, y: at.y };
    this.floaters = [...this.floaters, floater];
    setTimeout(() => {
      this.floaters = this.floaters.filter((f) => f !== floater);
      this.update();
    }, 1500);
    this.update();
  }
}
