// The interface's own state: which menu and dialog are open, and the messages on screen.
// The components draw it; the rest of the app talks to it.

import { track } from '../app/analytics';
import { gameProps } from '../app/play-events';
import { voiceFor } from '../audio/voice';
import type { DecorKey, IconId, ItemType, Role } from '../core/data';
import type { SimEvent, Subject, Tone } from '../core/sim/events';
import type { Template } from '../core/templates';
import { giveKarma } from '../storage/campaign';
import { loadTemplates } from '../storage/templates';
import type { GameHost } from './host';
import type { ItemKind, Place } from './lib/catalog';
import { mustAnswer, pendingDialog, raise, type Raised, stillDue } from './lib/dialogs';
import type { OverlayMode } from './lib/overlays';

export type MenuId = 'rooms' | 'items' | 'hire' | 'staff' | 'treatments' | 'finance' | 'policy' | 'stats';
/** The tabs of the Money menu. */
export type MoneyTab = 'books' | 'payroll' | 'prices' | 'marketing' | 'loan' | 'land';

/** The tabs of the Rooms menu. */
export type RoomsTab = 'rooms' | 'templates';

/** The tabs of the Stats menu. */
export type StatsTab = 'charts' | 'guests' | 'reputation' | 'standing' | 'casebook' | 'regulars' | 'awards';

export type DialogId =
  | 'pause'
  | 'settings'
  | 'saves'
  | 'confirm-new'
  | 'confirm-fire'
  | 'confirm-cancel-course'
  | 'star'
  | 'karma'
  | 'awards'
  | 'visit'
  | 'buy-plot'
  | 'payroll'
  | 'bankrupt'
  | 'update';

/** What the interface has the floor show: the overlay chosen, and the plots of land while the Land tab is open. */
export interface FloorShown {
  overlay: OverlayMode | null;
  /** The plots of land, with the one the pointer is over in the Land tab, or null while the tab is closed. */
  land: { pointedAt: string | null } | null;
}

/** A message that fades after a few seconds. */
export interface Toast {
  id: number;
  text: string;
  kind: Tone;
  /** Who or what it is about, if clicking it should take the player there. */
  about?: Subject;
  /** The icon before it, if it has one. */
  icon?: IconId;
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
  /** The member of staff asked about in the dialog to let them go. */
  fireAsked: number | null = null;
  /** The member of staff asked about in the dialog to call off their course. */
  cancelAsked: number | null = null;
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
  /** Dialogs the game raised while another was showing, to show in turn as each closes. */
  private line: Raised[] = [];

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

  /** What the floor shows for the interface, which the game draws over whatever else is on it. */
  get floor(): FloorShown {
    const landTab = this.menu === 'finance' && this.moneyTab === 'land';
    return { overlay: this.overlay, land: landTab ? { pointedAt: this.landPointedAt } : null };
  }

  /** Whether a dialog is open and holding the game's input. */
  get blocking(): boolean {
    return this.dialog !== null;
  }

  /** Open the pause menu. */
  openPauseMenu() {
    this.open('pause');
  }

  /**
   * Open the dialog a stopped game is waiting on, if it is: a payday to borrow for, the center gone bankrupt, or a
   * failed inspection to settle.
   */
  openPending() {
    const pending = pendingDialog(this.host.sim.s);
    if (pending) this.raise(pending);
  }

  /** Close whatever dialog is open and carry on playing. */
  dismiss() {
    // a payday, a bankruptcy and a fine or its way out have to be answered
    if (this.dialog && !mustAnswer(this.dialog, this.host.sim.s)) this.close();
  }

  /** Open a build menu, or close it if it is the one already open. */
  toggleMenu(id: MenuId) {
    // an open blueprint stays open while you fetch something from a menu
    this.host.tools.setAside();
    this.menu = this.menu === id ? null : id;
    if (this.menu) track('menu_opened', { ...gameProps(this.host.sim.s), menu: id });
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

  /** Ask whether to let a member of staff go, in a dialog over the game. */
  askToFire(staffId: number) {
    this.fireAsked = staffId;
    this.open('confirm-fire');
  }

  /** Ask whether to call a member of staff off their course, in a dialog over the game. */
  askToCancelCourse(staffId: number) {
    this.cancelAsked = staffId;
    this.open('confirm-cancel-course');
  }

  /** Open a dialog over the game, pausing it. */
  open(dialog: DialogId) {
    this.pause();
    // the list of saved games should include the game as it is right now
    if (dialog === 'saves') this.warn(this.host.save());
    this.dialog = dialog;
    this.update();
  }

  /** Close the dialog and show the next one waiting, or restore the game speed it paused. */
  close() {
    this.dialog = null;
    const s = this.host.sim.s;
    this.line = this.line.filter((d) => stillDue(d.id, s));
    const next = this.line.shift();
    if (next) {
      this.star = next.star;
      this.open(next.id);
      return;
    }
    if (this.pausedBy !== null) {
      this.host.sim.s.speed = this.pausedBy;
      this.pausedBy = null;
    }
    this.update();
  }

  /** Show a dialog the game raised, or keep it in line behind the one showing. */
  private raise(id: DialogId, star = 0) {
    const showing = this.dialog === null ? null : { id: this.dialog, star: this.dialog === 'star' ? this.star : 0 };
    const { show, line } = raise(showing, this.line, { id, star });
    this.line = line;
    if (show) {
      this.star = show.star;
      this.open(show.id);
    }
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
      else if (e.type === 'toast') this.toast(e.text, e.kind, e.about, e.icon);
      else if (e.type === 'announce') this.announce(e.text);
      else if (e.type === 'star') this.raise('star', e.stars);
      else if (e.type === 'awards') this.raise('awards');
      else if (e.type === 'visit') this.raise('visit');
      // the app notes an achievement for the campaign; its toast says it
      else if (e.type === 'achievement') continue;
      else this.float(e.text, e.kind, view.project(e.x, e.y, 1.6));
    }
  }

  /** Show a message that fades after a few seconds. */
  toast(text: string, kind: Tone = 'info', about?: Subject, icon?: IconId) {
    const toast: Toast = {
      id: this.nextId++,
      text,
      kind,
      leaving: false,
      ...(about && { about }),
      ...(icon && { icon }),
    };
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

  /** Show a warning, if there is one. */
  warn(warning: string | null) {
    if (warning) this.toast(warning, 'bad');
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
