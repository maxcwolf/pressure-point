// The interface's own state: which menu and dialog are open, and the messages on screen.
// The components draw it; the rest of the app talks to it.

import type { DecorKey, ItemType, Role } from '../core/data';
import type { SimEvent, Subject, Tone } from '../core/sim/events';
import type { Template } from '../core/templates';
import { giveKarma } from '../storage/campaign';
import { loadTemplates } from '../storage/templates';
import { voiceFor } from '../voice';
import type { GameHost } from './host';
import type { ItemKind, Place } from './lib/catalog';
import type { OverlayMode } from './lib/overlays';

export type MenuId = 'rooms' | 'items' | 'hire' | 'staff' | 'treatments' | 'finance' | 'policy' | 'stats';
/** The tabs of the Money menu. */
export type MoneyTab = 'books' | 'prices' | 'marketing' | 'loan' | 'land';

/** The tabs of the Rooms menu. */
export type RoomsTab = 'rooms' | 'templates';

/** The tabs of the Stats menu. */
export type StatsTab = 'charts' | 'guests' | 'reputation' | 'standing' | 'casebook' | 'regulars' | 'awards';

export type DialogId =
  'pause' | 'settings' | 'saves' | 'confirm-new' | 'star' | 'karma' | 'awards' | 'visit' | 'buy-plot' | 'update';

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

/** A line in the cheat console: a command typed in, or what came of it. */
export interface ConsoleLine {
  id: number;
  text: string;
  kind: 'typed' | 'good' | 'bad';
}

/** How many toasts are kept on screen at once. */
const MAX_TOASTS = 4;

/** How many lines the cheat console keeps. */
const MAX_CONSOLE_LINES = 40;

export class HudState {
  /** The build menu that is open, if any. */
  menu: MenuId | null = null;
  /** The tab showing in the Rooms menu. */
  roomsTab: RoomsTab = 'rooms';
  /** The room templates saved, kept for every game. */
  templates: Template[] = loadTemplates();
  /** The tab showing in the Hire menu. */
  hireRole: Role = 'receptionist';
  /** The tab showing in the Stats menu. */
  statsTab: StatsTab = 'charts';
  /** The tab showing in the Money menu. */
  moneyTab: MoneyTab = 'books';
  /** The plot of land the pointer is over in the Land tab, shown brighter on the ground. */
  landPointedAt: string | null = null;
  /** The plot of land asked about in the dialog to buy it. */
  plotAsked: string | null = null;
  /** What the floor is colored by, if anything, and whether the list to choose from is open. */
  overlay: OverlayMode | null = null;
  overlayPicker = false;
  /** What the Items menu is filtered to: a place and a kind of item. */
  itemPlace: Place = 'all';
  itemKind: ItemKind | 'all' = 'all';
  /** The deadline of an emergency offer put aside to decide on later, which tells it from any later offer. */
  offerAside: number | null = null;
  /** The deadline of the house call put aside to decide on later, if it is. */
  callAside: number | null = null;
  /** The deadline of the stress outbreak put aside to decide on later, if it is. */
  outbreakAside: number | null = null;
  /** The start day of the mishap coming, if its notice is put aside. */
  mishapAside: number | null = null;
  /** The dialog over the game, if any. */
  dialog: DialogId | null = null;
  /** The star being celebrated while its dialog is open. */
  star = 0;
  /** The locked item asked about in the karma dialog. */
  karmaItem: ItemType | null = null;
  /** The locked floor or wall asked about in the karma dialog, and the room to put it in once unlocked. */
  karmaDecor: { key: DecorKey; roomId: number } | null = null;
  toasts: Toast[] = [];
  floaters: Floater[] = [];
  announcement = '';
  /** Whether the cheat console is open, what it has said so far, and the commands typed, oldest first. */
  consoleOpen = false;
  consoleLines: ConsoleLine[] = [];
  consoleHistory: string[] = [];

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

  /** Open the cheat console, or close it if it is open. */
  toggleConsole() {
    this.consoleOpen = !this.consoleOpen;
    this.update();
  }

  /** Run a command typed into the cheat console, and note it and what came of it. */
  runCommand(line: string) {
    const typed = line.trim();
    if (!typed) return;
    const result = this.host.sim.cheat(typed);
    // karma belongs to the campaign, kept outside the game
    if (result.karma) giveKarma(result.karma);
    this.consoleHistory = [...this.consoleHistory.filter((h) => h !== typed), typed];
    this.consoleLines = [
      ...this.consoleLines,
      { id: this.nextId++, text: typed, kind: 'typed' as const },
      ...result.text
        .split('\n')
        .map((text) => ({ id: this.nextId++, text, kind: result.ok ? 'good' : 'bad' }) as const),
    ].slice(-MAX_CONSOLE_LINES);
    this.update();
  }

  /** Close the open build menu, or the list of overlays. False if neither was open. */
  closeMenu(): boolean {
    if (!this.menu && !this.overlayPicker) return false;
    this.menu = null;
    this.overlayPicker = false;
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

  /** Ask whether to buy a plot of land, in a dialog over the game. */
  askToBuy(plotId: string) {
    this.plotAsked = plotId;
    this.open('buy-plot');
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

  /** React to game events: sounds, toasts, announcements, star awards, visit reports and floating text. */
  handle(events: SimEvent[]) {
    const { view, audio } = this.host;
    for (const e of events) {
      if (e.type === 'sfx') audio.play(e.name);
      else if (e.type === 'toast') this.toast(e.text, e.kind, e.about);
      else if (e.type === 'announce') this.announce(e.text);
      else if (e.type === 'star') {
        this.star = e.stars;
        this.open('star');
      } else if (e.type === 'awards') this.open('awards');
      else if (e.type === 'visit') this.open('visit');
      else this.float(e.text, e.kind, view.project(e.x, e.y, 1.6));
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

  /** Show a banner announcement for a few seconds, with a chime, and the announcer's voice when it is recorded. */
  private announce(text: string) {
    this.announcement = text;
    this.host.audio.play('announce');
    const voice = voiceFor(text);
    if (voice) this.host.audio.speak(voice);
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
