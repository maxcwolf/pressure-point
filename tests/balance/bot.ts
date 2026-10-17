// A playtest bot: plays a center the way a competent, unhurried player would, so the pace of the campaign can be
// measured rather than guessed. It builds the opening rooms, staffs them, adds comforts and decor, grows when lines
// get long, trains staff in what each star unlocks, gives raises when asked, and takes on emergencies.

import {
  type CenterId,
  CENTERS,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  type Difficulty,
  type Discipline,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  ITEMS,
  type ItemType,
  MODALITIES,
  type Role,
  ROOMS,
  type RoomType,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { Sim } from '../../src/core/sim/sim';
import { disciplineOn, newGame, unlockedUpTo } from '../../src/core/state/game';
import type { GameState, Item, Room, WallSpot } from '../../src/core/state/types';
import type { Rect } from '../../src/core/world';

/** One month of a playtest, as the bot saw it at its end. */
export interface MonthLog {
  month: number;
  money: number;
  loan: number;
  rep: number;
  stars: number;
  grade: number;
  staff: number;
  rooms: number;
  arrived: number;
  healed: number;
  failed: number;
  stormed: number;
  worse: number;
  priced: number;
  income: number;
  spending: number;
  wages: number;
  avgWaitDays: number | null;
  inside: number;
  /** Each discipline's following at the month's end, where the game has them, and guests healed in each so far. */
  following: Partial<Record<Discipline, number>>;
  healedBy: Partial<Record<Discipline, number>>;
}

export interface Playtest {
  center: CenterId;
  seed: number;
  openedDay: number | null;
  starDays: (number | null)[];
  months: MonthLog[];
  /** The objectives still open at the end, as the player sees them. */
  openGoals: string[];
  notes: string[];
  lowestMoney: number;
  peakLoan: number;
  /** For each star, the day each of its objectives was first met (null if never), by the objective's label. */
  goalDays: Record<string, number | null>[];
}

const TREAT_ROOM: Record<Discipline, RoomType> = {
  massage: 'massage',
  acupuncture: 'acupuncture',
  reiki: 'reiki',
  sound: 'sound',
  shaman: 'lodge',
};

/** The size the bot builds each room at: roomy enough for a bit of decor. */
const SIZE: Partial<Record<RoomType, [number, number]>> = {
  consult: [3, 4],
  massage: [4, 4],
  acupuncture: [4, 4],
  reiki: [4, 4],
  sound: [4, 4],
  lodge: [4, 5],
  staffroom: [3, 4],
  restroom: [3, 3],
  training: [3, 4],
  assess: [3, 3],
  recovery: [3, 4],
};

export class Bot {
  readonly sim: Sim;
  readonly s: GameState;
  readonly log: Playtest;
  private monthStart = { arrived: 0, healed: 0, failed: 0, stormed: 0, worse: 0, priced: 0 };

  constructor(
    readonly center: CenterId,
    readonly seed = 1,
    difficulty: Difficulty = {},
  ) {
    setSeed(seed);
    const s = newGame(center);
    s.difficulty = difficulty;
    this.sim = new Sim(s);
    this.s = this.sim.s;
    this.log = {
      center,
      seed,
      openedDay: null,
      starDays: CENTERS[center].goals.map(() => null),
      months: [],
      openGoals: [],
      notes: [],
      lowestMoney: s.money,
      peakLoan: 0,
      goalDays: CENTERS[center].goals.map(() => ({})),
    };
  }

  /** The last month written up, and the stars seen so far, carried between calls to `play`. */
  private lastMonth = 0;
  private lastStars = 0;

  /** Play this many in-game days, deciding once a day. */
  play(days: number) {
    this.playUntil(() => false, days);
  }

  /** Play a day at a time until a condition holds, or for at most so many days. True if the condition came. */
  playUntil(done: (bot: Bot) => boolean, maxDays: number): boolean {
    const ticksPerDay = Math.round(DAY_SECONDS * 10);
    this.s.speed = 1;
    let met = false;
    for (let d = 0; d < maxDays; d++) {
      if (done(this)) {
        met = true;
        break;
      }
      this.decide();
      for (let i = 0; i < ticksPerDay; i++) {
        this.sim.tick(0.1);
        this.sim.drain();
      }
      this.log.lowestMoney = Math.min(this.log.lowestMoney, this.s.money);
      this.log.peakLoan = Math.max(this.log.peakLoan, this.s.loan);
      const days = this.log.goalDays[this.s.stars];
      if (days)
        for (const o of this.sim.objectives()) {
          const key = o.label.replace(/ \(\d+\/\d+\)$/, '');
          if (!(key in days)) days[key] = null;
          if (o.done && days[key] === null) days[key] = Math.floor(this.s.day);
        }
      if (this.s.open && this.log.openedDay === null) this.log.openedDay = Math.floor(this.s.day);
      while (this.s.stars > this.lastStars) {
        this.log.starDays[this.lastStars] = Math.floor(this.s.day);
        this.lastStars++;
      }
      const month = Math.floor(this.s.day / DAYS_PER_MONTH);
      if (month > this.lastMonth) {
        this.lastMonth = month;
        this.closeMonth(month);
      }
    }
    met ||= done(this);
    this.log.openGoals = this.sim
      .objectives()
      .filter((o) => !o.done)
      .map((o) => o.label);
    return met;
  }

  /** Write up the month just ended. */
  private closeMonth(month: number) {
    const s = this.s;
    const st = s.stats;
    const l = s.lastLedger;
    const income = l.consult + l.treatment + l.classes + l.vending + l.shop + l.mushrooms + l.calls + l.bonus;
    const spending = l.salaries + l.building + l.training + l.interest + l.marketing + l.fines;
    const rec = s.months.at(-1);
    const wait = rec?.waitCount ? rec.waitTotal / rec.waitCount / DAY_SECONDS : null;
    this.log.months.push({
      month,
      money: Math.round(s.money),
      loan: s.loan,
      rep: Math.round(s.reputation * 10) / 10,
      stars: s.stars,
      grade: s.grade,
      staff: s.staff.filter((x) => x.state !== 'leaving').length,
      rooms: s.rooms.filter((r) => r.done).length,
      arrived: st.arrived - this.monthStart.arrived,
      healed: st.healed - this.monthStart.healed,
      failed: st.failed - this.monthStart.failed,
      stormed: st.stormed - this.monthStart.stormed,
      worse: st.worse - this.monthStart.worse,
      priced: st.priced - this.monthStart.priced,
      income: Math.round(income),
      spending: Math.round(spending),
      wages: Math.round(l.salaries),
      avgWaitDays: wait === null ? null : Math.round(wait * 10) / 10,
      inside: s.guests.length,
      following: Object.fromEntries(
        Object.entries((s as { following?: Partial<Record<Discipline, number>> }).following ?? {}).map(([d, f]) => [
          d,
          Math.round(f),
        ]),
      ),
      healedBy: { ...st.healedBy },
    });
    this.monthStart = {
      arrived: st.arrived,
      healed: st.healed,
      failed: st.failed,
      stormed: st.stormed,
      worse: st.worse,
      priced: st.priced,
    };
  }

  // ---- what the bot does each day -------------------------------------------

  /** Everything the bot looks at once a day. */
  private decide() {
    const s = this.s;
    this.keepStaffHappy();
    this.handleEvents();
    this.manageLoan();
    if (!s.open) {
      this.buildOpening();
      return;
    }
    this.hireToFill();
    this.basics();
    this.unlocks();
    this.train();
    this.grow();
    this.decorate();
    this.comforts();
  }

  /** Promotions, and raises for anyone asking, tempted away or about to quit. */
  private keepStaffHappy() {
    for (const st of this.s.staff) {
      if (st.state === 'leaving') continue;
      if (st.promotion) this.sim.promote(st.id);
      if (st.raiseAsked || st.offer > 0 || this.sim.aboutToQuit(st)) this.sim.giveRaise(st.id);
    }
  }

  /** Take on emergencies, turn down outbreaks and house calls, prepare for mishaps and pay any fine. */
  private handleEvents() {
    const s = this.s;
    if (s.offer) this.sim.acceptEmergency();
    if (s.outbreakOffer) this.sim.declineOutbreak();
    if (s.callOffer) this.sim.declineCall();
    if (s.mishap && !s.mishap.started && !s.mishap.prepared) this.sim.prepareMishap();
    if (s.visitReport?.bribe !== undefined) this.sim.settleInspection(false);
  }

  /** Borrow when nearly broke, and pay the loan back when flush. */
  private manageLoan() {
    const s = this.s;
    if (s.money < 1500) {
      if (this.sim.borrow()) this.note(`day ${Math.floor(s.day)}: borrowed, loan now ${s.loan}`);
    } else if (s.loan > 0 && s.money > 25000 + this.wages()) this.sim.repay();
  }

  /** The building's bounds, and its front door and the row inside it, in the shape the bot plans with. */
  private plot() {
    const b = this.sim.world.building;
    return {
      x0: b.bounds.x0,
      x1: b.bounds.x1,
      y0: b.bounds.y0,
      y1: b.front,
      door: b.door,
    };
  }

  /** Whether the bot can pay for something now, borrowing for it if the center is paying its way. */
  private afford(cost: number, reserve: number, borrow = false): boolean {
    const s = this.s;
    if (s.money >= cost + reserve) return true;
    if (!borrow) return false;
    const last = s.months.at(-1);
    const operating = last
      ? last.ledger.consult + last.ledger.treatment + last.ledger.vending + last.ledger.shop - last.ledger.salaries
      : 0;
    if (s.months.length && operating < 0 && s.loan >= 25000) return false;
    while (s.money < cost + 1000) if (!this.sim.borrow()) return false;
    this.note(`day ${Math.floor(s.day)}: borrowed to build, loan now ${s.loan}`);
    return true;
  }

  /** Last month's operating profit: fees and sales, less salaries. Positive before the first month is out. */
  private profit(): number {
    const last = this.s.months.at(-1);
    if (!last) return 1;
    const l = last.ledger;
    return l.consult + l.treatment + l.classes + l.vending + l.shop + l.calls - l.salaries - l.interest;
  }

  /** The monthly payroll. */
  private wages() {
    return this.s.staff.filter((x) => x.state !== 'leaving').reduce((a, x) => a + x.salary, 0);
  }

  /** Keep a line about something the bot did, up to a limit. */
  private note(text: string) {
    if (this.log.notes.length < 60) this.log.notes.push(text);
  }

  // ---- building -------------------------------------------------------------

  /** The bare minimum to open, and a couple of seats. */
  private buildOpening() {
    if (!this.has('reception_desk')) this.placeNearEntrance('reception_desk');
    if (!this.sim.hasRoom('consult')) this.buildRoom('consult');
    if (!this.sim.hasRoom('massage')) this.buildRoom('massage');
    this.hireToFill();
    // a few seats in the lobby from the start
    for (let i = this.count('bench'); i < 2; i++) this.placeNearEntrance('bench');
  }

  /** Whether any item of a type is placed. */
  private has(t: ItemType) {
    return this.s.items.some((i) => i.type === t);
  }
  /** How many items of a type are placed. */
  private count(t: ItemType) {
    return this.s.items.filter((i) => i.type === t).length;
  }
  /** The finished rooms of a type. */
  private rooms(t: RoomType): Room[] {
    return this.s.rooms.filter((r) => r.type === t && r.done);
  }

  /** Build a room of a type with its furniture and any extras, somewhere along the walls. */
  buildRoom(type: RoomType, extras: ItemType[] = []): Room | null {
    const def = ROOMS[type];
    const extraCost = extras.reduce((a, t) => a + ITEMS[t].cost, 0);
    if (this.s.money < def.cost + extraCost + 500) return null;
    const p = this.plot();
    const [w0, h0] = SIZE[type] ?? [def.minShort, def.minLong];
    const cands: { r: Rect; score: number }[] = [];
    const sizes: [number, number][] = [
      [w0, h0],
      [h0, w0],
      [def.minShort, def.minLong],
      [def.minLong, def.minShort],
    ];
    const doorX = (p.door[0] + p.door[1]) / 2;
    for (const [i, [w, h]] of sizes.entries()) {
      for (let y = p.y0; y + h - 1 <= p.y1; y++) {
        for (let x = p.x0; x + w - 1 <= p.x1; x++) {
          const r = { x, y, w, h };
          // keep the lobby by the entrance clear
          if (y + h - 1 >= p.y1 - 3 && x <= doorX + 3 && x + w - 1 >= doorX - 3) continue;
          if (!this.sim.world.roomRectValid(type, r).ok) continue;
          const edge = Math.min(x - p.x0, p.x1 - (x + w - 1), y - p.y0, p.y1 - (y + h - 1));
          cands.push({
            r,
            score: (i >= 2 ? 1000 : 0) + edge * 10 + Math.abs(y - p.y0) * 0.1 + Math.abs(x - p.x0) * 0.01,
          });
        }
      }
    }
    cands.sort((a, b) => a.score - b.score);
    for (const { r } of cands.slice(0, 80)) {
      const cx = (p.x0 + p.x1) / 2;
      const cy = (p.y0 + p.y1) / 2;
      const doors = perimeterDoors(r).sort(
        (a, b) => Math.hypot(a.x + a.dx - cx, a.y + a.dy - cy) - Math.hypot(b.x + b.dx - cx, b.y + b.dy - cy),
      );
      const door = doors.find((d) => this.sim.world.doorValid(type, r, d).ok);
      if (!door) continue;
      const room = this.sim.createRoom(type, r, door);
      if (this.furnish(room, [...def.required, ...extras])) {
        this.sim.finishRoom(room);
        this.placeNear('fire_extinguisher', room.door.x + room.door.dx, room.door.y + room.door.dy, 'corridor');
        return room;
      }
      this.sim.removeRoom(room.id, 1);
    }
    // out of room: buy the cheapest plot of land for sale, to build on once the builders are done
    const building = this.sim.landOffers().some((o) => o.state === 'building');
    const offer = this.sim
      .landOffers()
      .filter((o) => o.state === 'open')
      .sort((a, b) => a.price - b.price)[0];
    if (
      !building &&
      offer &&
      this.profit() > 0 &&
      this.afford(offer.price + def.cost + extraCost, 0, true) &&
      this.sim.buyPlot(offer.def.id)
    )
      this.note(`day ${Math.floor(this.s.day)}: bought ${offer.name} for ${offer.price}`);
    this.note(`day ${Math.floor(this.s.day)}: could not fit a ${type}`);
    return null;
  }

  /** Put furniture into a room, the biggest first. False if any of it will not fit. */
  furnish(room: Room, types: ItemType[]): boolean {
    const order = [...types].sort((a, b) => ITEMS[b].w * ITEMS[b].h - ITEMS[a].w * ITEMS[a].h);
    for (const t of order) if (!this.placeIn(room, t)) return false;
    return true;
  }

  /** Place an item somewhere in a room, against the walls first. */
  placeIn(room: Room, t: ItemType): Item | null {
    if (this.s.money < ITEMS[t].cost) return null;
    const spots: [number, number, number, number][] = [];
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        const edge = Math.min(x - room.x, room.x + room.w - 1 - x, y - room.y, room.y + room.h - 1 - y);
        for (let rot = 0; rot < 4; rot++) spots.push([x, y, rot, edge]);
      }
    spots.sort((a, b) => a[3] - b[3]);
    for (const [x, y, rot] of spots) {
      if (!this.sim.world.canPlaceItem(t, x, y, rot, room.id).ok) continue;
      const it = this.sim.placeItem(t, x, y, rot, { roomId: room.id });
      if (it) return it;
    }
    return null;
  }

  /** Place an item in the corridor as near a spot as will take it. */
  placeNear(t: ItemType, cx: number, cy: number, where: 'corridor' | 'any' = 'corridor'): Item | null {
    if (this.s.money < ITEMS[t].cost) return null;
    const p = this.plot();
    const spots: [number, number, number][] = [];
    for (let y = p.y0; y <= p.y1; y++)
      for (let x = p.x0; x <= p.x1; x++) {
        if (where === 'corridor' && this.sim.world.zoneAt(x, y) !== 0) continue;
        spots.push([x, y, Math.hypot(x - cx, y - cy)]);
      }
    spots.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of spots.slice(0, 120))
      for (let rot = 0; rot < 4; rot++) {
        if (!this.sim.world.canPlaceItem(t, x, y, rot).ok) continue;
        const it = this.sim.placeItem(t, x, y, rot);
        if (it) return it;
      }
    return null;
  }

  /** Place an item in the lobby, by the entrance. */
  private placeNearEntrance(t: ItemType) {
    const p = this.plot();
    return this.placeNear(t, (p.door[0] + p.door[1]) / 2, p.y1 - 3);
  }

  // ---- staff ---------------------------------------------------------------

  /** Hire the best applicant for a role the bot can afford to keep. */
  hire(role: Role): boolean {
    const c = this.s.candidates
      .filter((x) => x.role === role)
      // a player picks the best rank going, then the cheaper
      .sort((a, b) => b.skill - a.skill || a.salary - b.salary)[0];
    if (!c) return false;
    return !!this.sim.hire(c.id);
  }

  /** Staff in a role who are staying. */
  private staffOf(role: Role) {
    return this.s.staff.filter((x) => x.role === role && x.state !== 'leaving');
  }

  /** One of each role for every station that needs one, and Caretakers for the upkeep. */
  hireToFill() {
    // a Shop Counter needs its own receptionist, or it takes the only one away from the desk
    const desks = this.count('reception_desk') + (process.env.SHARE_DESK ? 0 : this.count('shop_counter'));
    if (this.staffOf('receptionist').length < desks) this.hire('receptionist');
    const consultRooms = this.rooms('consult').length + this.rooms('assess').length;
    if (this.staffOf('consultant').length < consultRooms) this.hire('consultant');
    for (const d of DISCIPLINE_ORDER) {
      const def = DISCIPLINES[d];
      const rooms = this.rooms(def.room).length;
      if (this.staffOf(def.role).length < rooms) this.hire(def.role);
    }
    if (!this.s.open) return;
    const upkeep = this.s.items.filter(
      (i) => !!ITEMS[i.type].station || i.type === 'plant' || i.type === 'toilet',
    ).length;
    const want = Math.max(1, Math.ceil(upkeep / 14));
    if (this.staffOf('caretaker').length < want && this.s.money > 3000) this.hire('caretaker');
  }

  // ---- after opening ------------------------------------------------------

  /** The comforts any center needs once open. */
  private basics() {
    const s = this.s;
    const reserve = this.wages() * 0.5;
    if (!this.sim.hasRoom('staffroom') && s.money > 3000 + reserve) this.buildRoom('staffroom');
    if (!this.sim.hasRoom('restroom') && s.money > 3000 + reserve && s.day > 8) this.buildRoom('restroom');
    if (!this.has('tea_station') && s.money > 1500 + reserve) this.placeNearEntrance('tea_station');
    if (!this.has('snack_machine') && s.money > 2000 + reserve && s.day > 20) this.placeNearEntrance('snack_machine');
    if (this.count('bin') < 2 && s.money > 500) this.placeNearEntrance('bin');
    // a hamper once there are tables to change
    if (!this.has('linen_hamper') && s.money > 1500 + reserve) {
      const room = this.rooms('massage')[0];
      if (room) this.placeNear('linen_hamper', room.door.x + room.door.dx, room.door.y + room.door.dy);
    }
    // heating or cooling once the weather calls for it
    const out = this.sim.outdoorTemp();
    if (out < 58) this.climate('radiator');
    if (out > 82) this.climate('air_conditioner');
  }

  /** A radiator (or air conditioner) in every room and every few corridor tiles that lacks one. */
  private climate(t: 'radiator' | 'air_conditioner') {
    for (const room of this.s.rooms.filter((r) => r.done)) {
      const inside = this.s.items.some((i) => i.type === t && this.sim.world.zoneAt(i.x, i.y) === room.id);
      if (!inside && this.s.money > 2000) this.placeIn(room, t);
    }
    const p = this.plot();
    const want = Math.ceil(((p.x1 - p.x0 + 1) * (p.y1 - p.y0 + 1)) / 60);
    const corridor = this.s.items.filter((i) => i.type === t && this.sim.world.zoneAt(i.x, i.y) === 0).length;
    if (corridor < want && this.s.money > 2000)
      this.placeNear(t, p.x0 + ((corridor * 7) % (p.x1 - p.x0 + 1)), (p.y0 + p.y1) / 2);
  }

  /** Build what new stars unlock: a Training Room, new disciplines' rooms, equipment and a Recovery Lounge. */
  private unlocks() {
    const s = this.s;
    const upTo = unlockedUpTo(s);
    const reserve = this.wages();
    // a Training Room as soon as anyone on the payroll is not trained in something guests now arrive needing
    const untrained = s.staff.some((st) => this.sim.courses(st).some((c) => c.id in MODALITIES));
    if (untrained && !this.sim.hasRoom('training') && this.afford(ROOMS.training.cost + 400, 0, true))
      this.buildRoom('training');
    for (const d of DISCIPLINE_ORDER) {
      if (d === 'massage' || !disciplineOn(s, d)) continue;
      const room = TREAT_ROOM[d];
      const unlock = ROOMS[room].unlock ?? 0;
      if (upTo >= unlock && !this.sim.hasRoom(room) && this.afford(ROOMS[room].cost + 2000, reserve * 0.5, true)) {
        if (this.buildRoom(room)) this.hireToFill();
      }
    }
    // equipment for every unlocked technique, in every room of its discipline
    for (const m of Object.values(MODALITIES)) {
      if (!m.equipment || !this.sim.unlocked(m.id)) continue;
      for (const room of this.rooms(TREAT_ROOM[m.discipline])) {
        const has = s.items.some((i) => i.type === m.equipment && this.sim.world.zoneAt(i.x, i.y) === room.id);
        if (!has && s.money > ITEMS[m.equipment].cost + reserve) this.placeIn(room, m.equipment);
      }
    }
    const restNeeded = Object.values(MODALITIES).some((m) => m.rest && this.sim.unlocked(m.id));
    if (restNeeded && upTo >= 1 && !this.sim.hasRoom('recovery') && s.money > 6000 + reserve)
      this.buildRoom('recovery');
    if (upTo >= 1 && !this.has('shop_counter') && s.money > 4000 + reserve) this.placeNearEntrance('shop_counter');
  }

  /** Send treatment staff on the courses for what is unlocked, one at a time each, keeping a reserve. */
  private train() {
    const s = this.s;
    if (!this.sim.hasRoom('training')) return;
    const reserve = 1000;
    const training = s.staff.filter((x) => x.training).length;
    if (training >= 1) return;
    for (const st of s.staff) {
      if (st.state === 'leaving' || st.training || st.call) continue;
      const course = this.sim
        .courses(st)
        .filter((c) => c.id in MODALITIES)
        .sort((a, b) => a.cost - b.cost)[0];
      if (!course || !this.afford(course.cost, reserve, true)) continue;
      // keep at least one of each discipline at work
      const role = this.staffOf(st.role);
      if (role.filter((x) => !x.training).length < 2 && this.waiting(st.role) > 4) continue;
      if (this.sim.train(st.id, course.id)) return;
    }
  }

  /** Guests waiting for the station a role works at. */
  private waiting(role: Role): number {
    const s = this.s;
    return s.guests.filter((g) => {
      if (g.state !== 'waiting' && g.state !== 'toWait') return false;
      if (role === 'receptionist') return g.goal === 'reception';
      if (role === 'consultant') return g.goal === 'consult' || g.goal === 'assess';
      if (g.goal !== 'treat') return false;
      return DISCIPLINES[this.sim.modalityOf(g).discipline].role === role;
    }).length;
  }

  /** Build another room where a line is long and the money is there. */
  private grow() {
    const s = this.s;
    if (this.profit() < 1500) return;
    const reserve = this.wages() * 1.2 + 2000;
    const desks = this.count('reception_desk');
    if (this.waiting('receptionist') > desks * 5 && s.money > 2500 + reserve) {
      this.placeNearEntrance('reception_desk');
      this.hireToFill();
    }
    const consults = this.rooms('consult').length;
    if (this.waiting('consultant') > consults * 4 && this.afford(ROOMS.consult.cost, reserve * 0.5, true)) {
      if (!this.sim.hasRoom('assess') && s.money > ROOMS.assess.cost + reserve) this.buildRoom('assess');
      else this.buildRoom('consult');
      this.hireToFill();
    }
    for (const d of DISCIPLINE_ORDER) {
      const room = TREAT_ROOM[d];
      const n = this.rooms(room).length;
      if (!n) continue;
      const role = DISCIPLINES[d].role;
      if (this.waiting(role) > n * 3 && this.afford(ROOMS[room].cost, reserve * 0.5, true)) {
        if (this.buildRoom(room)) this.hireToFill();
      }
    }
    // seats for those waiting
    const seats = this.count('bench') * 2;
    if (s.guests.length > seats + 2 && s.money > 400 + reserve) {
      const room = s.rooms.filter((r) => r.done)[Math.floor(s.day) % Math.max(1, s.rooms.length)];
      if (room) this.placeNear('bench', room.door.x + room.door.dx * 2, room.door.y + room.door.dy * 2);
    }
  }

  /** Decor in the treatment rooms until each is a star of prestige above what guests expect. */
  private decorate() {
    const s = this.s;
    const reserve = this.wages() + 3000;
    const picky = CENTERS[s.center].picky?.expects ?? 0;
    const target = Math.min(5, Math.max(3, 2 + picky + (s.grade >= 2 ? 1 : 0)));
    const treat = s.rooms.filter((r) => r.done && ROOMS[r.type].discipline);
    for (const room of treat) {
      if (this.sim.prestige(room) >= target || s.money < reserve) continue;
      for (const t of ['statue', 'salt_lamp', 'diffuser', 'plant'] as const) {
        if (s.money < ITEMS[t].cost + reserve) continue;
        if (this.placeIn(room, t)) break;
      }
    }
  }

  /** Plants and a water cooler in the corridor as the place grows. */
  private comforts() {
    const s = this.s;
    const reserve = this.wages() + 2000;
    const rooms = s.rooms.filter((r) => r.done).length;
    if (this.count('plant') < rooms && s.money > 500 + reserve) {
      const room = s.rooms.filter((r) => r.done)[this.count('plant') % rooms];
      if (room) this.placeNear('plant', room.door.x + room.door.dx, room.door.y + room.door.dy);
    }
    if (this.count('tea_station') < Math.ceil(s.guests.length / 12) && s.money > 1000 + reserve)
      this.placeNearEntrance('tea_station');
    if (this.count('toilet') < Math.ceil(s.guests.length / 10) && s.money > 1000 + reserve) {
      const rr = this.rooms('restroom')[0];
      if (rr) this.placeIn(rr, 'toilet');
    }
  }
}

/** Every doorway a rectangle's walls could have, with the way each opens. */
function perimeterDoors(r: Rect): WallSpot[] {
  const out: WallSpot[] = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    out.push({ x, y: r.y + r.h - 1, dx: 0, dy: 1 });
    out.push({ x, y: r.y, dx: 0, dy: -1 });
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    out.push({ x: r.x, y, dx: -1, dy: 0 });
    out.push({ x: r.x + r.w - 1, y, dx: 1, dy: 0 });
  }
  return out;
}
