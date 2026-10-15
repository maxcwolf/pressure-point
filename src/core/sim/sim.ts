// The simulation as the rest of the game sees it: one clock to tick, and the commands and
// questions the interface needs. The work is done by the functions in this folder.

import {
  type CampaignKind,
  centerOf,
  type ConditionId,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  type Discipline,
  type Duty,
  ITEMS,
  type ItemType,
  type Modality,
  type ModalityDef,
  type RoomType,
} from '../data';
import type { Char, GameState, Guest, Item, MonthRecord, Room, Staff, WallSpot } from '../state/types';
import type { Check, Rect, World } from '../world';
import { checkAchievements } from './achievements';
import { type Advice, advice, advise, announce } from './advisor';
import { drainFactor, prestige, updateAmbience } from './ambience';
import { holdAwards, YEAR_MONTHS } from './awards';
import type { PlaceOptions } from './building';
import {
  canMoveItem,
  canSell,
  createRoom,
  finishRoom,
  missingItems,
  moveDoor,
  moveItem,
  placeItem,
  removeRoom,
  resizeRoom,
  roomRefund,
  sellItem,
  toggleWindow,
} from './building';
import { acceptCall, callFee, declineCall, updateCalls, whoCanGo } from './calls';
import { promote, reject, setDuty, updateApplicants, updateHabits } from './careers';
import { challengeObjective, updateChallenge } from './challenges';
import { charById, guestById, staffById } from './chars';
import { createContext, type SimContext } from './context';
import { borrow, monthEnd, priceFor, repay, setPrice, setTechniquePrice } from './economy';
import { acceptEmergency, declineEmergency, offerEmergency, updateEmergency } from './emergencies';
import type { SimEvent, Subject } from './events';
import { drainEvents, emit } from './events';
import { admitGuests, updateGuest } from './guests';
import { campaignBlocker, campaignCost, startCampaign, updateCampaigns } from './marketing';
import { itemNoise, noiseAt, updateNoise } from './noise';
import { acceptOutbreak, calm, type CalmResult, declineOutbreak, offerOutbreak, updateOutbreak } from './outbreaks';
import { type PolicyChange, setPolicy, setRoomPriority } from './policy';
import type { Objective } from './progress';
import { checkOpening, checkStars, hasRoom, objectives } from './progress';
import { moveInLine, moveToStation, sendHome, shortestOtherLine } from './queues';
import { monthSoFar } from './records';
import { aboutToQuit, daysUntilQuit, fairPay, fire, giveRaise, hire, raiseTo, updateStaff } from './staffing';
import { type Chance, successChance, updateStations } from './stations';
import { subjectSpot } from './subjects';
import type { Course } from './training';
import { courses, train, trainBlocker } from './training';
import type { DeliveryProblem } from './treatments';
import { deliveryProblem, enabled, modalityOf, offered, setDiscipline, unlocked } from './treatments';
import { inRush, type Season, seasonOf, updateTwists } from './twists';
import { decayItems } from './upkeep';
import { fadeVibes } from './vibes';
import { outdoorTemp, updateWarmth, warmthAt } from './warmth';

export class Sim {
  readonly world: World;
  private readonly ctx: SimContext;
  /** Seconds until the next round of once-a-second checks. */
  private slowT = 0;

  constructor(readonly s: GameState) {
    this.ctx = createContext(s);
    this.world = this.ctx.world;
    // how pleasant each spot is counts from the start, not only once a second of play has passed
    updateAmbience(this.ctx);
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
    const { ctx } = this;
    const { s } = ctx;
    const prevMonth = Math.floor(s.day / DAYS_PER_MONTH);
    s.day += dt / DAY_SECONDS;
    const month = Math.floor(s.day / DAYS_PER_MONTH);
    if (month !== prevMonth) {
      monthEnd(ctx);
      if (month % YEAR_MONTHS === 0) holdAwards(ctx, month / YEAR_MONTHS);
    }

    checkOpening(ctx);
    admitGuests(ctx, dt);
    updateStations(ctx, dt);
    for (const g of [...s.guests]) updateGuest(ctx, g, dt);
    for (const st of [...s.staff]) updateStaff(ctx, st, dt);
    decayItems(ctx, dt);
    fadeVibes(ctx, dt);

    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 1;
      updateAmbience(ctx);
      updateNoise(ctx);
      updateWarmth(ctx);
      updateEmergency(ctx);
      updateOutbreak(ctx);
      checkStars(ctx);
      checkAchievements(ctx);
      updateChallenge(ctx);
      updateApplicants(ctx);
      updateCampaigns(ctx);
      updateCalls(ctx);
      updateHabits(ctx);
    }
    announce(ctx, dt);
    updateTwists(ctx, dt);
  }

  // ---- Events ----------------------------------------------------------------

  /** Queue something for the interface to show or play. */
  emit(e: SimEvent) {
    emit(this.ctx, e);
  }

  /** Take everything queued since the last call. */
  drain(): SimEvent[] {
    return drainEvents(this.ctx);
  }

  // ---- People ----------------------------------------------------------------

  /** The guest with this id. */
  guest(id: number): Guest | undefined {
    return guestById(this.ctx, id);
  }

  /** The member of staff with this id. */
  staff(id: number): Staff | undefined {
    return staffById(this.ctx, id);
  }

  /** The guest or member of staff with this id. */
  char(id: number): Char | undefined {
    return charById(this.ctx, id);
  }

  // ---- Progress and advice ---------------------------------------------------

  /** How the challenge a member of staff has set is going, if there is one. */
  challengeObjective(): Objective | null {
    return this.s.challenge ? challengeObjective(this.ctx, this.s.challenge) : null;
  }
  /** What stands between the center and its next star. */
  objectives(): Objective[] {
    return objectives(this.ctx);
  }

  /** Whether a finished room of this type exists. */
  hasRoom(type: RoomType): boolean {
    return hasRoom(this.ctx, type);
  }

  /** The advisor's current nudge. */
  advice(): string {
    return advice(this.ctx);
  }
  /** The advisor's current nudge, with what it is about, if anything. */
  adviceNote(): Advice {
    return advise(this.ctx);
  }
  /** Days until a miserable member of staff walks out, or null while they are not on course to quit. */
  daysUntilQuit(st: Staff): number | null {
    return daysUntilQuit(st);
  }
  /** Whether someone will walk out within two days unless something changes. */
  aboutToQuit(st: Staff): boolean {
    return aboutToQuit(st);
  }

  /** Whether it is rush hour here right now: only in a center that has them. */
  rushHour(): boolean {
    return !!centerOf(this.s).rush && inRush(this.s.day);
  }

  /** The season now, in a center that has seasons; null elsewhere. */
  season(): Season | null {
    return centerOf(this.s).seasons ? seasonOf(this.s.day) : null;
  }

  /** This month so far, in the same shape as the finished months in `s.months`. */
  monthSoFar(): MonthRecord {
    return monthSoFar(this.ctx);
  }

  /** Where on the ground a message's subject is now, or null if it has gone. */
  whereIs(about: Subject): [x: number, y: number] | null {
    return subjectSpot(this.ctx, about);
  }

  // ---- Surroundings ----------------------------------------------------------

  /** Work out again how pleasant each spot is, for an overlay drawn while the game is paused. */
  refreshAmbience() {
    updateAmbience(this.ctx);
    updateNoise(this.ctx);
    updateWarmth(this.ctx);
  }
  /** How fast patience drains on a tile: slower in pleasant surroundings, faster in grim ones. */
  drainFactor(x: number, y: number): number {
    return drainFactor(this.ctx, x, y);
  }
  /** How noisy a tile is: 0 is silent, and from NOISE_LOUD it is loud. */
  noiseAt(x: number, y: number): number {
    return noiseAt(this.ctx, x, y);
  }
  /** How warm a tile is, in degrees Fahrenheit. */
  warmthAt(x: number, y: number): number {
    return warmthAt(this.ctx, x, y);
  }
  /** How noisy it is at an item, such as a treatment table. */
  itemNoise(it: Item): number {
    return itemNoise(this.ctx, it);
  }
  /** The temperature outside today. */
  outdoorTemp(): number {
    return outdoorTemp(centerOf(this.s).climate, this.s.day);
  }

  /** A room's prestige, from one to five. */
  prestige(room: Room): number {
    return prestige(this.ctx, room);
  }

  // ---- Treatments ------------------------------------------------------------

  /** Whether a discipline is switched on for this game. */
  enabled(d: Discipline): boolean {
    return enabled(this.ctx, d);
  }

  /** Switch an optional discipline on or off. */
  setDiscipline(d: Discipline, on: boolean) {
    setDiscipline(this.ctx, d, on);
  }

  /** Whether the center can take guests for a discipline: it is on and has a finished room. */
  offered(d: Discipline): boolean {
    return offered(this.ctx, d);
  }

  /** Whether a modality has been unlocked. */
  unlocked(m: Modality): boolean {
    return unlocked(this.ctx, m);
  }

  /** The modality that treats a guest's condition. */
  modalityOf(g: Guest): ModalityDef {
    return modalityOf(g);
  }

  /** Why a table cannot deliver a modality properly right now. */
  deliveryProblem(table: Item, staff: Staff | undefined, def: ModalityDef): DeliveryProblem {
    return deliveryProblem(this.ctx, table, staff, def);
  }

  /**
   * The chance a guest's treatment works, if it were given now at the table they are lined up for, by whoever is
   * working it. Null until they are diagnosed and in line for a table with someone at it.
   */
  chanceFor(g: Guest): Chance | null {
    const it = this.world.item(g.station);
    const staff = it && this.staff(it.staffId);
    if (g.goal !== 'treat' || !it || !staff || ITEMS[it.type].station?.goal !== 'treat') return null;
    return successChance(this.ctx, it, staff, g);
  }
  // ---- Lines -----------------------------------------------------------------
  /** Move a guest up (negative) or down (positive) their line. */
  moveInLine(guestId: number, by: number): boolean {
    return moveInLine(this.ctx, guestId, by);
  }
  /** Send a waiting guest to another station that does the same job. */
  moveToStation(guestId: number, stationId: number): boolean {
    return moveToStation(this.ctx, guestId, stationId);
  }
  /** Of the other stations doing the same job as this one, the one with the shortest line. */
  shortestOtherLine(it: Item): Item | undefined {
    return shortestOtherLine(this.ctx, it);
  }
  /** Send a guest home untreated. */
  sendHome(guestId: number): boolean {
    return sendHome(this.ctx, guestId);
  }
  // ---- Policy ----------------------------------------------------------------
  /** Change how the center is run. */
  setPolicy(change: PolicyChange) {
    setPolicy(this.ctx, change);
  }
  /** Put a room first for staff and caretakers, or back among the rest. */
  setRoomPriority(roomId: number, on: boolean) {
    setRoomPriority(this.ctx, roomId, on);
  }
  // ---- Staff -----------------------------------------------------------------

  /** Hire an applicant. */
  hire(candidateId: number): Staff | null {
    return hire(this.ctx, candidateId);
  }

  /** Let a member of staff go. */
  fire(id: number) {
    fire(this.ctx, id);
  }

  /** What a member of staff could reasonably expect to be paid. */
  fairPay(st: Staff): number {
    return fairPay(st);
  }

  /** The salary a raise would take a member of staff to. */
  raiseTo(st: Staff): number {
    return raiseTo(st);
  }

  /** Promote a member of staff who is ready, with the raise that comes with it. */
  promote(id: number): boolean {
    return promote(this.ctx, id);
  }
  /** Keep a member of staff from a duty, or put them back on it. */
  setDuty(id: number, duty: Duty, on: boolean): boolean {
    return setDuty(this.ctx, id, duty, on);
  }
  /** Turn a job applicant down. */
  reject(candidateId: number): boolean {
    return reject(this.ctx, candidateId);
  }
  /** Give a member of staff a raise. */
  giveRaise(id: number) {
    giveRaise(this.ctx, id);
  }

  /** Courses a member of staff could take right now. */
  courses(st: Staff): Course[] {
    return courses(this.ctx, st);
  }

  /** Why a course cannot start. */
  trainBlocker(st: Staff, course: Course): string {
    return trainBlocker(this.ctx, st, course);
  }

  /** Send a member of staff on a course. */
  train(staffId: number, courseId: string): boolean {
    return train(this.ctx, staffId, courseId);
  }

  // ---- Money -----------------------------------------------------------------

  /** Borrow one step more from the bank. */
  borrow(): boolean {
    return borrow(this.ctx);
  }

  /** Pay one step of the loan back. */
  repay(): boolean {
    return repay(this.ctx);
  }

  /** Set the multiplier on every fee. */
  setPrice(level: number) {
    setPrice(this.ctx, level);
  }
  /** Set a technique's own price, on top of the overall level. */
  setTechniquePrice(m: Modality, level: number) {
    setTechniquePrice(this.ctx, m, level);
  }
  /** What a technique costs against standard, all told. */
  priceFor(m: Modality): number {
    return priceFor(this.s, m);
  }
  // ---- Marketing -------------------------------------------------------------
  /** Why a campaign cannot start, or '' if it can. */
  campaignBlocker(kind: CampaignKind, months: number, condition?: ConditionId): string {
    return campaignBlocker(this.s, kind, months, condition);
  }
  /** What a campaign costs for so many months. */
  campaignCost(kind: CampaignKind, months: number): number {
    return campaignCost(kind, months);
  }
  /** Pay for a campaign and start it. */
  startCampaign(kind: CampaignKind, months: number, condition?: ConditionId): boolean {
    return startCampaign(this.ctx, kind, months, condition);
  }
  // ---- House calls -----------------------------------------------------------
  /** Who could go on the house call on offer. */
  whoCanGo(): Staff[] {
    return this.s.callOffer ? whoCanGo(this.ctx, this.s.callOffer) : [];
  }
  /** What the house call on offer pays if this member of staff goes. */
  callFee(st: Staff): number {
    return this.s.callOffer ? callFee(this.s.callOffer, st) : 0;
  }
  /** Send someone on the house call on offer. */
  acceptCall(staffId: number): boolean {
    return acceptCall(this.ctx, staffId);
  }
  /** Turn the house call on offer down. */
  declineCall() {
    declineCall(this.ctx);
  }

  // ---- Emergencies -----------------------------------------------------------

  /** Put an emergency on the table. */
  offerEmergency(): boolean {
    return offerEmergency(this.ctx);
  }

  /** Take on the emergency on offer. */
  acceptEmergency() {
    acceptEmergency(this.ctx);
  }

  /** Turn the emergency on offer down. */
  declineEmergency() {
    declineEmergency(this.ctx);
  }

  // ---- Stress outbreaks -------------------------------------------------------

  /** Put a stress outbreak on the table. */
  offerOutbreak(): boolean {
    return offerOutbreak(this.ctx);
  }

  /** Take on the stress outbreak on offer. */
  acceptOutbreak() {
    acceptOutbreak(this.ctx);
  }

  /** Turn the stress outbreak on offer down. */
  declineOutbreak() {
    declineOutbreak(this.ctx);
  }

  /** Give a guest one of the outbreak's calming sessions. */
  calm(guestId: number): CalmResult {
    return calm(this.ctx, guestId);
  }

  // ---- Building --------------------------------------------------------------

  /** Buy an item and put it down. */
  placeItem(type: ItemType, x: number, y: number, rot: number, opts: PlaceOptions = {}): Item | null {
    return placeItem(this.ctx, type, x, y, rot, opts);
  }

  /** Whether an item could be picked up and put down somewhere else. */
  canMoveItem(it: Item, x: number, y: number, rot: number): Check {
    return canMoveItem(this.ctx, it, x, y, rot);
  }

  /** Move an item for free. */
  moveItem(id: number, x: number, y: number, rot: number): boolean {
    return moveItem(this.ctx, id, x, y, rot);
  }

  /** Whether an item can be sold without leaving its room short of something it requires. */
  canSell(it: Item): boolean {
    return canSell(this.ctx, it);
  }

  /** Sell an item for half its price. */
  sellItem(id: number) {
    sellItem(this.ctx, id);
  }

  /** Lay out the blueprint of a room. */
  createRoom(type: RoomType, r: Rect, door: WallSpot): Room {
    return createRoom(this.ctx, type, r, door);
  }

  /** Build a blueprint and pay for it. */
  finishRoom(room: Room) {
    finishRoom(this.ctx, room);
  }

  /** Remove a room, refunding a fraction of what it cost. */
  removeRoom(roomId: number, refund: number) {
    removeRoom(this.ctx, roomId, refund);
  }

  /** What removing a room would give back, at this fraction of what was paid. */
  roomRefund(room: Room, refund: number): number {
    return roomRefund(this.ctx, room, refund);
  }

  /** Required furniture a room still lacks. */
  missingItems(room: Room): ItemType[] {
    return missingItems(this.ctx, room);
  }

  /** Add a window to a stretch of wall, or take out the one already there. */
  toggleWindow(roomId: number, spot: WallSpot): 'added' | 'removed' | '' {
    return toggleWindow(this.ctx, roomId, spot);
  }

  /** Move a room's door to another stretch of its wall. */
  moveDoor(roomId: number, door: WallSpot): boolean {
    return moveDoor(this.ctx, roomId, door);
  }

  /** Give a room a new shape, moving its door and windows with their walls. */
  resizeRoom(roomId: number, rect: Rect): boolean {
    return resizeRoom(this.ctx, roomId, rect);
  }
}
