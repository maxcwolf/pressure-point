// The simulation as the rest of the game sees it: one clock to tick, and the commands and
// questions the interface needs. The work is done by the systems in this folder.

import {
  DAY_SECONDS,
  DAYS_PER_MONTH,
  type Discipline,
  type ItemType,
  type Modality,
  type ModalityDef,
  type RoomType,
} from '../data';
import type { Char, GameState, Guest, Item, Room, Staff, WallSpot } from '../state/types';
import type { Check, Rect, World } from '../world';
import type { PlaceOptions } from './building';
import type { SimEvent } from './events';
import type { Objective } from './progress';
import { Systems } from './systems';
import type { Course } from './training';
import type { DeliveryProblem } from './treatments';

export class Sim {
  readonly world: World;
  private readonly sys: Systems;
  /** Seconds until the next round of once-a-second checks. */
  private slowT = 0;

  constructor(readonly s: GameState) {
    this.sys = new Systems(s);
    this.world = this.sys.world;
  }

  // ---- The clock -------------------------------------------------------------

  /** Advance the game by a frame's worth of real time, at the game's current speed. */
  tick(dtReal: number) {
    let total = Math.min(dtReal, 0.1) * this.s.speed;
    while (total > 1e-6) {
      const h = Math.min(total, 0.05);
      this.step(h);
      total -= h;
    }
  }

  /** Advance every system by one small step of game time. */
  private step(dt: number) {
    const { s, sys } = this;
    const prevMonth = Math.floor(s.day / DAYS_PER_MONTH);
    s.day += dt / DAY_SECONDS;
    if (Math.floor(s.day / DAYS_PER_MONTH) !== prevMonth) sys.economy.monthEnd();

    sys.progress.checkOpening();
    sys.guests.arrive(dt);
    sys.stations.update(dt);
    for (const g of [...s.guests]) sys.guests.update(g, dt);
    for (const st of [...s.staff]) sys.staffing.update(st, dt);
    sys.upkeep.decay(dt);

    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 1;
      sys.ambience.update();
      sys.emergencies.update();
      sys.progress.checkStars();
    }
    sys.advisor.announce(dt);
  }

  // ---- Events ----------------------------------------------------------------

  /** Queue something for the interface to show or play. */
  emit(e: SimEvent) {
    this.sys.events.emit(e);
  }

  /** Take everything queued since the last call. */
  drain(): SimEvent[] {
    return this.sys.events.drain();
  }

  // ---- People ----------------------------------------------------------------

  /** The guest with this id. */
  guest(id: number): Guest | undefined {
    return this.sys.chars.guest(id);
  }

  /** The member of staff with this id. */
  staff(id: number): Staff | undefined {
    return this.sys.chars.staff(id);
  }

  /** The guest or member of staff with this id. */
  char(id: number): Char | undefined {
    return this.sys.chars.char(id);
  }

  // ---- Progress and advice ---------------------------------------------------

  /** What stands between the center and its next star. */
  objectives(): Objective[] {
    return this.sys.progress.objectives();
  }

  /** Whether a finished room of this type exists. */
  hasRoom(type: RoomType): boolean {
    return this.sys.progress.hasRoom(type);
  }

  /** The advisor's current nudge. */
  advice(): string {
    return this.sys.advisor.advice();
  }

  // ---- Surroundings ----------------------------------------------------------

  /** How fast patience drains on a tile: slower in pleasant surroundings, faster in grim ones. */
  drainFactor(x: number, y: number): number {
    return this.sys.ambience.drainFactor(x, y);
  }

  /** A room's prestige, from one to five. */
  prestige(room: Room): number {
    return this.sys.ambience.prestige(room);
  }

  // ---- Treatments ------------------------------------------------------------

  /** Whether a discipline is switched on for this game. */
  enabled(d: Discipline): boolean {
    return this.sys.treatments.enabled(d);
  }

  /** Switch an optional discipline on or off. */
  setDiscipline(d: Discipline, on: boolean) {
    this.sys.treatments.setDiscipline(d, on);
  }

  /** Whether the center can take guests for a discipline: it is on and has a finished room. */
  offered(d: Discipline): boolean {
    return this.sys.treatments.offered(d);
  }

  /** Whether a modality has been unlocked. */
  unlocked(m: Modality): boolean {
    return this.sys.treatments.unlocked(m);
  }

  /** The modality that treats a guest's condition. */
  modalityOf(g: Guest): ModalityDef {
    return this.sys.treatments.modalityOf(g);
  }

  /** Why a table cannot deliver a modality properly right now. */
  deliveryProblem(table: Item, staff: Staff | undefined, def: ModalityDef): DeliveryProblem {
    return this.sys.treatments.deliveryProblem(table, staff, def);
  }

  // ---- Staff -----------------------------------------------------------------

  /** Hire an applicant. */
  hire(candidateId: number): Staff | null {
    return this.sys.staffing.hire(candidateId);
  }

  /** Let a member of staff go. */
  fire(id: number) {
    this.sys.staffing.fire(id);
  }

  /** What a member of staff could reasonably expect to be paid. */
  fairPay(st: Staff): number {
    return this.sys.staffing.fairPay(st);
  }

  /** The salary a raise would take a member of staff to. */
  raiseTo(st: Staff): number {
    return this.sys.staffing.raiseTo(st);
  }

  /** Give a member of staff a raise. */
  giveRaise(id: number) {
    this.sys.staffing.giveRaise(id);
  }

  /** Courses a member of staff could take right now. */
  courses(st: Staff): Course[] {
    return this.sys.training.courses(st);
  }

  /** Why a course cannot start. */
  trainBlocker(st: Staff, course: Course): string {
    return this.sys.training.blocker(st, course);
  }

  /** Send a member of staff on a course. */
  train(staffId: number, courseId: string): boolean {
    return this.sys.training.train(staffId, courseId);
  }

  // ---- Money -----------------------------------------------------------------

  /** Borrow one step more from the bank. */
  borrow(): boolean {
    return this.sys.economy.borrow();
  }

  /** Pay one step of the loan back. */
  repay(): boolean {
    return this.sys.economy.repay();
  }

  /** Set the multiplier on every fee. */
  setPrice(level: number) {
    this.sys.economy.setPrice(level);
  }

  // ---- Emergencies -----------------------------------------------------------

  /** Put an emergency on the table. */
  offerEmergency(): boolean {
    return this.sys.emergencies.offer();
  }

  /** Take on the emergency on offer. */
  acceptEmergency() {
    this.sys.emergencies.accept();
  }

  /** Turn the emergency on offer down. */
  declineEmergency() {
    this.sys.emergencies.decline();
  }

  // ---- Building --------------------------------------------------------------

  /** Buy an item and put it down. */
  placeItem(type: ItemType, x: number, y: number, rot: number, opts: PlaceOptions = {}): Item | null {
    return this.sys.building.placeItem(type, x, y, rot, opts);
  }

  /** Whether an item could be picked up and put down somewhere else. */
  canMoveItem(it: Item, x: number, y: number, rot: number): Check {
    return this.sys.building.canMoveItem(it, x, y, rot);
  }

  /** Move an item for free. */
  moveItem(id: number, x: number, y: number, rot: number): boolean {
    return this.sys.building.moveItem(id, x, y, rot);
  }

  /** Whether an item can be sold without leaving its room short of something it requires. */
  canSell(it: Item): boolean {
    return this.sys.building.canSell(it);
  }

  /** Sell an item for half its price. */
  sellItem(id: number) {
    this.sys.building.sellItem(id);
  }

  /** Lay out the blueprint of a room. */
  createRoom(type: RoomType, r: Rect, door: WallSpot): Room {
    return this.sys.building.createRoom(type, r, door);
  }

  /** Build a blueprint and pay for it. */
  finishRoom(room: Room) {
    this.sys.building.finishRoom(room);
  }

  /** Remove a room, refunding a fraction of what it cost. */
  removeRoom(roomId: number, refund: number) {
    this.sys.building.removeRoom(roomId, refund);
  }

  /** Required furniture a room still lacks. */
  missingItems(room: Room): ItemType[] {
    return this.sys.building.missingItems(room);
  }

  /** Add a window to a stretch of wall, or take out the one already there. */
  toggleWindow(roomId: number, spot: WallSpot): 'added' | 'removed' | '' {
    return this.sys.building.toggleWindow(roomId, spot);
  }

  /** Move a room's door to another stretch of its wall. */
  moveDoor(roomId: number, door: WallSpot): boolean {
    return this.sys.building.moveDoor(roomId, door);
  }
}
