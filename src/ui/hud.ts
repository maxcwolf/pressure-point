// The interface's own state: which menu and dialog are open, and the messages on screen.
// The components draw it; the rest of the app talks to it.

import { track } from '../app/analytics';
import { gameProps } from '../app/play-events';
import { voiceFor } from '../audio/voice';
import type { DecorKey, IconId, ItemType, Modality, Role } from '../core/data';
import { ANNOUNCEMENTS } from '../core/data';
import type { SimEvent, StaffRequest, Subject, Tone } from '../core/sim/events';
import { type LessonId, LESSONS } from '../core/sim/lessons';
import type { TutorialStep } from '../core/sim/tutorial';
import type { Template } from '../core/templates';
import { giveKarma } from '../storage/campaign';
import { loadDisplay } from '../storage/display';
import { saveTutorialPref } from '../storage/settings';
import { loadTemplates } from '../storage/templates';
import type { GameHost } from './host';
import { AdviceHold } from './lib/advice-hold';
import { Announcer, type Shown } from './lib/announcements';
import { filterItems, type ItemKind, type Place } from './lib/catalog';
import { mustAnswer, pendingDialog, raise, type Raised, stillDue } from './lib/dialogs';
import { addFloater, ageFloaters, amountOf, type Floater } from './lib/floaters';
import { ageMessages, SHOWN, spareMessages, withMessage } from './lib/messages';
import type { OverlayMode } from './lib/overlays';

/** How often the banner looks to move on while a line is up, in milliseconds. */
const ANNOUNCER_TICK = 250;

export type { Floater } from './lib/floaters';

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
  | 'feedback'
  | 'confirm-new'
  | 'confirm-fire'
  | 'confirm-cancel-course'
  | 'confirm-dismiss'
  | 'star'
  | 'karma'
  | 'awards'
  | 'visit'
  | 'buy-plot'
  | 'payroll'
  | 'bankrupt'
  | 'update'
  | 'lesson';

/** What the interface has the floor show: the overlay chosen, and the plots of land while the Land tab is open. */
export interface FloorShown {
  overlay: OverlayMode | null;
  /** The plots of land, with the one the pointer is over in the Land tab, or null while the tab is closed. */
  land: { pointedAt: string | null } | null;
}

/** A lesson as the game raised it: which, and who it is about if anyone. */
export interface RaisedLesson {
  id: LessonId;
  about?: Subject;
}

/** A message on the right, which fades once it has been up long enough to read, or stays until dismissed. */
export interface Toast {
  id: number;
  text: string;
  kind: Tone;
  /** Who or what it is about, if clicking it should take the player there. */
  about?: Subject;
  /** The icon before it, if it has one. */
  icon?: IconId;
  /** How many times it has come up while on screen, shown once it is more than one. */
  count: number;
  /** Milliseconds it has been up while its clock ran. */
  age: number;
  /** Fading out, about to be removed. */
  leaving: boolean;
}

/** A line in the cheat console: a command typed in, or what came of it. */
export interface ConsoleLine {
  id: number;
  text: string;
  kind: 'typed' | 'good' | 'bad';
}

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
  /** The treatment the Staff menu is narrowed to, showing only those who know it or are learning it. */
  staffKnows: Modality | null = null;
  /**
   * The member of staff being compared in the inspector, the one they are compared with once chosen, and whether the
   * list to choose from shows everyone rather than only those in the same role.
   */
  compare: { staffId: number; withId: number | null; everyone: boolean } | null = null;
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
  /** The tutorial's lesson in its dialog, and who it is about if anyone. */
  lesson: RaisedLesson | null = null;
  /** Lessons raised while one was showing or waiting, to show in turn. */
  private lessons: RaisedLesson[] = [];
  /** The locked item asked about in the karma dialog. */
  karmaItem: ItemType | null = null;
  /** The locked floor or wall asked about in the karma dialog, and the room to put it in once unlocked. */
  karmaDecor: { key: DecorKey; roomId: number } | null = null;
  /** The advisor's note on screen, held long enough to read. */
  readonly advice = new AdviceHold();
  /** The messages on the right, oldest first. */
  toasts: Toast[] = [];
  /** Whether every message shows, the pile under the first few opened out. */
  toastsOpen = false;
  /** Whether the messages were opened out from the band over the inspector. */
  private toastsFromStrip = false;
  /** What each member of staff asking for a raise or a promotion said when they asked, for the list under its card. */
  readonly asked = new Map<number, string>();
  /** The card whose list of the staff asking is open, if one is. */
  requestsOpen: StaffRequest | null = null;
  /** Whether the pointer is over a message, which holds their clock while it is read. */
  toastsHeld = false;
  floaters: Floater[] = [];
  /** The banner of announcements along the top, a line at a time. */
  readonly announcer = new Announcer();
  private announceTimer = 0;
  /** Whether the cheat console is open, what it has said so far, and the commands typed, oldest first. */
  consoleOpen = false;
  consoleLines: ConsoleLine[] = [];
  consoleHistory: string[] = [];

  private listeners = new Set<() => void>();
  private nextId = 1;
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

  /** Close the open build menu, the list of overlays, or every message opened out. False if none was open. */
  closeMenu(): boolean {
    if (!this.menu && !this.overlayPicker && !this.toastsOpen) return false;
    this.menu = null;
    this.overlayPicker = false;
    this.toastsOpen = false;
    this.update();
    return true;
  }

  /**
   * What the tutorial's ring is on, from its step in hand and what is open: the button of the menu the step wants, then
   * the tab and card in it, then the blueprint's Build button once a room is planned. Nothing while the thing wanted is
   * in hand, since the tool's hint says what to do with it, or while the advisor's card is not the tutorial's, such as
   * when someone is about to quit.
   */
  guide(): string | null {
    const want = this.host.sim.adviceNote().step?.want;
    if (!want || want.kind === 'look') return null;
    // the clock's buttons, by the speed each sets
    if (want.kind === 'pause') return 'speed:0';
    if (want.kind === 'play') return 'speed:1';
    const { tools } = this.host;
    const tool = tools.tool;
    if (want.kind === 'item') {
      if (tool.kind === 'item') return null;
      if (this.menu !== 'items') return 'menu:items';
      // a filter that hides the card wanted is undone first
      if (!filterItems([want.type], this.itemPlace, 'all').length) return 'filter:place';
      if (!filterItems([want.type], 'all', this.itemKind).length) return 'filter:kind';
      return `item:${want.type}`;
    }
    if (want.kind === 'room') {
      // dragging out the floor and placing the door have the hint to go by, and a ready blueprint wants building
      if (tool.kind === 'room') return tools.plan?.ready ? 'plan:build' : null;
      if (this.menu !== 'rooms') return 'menu:rooms';
      return this.roomsTab === 'rooms' ? `room:${want.type}` : 'tab:rooms';
    }
    if (this.menu !== 'hire') return 'menu:hire';
    // the row of applicants, not one of them: which to hire is the player's to read off the cards
    return this.hireRole === want.role ? 'hire:any' : `role:${want.role}`;
  }

  /** Show the player what a tutorial step wants: open the menu it is in at the right tab, or take them to who it is about. */
  showStep(step: TutorialStep) {
    const want = step.want;
    if (!want || want.kind === 'look' || want.kind === 'pause' || want.kind === 'play') {
      if (step.about) this.show(step.about);
      return;
    }
    this.host.tools.setAside();
    if (want.kind === 'item') {
      // so the card wanted is among those on show
      this.itemPlace = 'all';
      this.itemKind = 'all';
      this.menu = 'items';
    } else if (want.kind === 'room') {
      this.roomsTab = 'rooms';
      this.menu = 'rooms';
    } else {
      this.hireRole = want.role;
      this.menu = 'hire';
    }
    track('menu_opened', { ...gameProps(this.host.sim.s), menu: this.menu });
    track('tutorial_show_me', { ...gameProps(this.host.sim.s), step: step.id });
    this.update();
  }

  /**
   * Show the player what a lesson is about, closing its card: take them to who it happened to, or open the menu it
   * points at, at the tab it names.
   */
  showLesson(raised: RaisedLesson) {
    this.close();
    track('lesson_show_me', { ...gameProps(this.host.sim.s), lesson: raised.id });
    if (raised.about) {
      this.show(raised.about);
      return;
    }
    const showMe = LESSONS[raised.id].showMe;
    if (!showMe) return;
    this.host.tools.setAside();
    this.moneyTab = showMe.moneyTab;
    this.menu = showMe.menu;
    track('menu_opened', { ...gameProps(this.host.sim.s), menu: this.menu });
    this.update();
  }

  /** Skip the rest of the tutorial in this game. Its word to say so comes with the next frame's events. */
  skipTutorial() {
    this.host.sim.skipTutorial();
    this.update();
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
    if (dialog === 'lesson') {
      this.lesson = this.lessons.shift() ?? this.lesson;
      if (this.lesson) track('lesson_shown', { ...gameProps(this.host.sim.s), lesson: this.lesson.id });
    }
    this.dialog = dialog;
    this.update();
  }

  /** Close the dialog and show the next one waiting, or restore the game speed it paused. */
  close() {
    const closing = this.dialog;
    this.dialog = null;
    const s = this.host.sim.s;
    this.line = this.line.filter((d) => stillDue(d.id, s));
    // the next lesson waiting takes its turn behind whatever else is in line
    if (closing === 'lesson' && this.lessons.length) this.line.push({ id: 'lesson', star: 0 });
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
    const { audio } = this.host;
    for (const e of events) {
      if (e.type === 'sfx') audio.play(e.name);
      // a raise or a promotion asked for waits on the card for everyone asking, which keeps what they said
      else if (e.type === 'toast' && e.request && e.about) this.asked.set(e.about.id, e.text);
      else if (e.type === 'toast') this.toast(e.text, e.kind, e.about, e.icon);
      else if (e.type === 'announce') this.announce(e.text);
      else if (e.type === 'star') this.raise('star', e.stars);
      else if (e.type === 'awards') this.raise('awards');
      else if (e.type === 'visit') this.raise('visit');
      // the app notes an achievement for the campaign; its toast says it
      else if (e.type === 'achievement') continue;
      else if (e.type === 'tutorial') this.endTutorial(e.what, e.step);
      else if (e.type === 'lesson') this.raiseLesson(e.id, e.about);
      else this.float(e.text, e.kind, e.x, e.y);
    }
  }

  /** Show a lesson, in line behind any dialog showing, as a star is, and behind any lesson showing or waiting. */
  private raiseLesson(id: LessonId, about?: Subject) {
    this.lessons.push({ id, ...(about && { about }) });
    this.raise('lesson');
  }

  /**
   * The tutorial has ended in this game, done or skipped: the next Willow Lane game starts without it, unless it is
   * switched back on in Settings or on the campaign's card.
   */
  private endTutorial(what: 'done' | 'skipped', step: string) {
    saveTutorialPref(false);
    track(what === 'done' ? 'tutorial_done' : 'tutorial_skipped', { ...gameProps(this.host.sim.s), step });
  }

  /** Show a message at the top of the right side. One saying the same as one already there takes its place, counted. */
  toast(text: string, kind: Tone = 'info', about?: Subject, icon?: IconId) {
    this.toasts = withMessage(this.toasts, {
      id: this.nextId++,
      text,
      kind,
      ...(about && { about }),
      ...(icon && { icon }),
    });
    this.update();
  }

  /**
   * Run the messages' clock for a frame of `dt` seconds, letting go of any whose time is up. It stands still while the
   * game is paused, a dialog is open, the pointer is on a message or every message is opened out.
   */
  tickToasts(dt: number) {
    if (!this.toasts.length || this.toastsHeld || this.toastsOpen || this.host.sim.s.speed === 0) return;
    const { kept, changed } = ageMessages(this.toasts, dt * 1000, loadDisplay().messages);
    this.toasts = kept;
    if (changed) this.update();
  }

  /** Hold the messages' clock while the pointer is on one, bringing back any fading and leaving each a moment more. */
  holdToasts(held: boolean) {
    if (held === this.toastsHeld) return;
    this.toastsHeld = held;
    if (held) spareMessages(this.toasts, loadDisplay().messages);
    this.update();
  }

  /**
   * Open every message out, holding their clock while they are read, or fold the ones past the first few back up.
   * `fromStrip` is for the band over the inspector, which shows fewer than the first few: they open out from it
   * whatever their number, and stay open until folded or every one is dismissed.
   */
  openToasts(open: boolean, fromStrip = false) {
    this.toastsFromStrip = open && fromStrip;
    this.toastsOpen = open && (fromStrip || this.toasts.length > SHOWN);
    if (this.toastsOpen) spareMessages(this.toasts, loadDisplay().messages);
    this.update();
  }

  /** Open the list of the staff asking for a raise or a promotion under its card, or close it. */
  toggleRequests(which: StaffRequest) {
    this.requestsOpen = this.requestsOpen === which ? null : which;
    this.update();
  }

  /** Dismiss a message. */
  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.letGoOfToasts();
  }

  /** Dismiss every message. */
  dismissAllToasts() {
    this.toasts = [];
    this.letGoOfToasts();
  }

  /**
   * After messages are dismissed: fold the rest up once they all fit, and let their clock run, since the message the
   * pointer was on has gone and the next one along says nothing until the pointer moves onto it.
   */
  private letGoOfToasts() {
    if (this.toasts.length <= (this.toastsFromStrip ? 0 : SHOWN)) this.toastsOpen = false;
    this.toastsHeld = false;
    this.update();
  }

  /** Show a warning, if there is one. */
  warn(warning: string | null) {
    if (warning) this.toast(warning, 'bad');
  }

  /**
   * Put an announcement on the banner for a few seconds, or in line behind the one showing. A joke over the speakers
   * while another line shows is let go.
   */
  private announce(text: string) {
    const flavor = (ANNOUNCEMENTS as readonly string[]).includes(text);
    const shown = this.announcer.offer(text, flavor, performance.now() / 1000);
    if (shown) this.speak(shown);
    this.moveAnnouncerOn();
  }

  /** While a line is up, look in now and then for the next to take its place, or for the banner to clear. */
  private moveAnnouncerOn() {
    clearTimeout(this.announceTimer);
    if (!this.announcer.shown) return;
    this.announceTimer = window.setTimeout(() => {
      const { next, changed } = this.announcer.tick(performance.now() / 1000);
      if (next) this.speak(next);
      else if (changed) this.update();
      this.moveAnnouncerOn();
    }, ANNOUNCER_TICK);
  }

  /** Chime for a line as it goes up, with the announcer's voice when it is recorded. */
  private speak(shown: Shown) {
    this.host.audio.play('announce');
    const voice = voiceFor(shown.text);
    if (voice) this.host.audio.speak(voice);
    this.update();
  }

  /** Show text drifting up from a point in the world, added to money just shown beside it or stacked above it. */
  private float(text: string, kind: Tone, x: number, y: number) {
    const floater: Floater = { id: this.nextId++, text, kind, x, y, age: 0, amount: amountOf(text), row: 0 };
    this.floaters = addFloater(this.floaters, floater);
    this.update();
  }

  /** Run the floating text on by `dt` seconds, dropping what has run its course. */
  ageFloaters(dt: number) {
    if (!this.floaters.length) return;
    const before = this.floaters.length;
    this.floaters = ageFloaters(this.floaters, dt);
    if (this.floaters.length !== before) this.update();
  }
}
