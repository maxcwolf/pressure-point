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
  type GoalSpec,
  ITEMS,
  type ItemType,
  type Modality,
  type ModalityDef,
  type Offering,
  type Priced,
  type RoomType,
  type RugPatternId,
  type ThermostatSetting,
} from '../data';
import { tuning } from '../difficulty';
import type { PlotOffer } from '../land';
import { type Layout, layoutOf, type PlacedLayout } from '../room-layout';
import { offeringOn } from '../state/game';
import type {
  Char,
  GameState,
  Guest,
  Item,
  MonthRecord,
  Room,
  RoomDecor,
  Staff,
  Visitor,
  WallSpot,
} from '../state/types';
import { layoutProblem } from '../templates';
import type { Check, Placed, Rect, World } from '../world';
import { checkAchievements } from './achievements';
import { type Advice, advice, advise, announce } from './advisor';
import { drainFactor, prestige } from './ambience';
import { assignRoom, clearRooms } from './assignments';
import { holdAwards, YEAR_MONTHS } from './awards';
import { bottleneck, type Stage } from './bottleneck';
import type { PlaceOptions } from './building';
import {
  buildLayout,
  canMoveItem,
  canSell,
  copyRoom,
  createRoom,
  finishRoom,
  itemsInRoom,
  missingItems,
  moveDoor,
  moveItem,
  moveRoom,
  placeItem,
  removeRoom,
  resizeRoom,
  roomRefund,
  sellItem,
  setRugPattern,
  setThermostat,
  toggleWindow,
} from './building';
import { acceptCall, callFee, declineCall, updateCalls, whoCanGo } from './calls';
import { fullyTrained, promote, reject, setDuty, updateApplicants, updateHabits } from './careers';
import { announceSweatLodge } from './ceremonies';
import { challengeObjective, updateChallenge } from './challenges';
import { charById, guestById, staffById } from './chars';
import { type CheatResult, runCheat } from './cheats';
import {
  admitClassgoers,
  announceClasses,
  bestInstructor,
  bookClasses,
  classPlaces,
  classPlaying,
  giveUp,
  noteMissedClasses,
  setClasses,
  toggleClassDay,
} from './classes';
import { createContext, type SimContext } from './context';
import { decorateRoom } from './decor';
import { demand, type DisciplineDemand, fadeFollowing, offeringArrivals, roomPull, staffedDisciplines } from './demand';
import {
  borrow,
  monthEnd,
  priceFor,
  refusePayrollLoan,
  repay,
  setPrice,
  setTechniquePrice,
  takePayrollLoan,
  updatePayroll,
  warnPayday,
} from './economy';
import { acceptEmergency, declineEmergency, offerEmergency, updateEmergency } from './emergencies';
import type { SimEvent, Subject } from './events';
import { drainEvents, emit } from './events';
import { objectiveDetail } from './goals';
import { admitGuests, updateGuest } from './guests';
import { buyPlot, landOffers, renamePlot, updateLand } from './land';
import { campaignBlocker, campaignCost, startCampaign, updateCampaigns } from './marketing';
import { askWard, canWard, prepareMishap, updateMishaps } from './mishaps';
import { hasSupplier, setMushrooms } from './mushrooms';
import { itemNoise, noiseAt } from './noise';
import { acceptOutbreak, calm, type CalmResult, declineOutbreak, offerOutbreak, updateOutbreak } from './outbreaks';
import { updateOutdoors } from './outdoors';
import { type PolicyChange, setPolicy, setRoomPriority } from './policy';
import { type PlacePreview, previewItem } from './preview';
import type { Objective } from './progress';
import { checkOpening, checkStars, hasRoom, objectives } from './progress';
import { moveInLine, moveToStation, sendHome, shortestOtherLine } from './queues';
import { monthSoFar } from './records';
import { updateRival } from './rival';
import { playingFor, servedAt, sessionState, stationStaff } from './sessions';
import { askSoul, canRetrieve } from './souls';
import { aboutToQuit, daysUntilQuit, fairPay, fire, giveRaise, hire, raiseTo, updateStaff } from './staffing';
import { type StandingPoints, standingPoints, updateStanding } from './standing';
import { type Chance, successChance, updateStations } from './stations';
import { subjectSpot } from './subjects';
import { checkSurroundings, restoreSurroundings } from './surroundings';
import type { Course } from './training';
import { cancelBlocker, cancelTraining, courses, train, trainBlocker } from './training';
import type { DeliveryProblem } from './treatments';
import { deliveryProblem, modalityOf, offered, setDiscipline, unlocked } from './treatments';
import { cutOff, inRush, type Season, seasonOf, updateTwists } from './twists';
import { orderUpgrade } from './upgrades';
import { decayItems } from './upkeep';
import { fadeVibes } from './vibes';
import { lapseInspection, settleInspection, updateVisitor, updateVisits } from './visits';
import { outdoorTemp, thermostatShare, todayIndoors, warmthAt } from './warmth';
import { warnWorsening } from './worsening';

export class Sim {
  readonly world: World;
  private readonly ctx: SimContext;

  constructor(readonly s: GameState) {
    this.ctx = createContext(s);
    this.world = this.ctx.world;
    // the surroundings count from the start, not only once a second of play has passed
    restoreSurroundings(this.ctx);
  }

  // ---- The clock -------------------------------------------------------------

  /** Whether the game stands still: a payday waits on the player's answer about a loan, or the center is bankrupt. */
  private stopped(): boolean {
    return (!!this.s.payrollDue && this.s.payrollDue.until === null) || this.s.bankrupt;
  }

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
    // the game stands still while a payday waits on a loan, and for good once the center is bankrupt
    if (this.stopped()) return;
    const prevMonth = Math.floor(s.day / DAYS_PER_MONTH);
    const prevDay = Math.floor(s.day);
    s.day += dt / DAY_SECONDS;
    if (Math.floor(s.day) !== prevDay) {
      fadeFollowing(ctx);
      noteMissedClasses(ctx);
      giveUp(ctx);
      bookClasses(ctx);
      announceClasses(ctx);
      lapseInspection(ctx);
      warnPayday(ctx);
    }
    const month = Math.floor(s.day / DAYS_PER_MONTH);
    if (month !== prevMonth) {
      monthEnd(ctx);
      // a payday waiting on a loan holds the year's awards up with it
      if (!s.payrollDue && !this.stopped() && month % YEAR_MONTHS === 0) holdAwards(ctx, month / YEAR_MONTHS);
    }

    checkOpening(ctx);
    admitGuests(ctx, dt);
    admitClassgoers(ctx);
    updateStations(ctx, dt);
    for (const g of [...s.guests]) updateGuest(ctx, g, dt);
    for (const st of [...s.staff]) updateStaff(ctx, st, dt);
    for (const v of [...s.visitors]) updateVisitor(ctx, v, dt);
    decayItems(ctx, dt);
    fadeVibes(ctx, dt);
    announceSweatLodge(ctx);

    s.slowT -= dt;
    if (s.slowT <= 0) {
      s.slowT = 1;
      checkSurroundings(ctx);
      updateEmergency(ctx);
      updateOutbreak(ctx);
      checkStars(ctx);
      checkAchievements(ctx);
      updateChallenge(ctx);
      updateApplicants(ctx);
      updateCampaigns(ctx);
      updateCalls(ctx);
      updateHabits(ctx);
      updateVisits(ctx);
      updateStanding(ctx);
      updateRival(ctx);
      updateMishaps(ctx);
      updateLand(ctx);
      updateOutdoors(ctx);
      warnWorsening(ctx);
      // wages overdue for want of a loan may be paid at last, which lets the year's awards through
      if (updatePayroll(ctx)) this.holdYearAwards();
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

  /** A visitor by id, while they are here. */
  visitor(id: number): Visitor | undefined {
    return this.s.visitors.find((v) => v.id === id);
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
  /** The numbers behind one objective, a line each. */
  objectiveDetail(goal: GoalSpec): string[] {
    return objectiveDetail(this.ctx, goal);
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
  /** The stage of a visit holding guests up most, if any is. */
  bottleneck(): Stage | undefined {
    return bottleneck(this.ctx);
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

  /** Whether the center is snowed in right now, so nobody new can get here: only in a center that gets snow. */
  snowedIn(): boolean {
    return cutOff(this.ctx);
  }

  /** The season now: every center has its weather through the year, if not always its crowds. */
  season(): Season {
    return seasonOf(this.s.day);
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
    checkSurroundings(this.ctx);
  }
  /**
   * How fast patience drains on a tile: slower in pleasant surroundings, faster in grim ones. `extra` is pleasantness
   * from an item not yet placed.
   */
  drainFactor(x: number, y: number, extra = 0): number {
    return drainFactor(this.ctx, x, y, extra);
  }
  /** How noisy a tile is: 0 is silent, and from NOISE_LOUD it is loud. `extra` is noise from an item not yet placed. */
  noiseAt(x: number, y: number, extra = 0): number {
    return noiseAt(this.ctx, x, y, extra);
  }
  /** How warm a tile is, in degrees Fahrenheit. `extra` is warmth from an item not yet placed. */
  warmthAt(x: number, y: number, extra = 0): number {
    return warmthAt(this.ctx, x, y) + extra;
  }
  /** What an item would change if it were put down here, with the surroundings worked out afresh first. */
  previewItem(placed: Placed): PlacePreview {
    this.refreshAmbience();
    return previewItem(this.ctx, placed);
  }
  /** How noisy it is at an item, such as a treatment table. */
  itemNoise(it: Item): number {
    return itemNoise(this.ctx, it);
  }
  /** How hard an item works for today's weather, from 0 (off) to 1 (flat out): less than flat out only with a thermostat. */
  thermostatShare(it: Item): number {
    return thermostatShare(it.type, it.thermostat, todayIndoors(this.ctx));
  }
  /** The temperature outside today. */
  outdoorTemp(): number {
    return outdoorTemp(centerOf(this.s).climate, this.s.day);
  }

  /** A room's prestige, from one to five. `extra` is decor not yet placed in it. */
  prestige(room: Room, extra = 0): number {
    return prestige(this.ctx, room, extra);
  }

  /** How strongly a treatment room draws guests to its discipline, as a multiplier on how often they come for it. */
  roomPull(room: Room): number {
    return roomPull(this.ctx, room);
  }

  /** Every discipline on offer, what draws guests to it, and its share of new guests. */
  demand(): DisciplineDemand[] {
    return demand(this.ctx);
  }

  /** The disciplines offered with a room and a practitioner, and how much more often guests arrive for them. */
  offering(): { staffed: number; arrivals: number } {
    return { staffed: staffedDisciplines(this.ctx).length, arrivals: offeringArrivals(this.ctx) };
  }

  // ---- Treatments ------------------------------------------------------------

  /** Whether a discipline, or the Qi Gong classes, is switched on for this game. */
  enabled(d: Offering): boolean {
    return offeringOn(this.s, d);
  }

  /** Switch an optional discipline, or the Qi Gong classes, on or off. */
  setDiscipline(d: Offering, on: boolean) {
    if (d === 'qigong') {
      setClasses(this.ctx, on);
      return;
    }
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
    const staff = it && stationStaff(this.ctx, it);
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
    return fairPay(st, tuning(this.s, 'salaries'));
  }

  /** The salary a raise would take a member of staff to. */
  raiseTo(st: Staff): number {
    return raiseTo(st, tuning(this.s, 'salaries'));
  }

  /** Promote a member of staff who is ready, with the raise that comes with it. */
  promote(id: number): boolean {
    return promote(this.ctx, id);
  }
  /** Add a room to the rooms a member of staff works in, or take it away. False if there is no work for them there. */
  assignRoom(staffId: number, roomId: number): boolean {
    return assignRoom(this.ctx, staffId, roomId);
  }
  /** Let a member of staff work anywhere again. */
  clearRooms(staffId: number): boolean {
    return clearRooms(this.ctx, staffId);
  }
  /** Keep a member of staff from a duty, or put them back on it. */
  setDuty(id: number, duty: Duty, on: boolean): boolean {
    return setDuty(this.ctx, id, duty, on);
  }
  /** Turn a job applicant down. */
  reject(candidateId: number): boolean {
    return reject(this.ctx, candidateId);
  }
  /** Whether a Shaman can be sent to retrieve a member of staff's soul. */
  canRetrieve(st: Staff): boolean {
    return canRetrieve(this.ctx, st);
  }
  /** Send a Shaman to retrieve a burnt-out member of staff's soul. False if none can be. */
  askSoul(id: number): boolean {
    return askSoul(this.ctx, id);
  }
  /** Give a member of staff a raise. */
  giveRaise(id: number) {
    giveRaise(this.ctx, id);
  }

  /** Prepare for the mishap coming, at its price. */
  prepareMishap(): boolean {
    return prepareMishap(this.ctx);
  }
  /** Ask a Shaman to ward off the mishap coming. */
  askWard(): boolean {
    return askWard(this.ctx);
  }
  /** Whether a Shaman can be asked to ward off the mishap coming. */
  canWard(): boolean {
    return canWard(this.s);
  }
  /** Put the magic mushrooms on sale under the Shop Counter, or away. */
  setMushrooms(on: boolean): boolean {
    return setMushrooms(this.ctx, on);
  }
  /** Whether there is a Shaman to supply magic mushrooms for the Shop Counter. */
  mushroomSupplier(): boolean {
    return hasSupplier(this.ctx);
  }
  /** Each of the center's plots of land as things stand: the game's, being built on, for sale, or not yet. */
  landOffers(): PlotOffer[] {
    return landOffers(this.ctx);
  }
  /** Buy a plot of land and set the builders to work on it. False if it cannot be bought. */
  buyPlot(id: string): boolean {
    return buyPlot(this.ctx, id);
  }
  /** Name a plot of the game's, or give it back its own name if the new one is blank. */
  renamePlot(id: string, name: string): boolean {
    return renamePlot(this.ctx, id, name);
  }

  /** Settle a failed inspection: pay the fine, or pay to make it go away. */
  settleInspection(payOff: boolean): boolean {
    return settleInspection(this.ctx, payOff);
  }

  /** The center's standing points as it is now, part by part. */
  standing(): StandingPoints {
    return standingPoints(this.ctx);
  }

  /** Whether a member of staff is as qualified as they can be for now, as a promotion needs. */
  fullyTrained(st: Staff): boolean {
    return fullyTrained(this.ctx, st);
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

  /** Why a member of staff's course cannot be called off. */
  cancelBlocker(st: Staff): string {
    return cancelBlocker(st);
  }

  /** Call a member of staff off their course, with the fee refunded. */
  cancelTraining(staffId: number): boolean {
    return cancelTraining(this.ctx, staffId);
  }

  // ---- Money -----------------------------------------------------------------

  /** Borrow one step more from the bank. */
  borrow(): boolean {
    return borrow(this.ctx);
  }

  /** Take the loan that covers a payday the bank could not, and carry on. */
  takePayrollLoan(): boolean {
    if (!takePayrollLoan(this.ctx)) return false;
    this.holdYearAwards();
    return true;
  }

  /** Hold the year-end awards if the month just closed was the year's last. */
  private holdYearAwards() {
    const month = Math.floor(this.s.day / DAYS_PER_MONTH);
    if (month % YEAR_MONTHS === 0) holdAwards(this.ctx, month / YEAR_MONTHS);
  }

  /** Refuse the loan a payday needs, which loses the game. */
  refusePayrollLoan(): boolean {
    return refusePayrollLoan(this.ctx);
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
  setTechniquePrice(m: Priced, level: number) {
    setTechniquePrice(this.ctx, m, level);
  }
  /** What a technique costs against standard, all told. */
  priceFor(m: Priced): number {
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
    return this.s.callOffer ? callFee(this.s, this.s.callOffer, st) : 0;
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

  /** Change a rug's pattern. */
  setRugPattern(id: number, pattern: RugPatternId) {
    setRugPattern(this.ctx, id, pattern);
  }

  /** Set a heater or air conditioner's thermostat, or every one of its kind with `every`. */
  setThermostat(id: number, setting: ThermostatSetting, every = false) {
    setThermostat(this.ctx, id, setting, every);
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

  /** Whoever works a station: posted at it, or for a mat, at the bowls in its room. */
  stationStaff(it: Item): Staff | undefined {
    return stationStaff(this.ctx, it);
  }

  /** The guest being seen at a station: its own, or at the bowls, the first lying on the mats it plays for. */
  servedAt(it: Item): Guest | undefined {
    return servedAt(this.ctx, it);
  }

  /** How the session at a lead station stands: mats taken, and whether it is playing. */
  session(lead: Item): { lying: number; mats: number; playing: boolean } {
    return sessionState(this.ctx, lead);
  }

  /** Whether the group session in a mat's room is playing. */
  sessionPlaying(it: Item): boolean {
    return playingFor(this.ctx, it);
  }

  /** The layout of a room and its furniture, to move or copy it. */
  roomLayout(room: Room): Layout {
    return layoutOf(room, itemsInRoom(this.ctx, room));
  }

  /** Pick a built room up, furniture and all, and put it down elsewhere. */
  moveRoom(roomId: number, placed: PlacedLayout): boolean {
    return moveRoom(this.ctx, roomId, placed);
  }

  /** Build a copy of a room at a spot, at what building it from scratch would cost. */
  copyRoom(roomId: number, placed: PlacedLayout): Room | null {
    return copyRoom(this.ctx, roomId, placed);
  }

  /** Pay for the next upgrade to a piece of treatment equipment, for a Mechanic to install. */
  orderUpgrade(id: number): boolean {
    return orderUpgrade(this.ctx, id);
  }

  /** Whether a Qi Gong class is going on at a Practice Spot's studio now. */
  classPlaying(spot: Item): boolean {
    return classPlaying(this.ctx, spot);
  }

  /** The Instructor whose rank sets how many places each Qi Gong class has: the most skilled on the payroll, if any. */
  classLeader(): { staff: Staff; places: number } | undefined {
    const staff = bestInstructor(this.ctx);
    return staff && { staff, places: classPlaces(staff.skill) };
  }

  /** Switch a day of the week on or off in a Qi Gong Studio's timetable. */
  toggleClassDay(roomId: number, day: number): boolean {
    return toggleClassDay(this.ctx, roomId, day);
  }

  /** Change a room's floor or walls, or those of every room of its kind. */
  decorateRoom(roomId: number, change: RoomDecor, everyRoom = false): boolean {
    return decorateRoom(this.ctx, roomId, change, everyRoom);
  }

  /** Build a room from a template at a spot, at what building it from scratch would cost. */
  buildTemplate(name: string, layout: Layout, placed: PlacedLayout): Room | null {
    // a template kept from before the game changed may no longer make a room
    if (layoutProblem(layout)) return null;
    return buildLayout(this.ctx, layout, placed, { cost: `"${name}"`, built: `"${name}" built` });
  }

  // ---- Cheats ----------------------------------------------------------------

  /** Run a line typed into the cheat console. */
  cheat(line: string): CheatResult {
    return runCheat(this.ctx, line, (days) => {
      this.fastForward(days);
    });
  }

  /**
   * Play on for some days at once, as fast as the computer allows. Of what happened, only the messages and the dialogs
   * are kept for the interface: a few weeks of sounds, banners and floating text all at once would only be noise.
   */
  fastForward(days: number) {
    const { ctx } = this;
    const before = ctx.events.length;
    const end = this.s.day + days;
    while (end - this.s.day > 1e-9 && !this.s.payrollDue && !this.s.bankrupt)
      this.step(Math.min(0.05, (end - this.s.day) * DAY_SECONDS));
    const kept = ctx.events
      .slice(before)
      .filter((e) => e.type !== 'sfx' && e.type !== 'announce' && e.type !== 'float');
    ctx.events = [...ctx.events.slice(0, before), ...kept];
  }
}
