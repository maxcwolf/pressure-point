// The simulation: guests, staff, queues, money, reputation.
import {
  type AccessRole,
  ANNOUNCEMENTS,
  ASSESS_FEE,
  BOTCH_FACTOR,
  conditionOf,
  CONDITIONS,
  CONSULT_FEE,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  DECOR_RADIUS,
  DIAGNOSIS_TARGET,
  type Discipline,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  EMERGENCY_CAUSES,
  ENT_IN_Y,
  ENT_X,
  H,
  ITEMS,
  type ItemType,
  LOAN_MAX,
  LOAN_RATE,
  LOAN_STEP,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  type ModalityDef,
  modalityLabel,
  PRICE_MAX,
  PRICE_MIN,
  type Role,
  ROLES,
  ROOMS,
  type RoomType,
  SIDEWALK_Y,
  STAR_GOALS,
  STONE_USE,
  traitOf,
  W,
  WEAR_REPAIR,
  WINDOW_COST,
  WINDOW_MAX_BONUS,
} from './data';
import {
  type Char,
  clamp,
  disciplineOn,
  emptyLedger,
  fairSalary,
  type GameState,
  type Guest,
  irnd,
  type Item,
  type Ledger,
  type Look,
  makeCandidate,
  pick,
  random,
  randomLook,
  randomName,
  refillCandidates,
  rnd,
  type Room,
  sameSpot,
  type Staff,
  type WallSpot,
  type Waypoint,
} from './state';
import { at, must } from './util';
import {
  accessPose,
  accessTile,
  footprint,
  inBounds,
  inBuilding,
  itemCenter,
  type PosePoint,
  type Rect,
  rotVec,
  tileIdx,
  World,
  Z_CORRIDOR,
} from './world';

export type SimEvent =
  | { type: 'float'; text: string; x: number; y: number; kind: 'good' | 'bad' | 'info' }
  | { type: 'toast'; text: string; kind: 'good' | 'bad' | 'info' }
  | { type: 'sfx'; name: string }
  | { type: 'announce'; text: string }
  | { type: 'star'; stars: number };

/** Something a member of staff can study in a Training Room. */
export interface Course {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  days: number;
}

/** Why a table cannot deliver a modality properly right now ('' when it can). */
export type DeliveryProblem = '' | 'unqualified' | 'no-equipment' | 'cold';

export interface Objective {
  label: string;
  done: boolean;
  progress: number;
}

const GOAL_NAME = {
  reception: 'Reception Desk',
  consult: 'Consultation Room',
  assess: 'Posture Lab',
  treat: 'Massage Suite',
} as const;
const NEED_ICON = { drink: '🍵', eat: '🥜', toilet: '🚻' } as const;

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export function dateOf(day: number) {
  const d = Math.floor(day);
  return {
    day: (d % DAYS_PER_MONTH) + 1,
    month: (Math.floor(d / DAYS_PER_MONTH) % 12) + 1,
    year: Math.floor(d / (DAYS_PER_MONTH * 12)) + 1,
  };
}

function turnToward(cur: number, target: number, maxStep: number) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + clamp(d, -maxStep, maxStep);
}

/** The four tiles beside a tile, for standing next to something. */
const BESIDE: readonly (readonly [dx: number, dy: number])[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];

export class Sim {
  world: World;
  private events: SimEvent[] = [];
  /** How pleasant each tile is, from nearby decor and litter. */
  attract = new Float32Array(W * H);
  private slowT = 0;

  constructor(public s: GameState) {
    this.world = new World(s);
  }

  // ---- Lookups & events ----------------------------------------------------
  guest(id: number): Guest | undefined {
    return id ? this.s.guests.find((g) => g.id === id) : undefined;
  }
  staff(id: number): Staff | undefined {
    return id ? this.s.staff.find((g) => g.id === id) : undefined;
  }
  char(id: number): Char | undefined {
    return this.guest(id) ?? this.staff(id);
  }
  emit(e: SimEvent) {
    this.events.push(e);
  }
  drain(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  private toast(text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    this.emit({ type: 'toast', text, kind });
  }
  private tipOnce(id: string, text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    if (this.s.seenTips.includes(id)) return;
    this.s.seenTips.push(id);
    this.toast(text, kind);
  }

  // ---- Money ---------------------------------------------------------------
  private earn(amount: number, kind: 'consult' | 'treatment' | 'vending', x: number, y: number) {
    this.s.money += amount;
    this.s.ledger[kind] += amount;
    this.emit({ type: 'float', text: `+${money(amount)}`, x, y, kind: 'good' });
    if (amount >= 100) this.emit({ type: 'sfx', name: 'cash' });
  }
  private spend(amount: number, kind: 'salaries' | 'building' | 'training' | 'interest') {
    this.s.money -= amount;
    this.s.ledger[kind] += amount;
  }
  private changeRep(delta: number) {
    const s = this.s;
    // gains taper off as reputation climbs
    if (delta > 0) delta *= 1.15 - s.reputation / 120;
    s.reputation = clamp(s.reputation + delta, 0, 100);
  }

  // ---- Main loop -----------------------------------------------------------
  tick(dtReal: number) {
    let total = Math.min(dtReal, 0.1) * this.s.speed;
    while (total > 1e-6) {
      const h = Math.min(total, 0.05);
      this.step(h);
      total -= h;
    }
  }

  private step(dt: number) {
    const s = this.s;
    const prevMonth = Math.floor(s.day / DAYS_PER_MONTH);
    s.day += dt / DAY_SECONDS;
    if (Math.floor(s.day / DAYS_PER_MONTH) !== prevMonth) this.monthEnd();

    if (!s.open && this.hasItem('reception_desk') && this.hasRoom('consult') && this.hasRoom('massage')) {
      s.open = true;
      s.spawnT = 3;
      this.toast('Grand opening! Guests are on their way.', 'good');
      this.emit({ type: 'announce', text: 'The healing center is now open. Please form an orderly line of ailments.' });
      this.emit({ type: 'sfx', name: 'fanfare' });
    }
    if (s.open) {
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        if (s.guests.length < 14 + this.s.rooms.length * 5) this.spawnGuest();
        s.spawnT = (30 - s.reputation * 0.2) * rnd(0.7, 1.3);
      }
    }

    this.updateStations(dt);
    for (const g of [...s.guests]) this.updateGuest(g, dt);
    for (const st of [...s.staff]) this.updateStaff(st, dt);
    for (const it of s.items) {
      if (it.type === 'plant') it.water = Math.max(0, it.water - dt * 0.3);
      else if (it.type === 'stone_warmer') it.water = Math.max(0, it.water - dt * 0.08);
    }

    this.slowT -= dt;
    if (this.slowT <= 0) {
      this.slowT = 1;
      this.updateAttract();
      this.updateEmergency();
      this.checkStars();
    }
    s.announceT -= dt;
    if (s.announceT <= 0) {
      s.announceT = rnd(40, 70);
      if (s.open) this.emit({ type: 'announce', text: this.contextAnnouncement() ?? pick(ANNOUNCEMENTS) });
    }
  }

  private monthEnd() {
    const s = this.s;
    const wages = s.staff.filter((x) => x.state !== 'leaving').reduce((a, x) => a + x.salary, 0);
    if (wages > 0) {
      this.spend(wages, 'salaries');
      this.toast(`Payday: ${money(wages)} in salaries.`, s.money < 0 ? 'bad' : 'info');
      this.emit({ type: 'sfx', name: 'payday' });
    }
    const interest = Math.round(s.loan * LOAN_RATE);
    if (interest > 0) this.spend(interest, 'interest');
    s.history.push(netOf(s.ledger));
    if (s.history.length > 12) s.history.shift();
    s.lastLedger = s.ledger;
    s.ledger = emptyLedger();
    refillCandidates(s, true);
    if (s.money < 0) this.toast('You are in the red. Heal faster!', 'bad');
  }

  private updateAttract() {
    const grid = this.attract;
    grid.fill(0);
    const R = DECOR_RADIUS;
    const spread = (cx: number, cy: number, amount: number) => {
      for (let y = cy - R; y <= cy + R; y++) {
        for (let x = cx - R; x <= cx + R; x++) {
          if (!inBounds(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy);
          const i = tileIdx(x, y);
          if (d <= R) grid[i] = at(grid, i) + amount * (1 - d / (R + 1));
        }
      }
    };
    for (const it of this.s.items) {
      const decor = this.decorOf(it);
      if (!decor) continue;
      const [cx, cy] = itemCenter(it);
      spread(Math.floor(cx), Math.floor(cy), decor);
    }
    for (const l of this.s.litter) spread(l.x, l.y, -2.5);
  }
  /** A wilted plant drags its surroundings down instead of lifting them. */
  private decorOf(it: Item): number {
    if (it.type === 'plant' && it.water <= 15) return -1;
    return ITEMS[it.type].decor ?? 0;
  }
  /** Patience drains slower in pleasant surroundings and faster in grim ones. */
  drainFactor(x: number, y: number): number {
    return clamp(1.12 - (inBounds(x, y) ? at(this.attract, tileIdx(x, y)) : 0) * 0.035, 0.7, 1.4);
  }
  /** One to five, from how roomy and how nicely furnished a room is. */
  prestige(room: Room): number {
    const def = ROOMS[room.type];
    let score = (room.w * room.h - def.minShort * def.minLong) * 0.4;
    for (const it of this.s.items) if (this.world.zoneAt(it.x, it.y) === room.id) score += this.decorOf(it);
    for (const l of this.s.litter) if (this.world.zoneAt(l.x, l.y) === room.id) score -= 2;
    // daylight helps, up to a point
    score += Math.min(room.windows.length, WINDOW_MAX_BONUS) * 1.5;
    return clamp(1 + Math.floor(score / 3), 1, 5);
  }

  private checkStars() {
    const s = this.s;
    const goal = STAR_GOALS[s.stars];
    if (!goal) return;
    if (s.stats.healed >= goal.healed && s.reputation >= goal.reputation && s.money >= goal.balance) {
      s.stars++;
      s.money += 5000 * s.stars;
      refillCandidates(s, true);
      this.emit({ type: 'star', stars: s.stars });
      this.emit({ type: 'sfx', name: 'fanfare' });
    }
  }

  objectives(): Objective[] {
    const s = this.s;
    const goal = STAR_GOALS[s.stars];
    if (!goal) return [];
    const out: Objective[] = [
      {
        label: `Heal ${goal.healed} guests (${Math.min(s.stats.healed, goal.healed)}/${goal.healed})`,
        done: s.stats.healed >= goal.healed,
        progress: s.stats.healed / goal.healed,
      },
      {
        label: `Reach ${goal.reputation}% reputation`,
        done: s.reputation >= goal.reputation,
        progress: s.reputation / goal.reputation,
      },
    ];
    if (goal.balance > 0)
      out.push({
        label: `Have ${money(goal.balance)} in the bank`,
        done: s.money >= goal.balance,
        progress: s.money / goal.balance,
      });
    return out;
  }

  hasItem(t: ItemType) {
    return this.s.items.some((i) => i.type === t && this.world.usable(i));
  }
  hasRoom(t: RoomType) {
    return this.s.rooms.some((r) => r.type === t && r.done);
  }
  hasStaff(r: Role) {
    return this.s.staff.some((x) => x.role === r && x.state !== 'leaving');
  }

  /** The advisor's current nudge. */
  advice(): string {
    const s = this.s;
    if (!this.hasItem('reception_desk'))
      return 'Welcome! Open the Items menu and place a Reception Desk somewhere near the entrance.';
    if (!this.hasStaff('receptionist')) return 'A desk needs a face behind it. Hire a Receptionist from the Hire menu.';
    if (!this.hasRoom('consult'))
      return 'Guests need diagnosing. Pick a Consultation Room from the Rooms menu, drag out the floor, add a door, then place the furniture.';
    if (!this.hasStaff('consultant')) return 'Hire a Wellness Consultant to run the Consultation Room.';
    if (!this.hasRoom('massage')) return 'Now the main event: build a Massage Suite.';
    if (!this.hasStaff('therapist')) return 'Hire a Massage Therapist and the knots will start untying themselves.';
    const tired = s.staff.some((x) => x.energy < 20);
    if (tired && !this.hasRoom('staffroom'))
      return 'Your staff members are worn out and working slowly. Build a Staff Room so they can take breaks.';
    if (s.guests.some((g) => g.bladder > 85) && !this.hasRoom('restroom'))
      return 'Guests are crossing their legs. A Restroom would be a kindness.';
    if (s.litter.length >= 3 && !this.hasStaff('caretaker'))
      return 'Litter is piling up. Hire a Janitor to keep the place clean.';
    if (s.items.some((i) => i.type === 'plant' && i.water < 20) && !this.hasStaff('caretaker'))
      return 'Your plants are wilting. A Janitor will water them.';
    if (s.offer) return 'There is an emergency on offer at the top of the screen. Accept it only if you can cope.';
    const broken = s.items.find((i) => i.wear >= 100);
    if (broken)
      return this.hasStaff('caretaker')
        ? `A ${ITEMS[broken.type].name} has broken down. Your Janitor will get to it.`
        : `A ${ITEMS[broken.type].name} has broken down. Hire a Janitor to repair it.`;
    const asking = s.staff.find((x) => x.raiseAsked && x.state !== 'leaving');
    if (asking) return `${asking.name} wants a raise. Select them to respond, or they may quit.`;
    if (s.money < 0 && s.loan < LOAN_MAX) return 'You are in the red. A loan from the Money menu would tide you over.';
    const gap = this.modalityAdvice();
    if (gap) return gap;
    for (const it of s.items) {
      const st = ITEMS[it.type].station;
      if (!st || !this.world.usable(it)) continue;
      if (it.queue.length >= 2 && !it.staffId)
        return `Guests are lining up for a ${this.stationPlace(it)} with nobody staffing it. Hire another ${ROLES[st.staff].name}.`;
      if (it.queue.length >= 6)
        return `The line for the ${this.stationPlace(it)} is getting long. Build another and staff it.`;
    }
    if (s.guests.length > 4 && !s.items.some((i) => i.type === 'bench'))
      return 'Standing guests lose patience quickly. Put some Benches in the corridors.';
    if (s.guests.some((g) => g.thirst > 85) && !this.hasItem('tea_station'))
      return 'Guests are parched. A Herbal Tea Station would help, and it earns a little too.';
    if (!STAR_GOALS[s.stars]) return 'Three stars! You have mastered massage. Acupuncture and reiki are coming soon.';
    return 'Looking good. Keep an eye on the objectives to earn your next star.';
  }

  /** Nudge about modalities guests are waiting for that the center cannot deliver. */
  private modalityAdvice(): string {
    const s = this.s;
    for (const m of MODALITY_ORDER) {
      const def = MODALITIES[m];
      if (!this.unlocked(m)) continue;
      const wanted = s.guests.some((g) => g.goal === 'treat' && conditionOf(g.condition).modality === m);
      if (!wanted) continue;
      const role = ROLES[DISCIPLINES[def.discipline].role];
      const room = ROOMS[DISCIPLINES[def.discipline].room];
      const staff = s.staff.filter((x) => x.role === role.role && x.state !== 'leaving');
      const an = /^[AEIOU]/.test(role.name) ? 'an' : 'a';
      if (!staff.length) return `Guests need ${modalityLabel(m)}. Hire ${an} ${role.name} for your ${room.name}.`;
      const studying = staff.some((x) => x.training?.course === m);
      if (!staff.some((x) => x.quals.includes(m)) && !studying) {
        return this.hasRoom('training')
          ? `Guests need ${modalityLabel(m)} and nobody is qualified. Select ${an} ${role.name} and send them on the course.`
          : `Guests need ${modalityLabel(m)} and nobody is qualified. Build a Training Room, then train ${an} ${role.name}.`;
      }
      if (def.equipment) {
        const eq = ITEMS[def.equipment];
        const have = s.items.filter((i) => i.type === def.equipment && this.world.usable(i));
        if (!have.length)
          return `${modalityLabel(m)} needs a ${eq.name} in the ${room.name}. You'll find it in the Items menu.`;
        if (def.equipment === 'stone_warmer' && have.every((i) => i.water < STONE_USE))
          return this.hasStaff('caretaker')
            ? 'The massage stones have gone cold. Your Janitor is stretched thin.'
            : 'The massage stones have gone cold. Hire a Janitor to keep the Stone Warmer hot.';
      }
    }
    // a newly available discipline nobody has set up yet
    for (const d of DISCIPLINE_ORDER) {
      const def = DISCIPLINES[d];
      const room = ROOMS[def.room];
      if (!def.optional || !this.enabled(d) || s.stars < (room.unlock ?? 0) || this.hasRoom(def.room)) continue;
      return `${def.name} is now available. Build an ${room.name} and hire an ${ROLES[def.role].name} to bring in a new kind of guest.`;
    }
    return '';
  }

  // ---- Disciplines and modalities ------------------------------------------
  /** Switched on for this game. */
  enabled(d: Discipline) {
    return disciplineOn(this.s, d);
  }
  /** Switch an optional discipline on or off. What is already built stays, but its guests stop arriving. */
  setDiscipline(d: Discipline, on: boolean) {
    if (!DISCIPLINES[d].optional) return;
    this.s.options[d] = on;
    refillCandidates(this.s);
  }
  /** The center can actually take guests for this discipline: it is on and has a finished room. */
  offered(d: Discipline) {
    return this.enabled(d) && this.hasRoom(DISCIPLINES[d].room);
  }
  unlocked(m: Modality) {
    return this.s.stars >= MODALITIES[m].star && this.enabled(MODALITIES[m].discipline);
  }
  modalityOf(g: Guest): ModalityDef {
    return MODALITIES[conditionOf(g.condition).modality];
  }
  /** What to call the place a station is in: its room, or the item itself in a corridor. */
  private stationPlace(it: Item): string {
    const where = ITEMS[it.type].where;
    return where === 'corridor' || where === 'any' ? ITEMS[it.type].name : ROOMS[where].name;
  }
  /** Working equipment for a modality in the suite around a table. */
  private equipmentProblem(table: Item, def: ModalityDef): DeliveryProblem {
    if (!def.equipment) return '';
    const zone = this.world.zoneAt(table.x, table.y);
    const kit = this.s.items.filter((i) => i.type === def.equipment && this.world.zoneAt(i.x, i.y) === zone);
    if (!kit.length) return 'no-equipment';
    if (def.equipment === 'stone_warmer' && kit.every((i) => i.water < STONE_USE)) return 'cold';
    return '';
  }
  /** Can this table, with this therapist, deliver the modality properly? */
  deliveryProblem(table: Item, staff: Staff | undefined, def: ModalityDef): DeliveryProblem {
    const kit = this.equipmentProblem(table, def);
    if (kit) return kit;
    if (staff && !staff.quals.includes(def.id)) return 'unqualified';
    return '';
  }

  private contextAnnouncement(): string | null {
    for (const it of this.s.items) {
      const st = ITEMS[it.type].station;
      if (st && this.world.usable(it) && it.queue.length >= 2 && !it.staffId)
        return `${ROLES[st.staff].name} needed at the ${this.stationPlace(it)}.`;
    }
    if (this.s.litter.length >= 4) return 'Janitor needed. The corridors are getting crunchy.';
    return null;
  }

  // ---- Movement ------------------------------------------------------------
  goTo(c: Char, tx: number, ty: number, pp?: PosePoint): boolean {
    let sx = c.tx;
    let sy = c.ty;
    const ahead = c.path?.[0];
    if (ahead && !ahead[2]) {
      const [wx, wy] = ahead;
      if (Math.hypot(wx - c.x, wy - c.y) < 0.5) {
        sx = Math.floor(wx);
        sy = Math.floor(wy);
      }
    }
    const p = this.world.findPath(sx, sy, tx, ty);
    if (!p) return false;
    const path: Waypoint[] = [];
    if (Math.hypot(sx + 0.5 - c.x, sy + 0.5 - c.y) > 0.05) path.push([sx + 0.5, sy + 0.5, 0]);
    for (const wp of p) path.push(wp);
    if (pp) {
      path.push([pp.x, pp.y, 1]);
      c.endPose = pp.pose;
      c.endH = pp.h;
      c.endFace = pp.face;
    }
    c.dest = pp ? [tx, ty, pp.x, pp.y, 1] : [tx, ty, 0, 0, 0];
    c.path = path;
    c.pose = 'walk';
    c.h = 0;
    c.busy = false;
    return true;
  }

  /** Advance along the current path. Returns true on the tick the path completes. */
  private move(c: Char, dt: number, speed: number): boolean {
    if (!c.path) return false;
    let remaining = speed * dt;
    for (let next = c.path[0]; next && remaining > 0; next = c.path[0]) {
      const [wx, wy, isPose] = next;
      const dx = wx - c.x;
      const dy = wy - c.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-3) c.facing = turnToward(c.facing, Math.atan2(dx, dy), dt * 14);
      if (d <= remaining) {
        c.x = wx;
        c.y = wy;
        remaining -= d;
        c.path.shift();
        if (isPose) {
          c.pose = c.endPose;
          c.h = c.endH;
          c.facing = c.endFace;
        } else {
          c.tx = Math.floor(wx);
          c.ty = Math.floor(wy);
        }
      } else {
        c.x += (dx / d) * remaining;
        c.y += (dy / d) * remaining;
        remaining = 0;
      }
    }
    if (!c.path.length) {
      c.path = null;
      c.dest = null;
      if (c.pose === 'walk') c.pose = 'stand';
      return true;
    }
    return false;
  }

  private halt(c: Char) {
    c.path = null;
    c.dest = null;
    c.busy = false;
    c.pose = 'stand';
    c.h = 0;
  }

  private repathAll() {
    for (const c of [...this.s.guests, ...this.s.staff] as Char[]) {
      const d = c.dest;
      if (!d || !c.path) continue;
      const pp = d[4] ? { x: d[2], y: d[3], face: c.endFace, pose: c.endPose, h: c.endH } : undefined;
      if (this.goTo(c, d[0], d[1], pp)) continue;
      if (c.kind === 'guest') this.resetGuest(c);
      else this.staffIdle(c);
    }
  }

  // ---- Claims on seats and facilities --------------------------------------
  private claim(c: Char, it: Item, idx: number) {
    this.release(c);
    it.users[idx] = c.id;
    c.claimItem = it.id;
    c.claimIdx = idx;
  }
  private release(c: Char) {
    if (!c.claimItem) return;
    const it = this.world.item(c.claimItem);
    if (it?.users[c.claimIdx] === c.id) it.users[c.claimIdx] = 0;
    c.claimItem = 0;
  }
  private findAccess(role: AccessRole, x: number, y: number, maxDist = 1e9): { item: Item; idx: number } | null {
    let best: { item: Item; idx: number } | null = null;
    let bestD = maxDist;
    for (const it of this.s.items) {
      const acc = ITEMS[it.type].access;
      for (const [i, spot] of acc.entries()) {
        if (spot.role !== role || it.users[i] || !this.world.usable(it)) continue;
        const [ax, ay] = accessTile(it, i);
        const d = Math.hypot(ax - x, ay - y);
        if (d < bestD) {
          bestD = d;
          best = { item: it, idx: i };
        }
      }
    }
    return best;
  }
  private accessIndex(it: Item, role: AccessRole) {
    return ITEMS[it.type].access.findIndex((a) => a.role === role);
  }

  private baseChar(name: string, look: Look, x: number, y: number) {
    return {
      id: this.s.nextId++,
      name,
      x: x + 0.5,
      y: y + 0.5,
      tx: x,
      ty: y,
      facing: 0,
      path: null,
      dest: null,
      pose: 'stand' as const,
      h: 0,
      busy: false,
      endPose: 'stand' as const,
      endH: 0,
      endFace: 0,
      look,
      bubble: '',
      bubbleT: 0,
      claimItem: 0,
      claimIdx: 0,
      timer: 0,
    };
  }
  private say(c: Char, icon: string, seconds = 2.2) {
    c.bubble = icon;
    c.bubbleT = seconds;
  }
  private streetTile(): [number, number] {
    return [random() < 0.5 ? 0 : W - 1, SIDEWALK_Y];
  }
  private lobbyTile(): [number, number] {
    return [pick(ENT_X), ENT_IN_Y - 1];
  }

  // ---- Stations ------------------------------------------------------------
  /** Lower is better. Guests steer toward tables that can actually deliver what they need. */
  private stationScore(it: Item, g: Guest) {
    let score = it.queue.length + (it.serving ? 1 : 0) + (it.staffId ? 0 : 2.5);
    if (ITEMS[it.type].station?.goal === 'treat') {
      const problem = this.deliveryProblem(it, this.staff(it.staffId), this.modalityOf(g));
      if (problem === 'unqualified') score += 6;
      else if (problem) score += 40;
    }
    return score;
  }
  private pickStation(g: Guest): Item | null {
    const goal = g.goal;
    let best: Item | null = null;
    let bestScore = 1e9;
    for (const it of this.s.items) {
      const st = ITEMS[it.type].station;
      if (st?.goal !== goal || !this.world.usable(it)) continue;
      if (goal === 'treat' && st.discipline !== this.modalityOf(g).discipline) continue;
      const score = this.stationScore(it, g);
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  private serviceSeconds(base: number, st: Staff) {
    let speed = 0.85 + st.skill * 0.05;
    for (const t of st.traits) speed *= traitOf(t).speed ?? 1;
    if (st.energy < 15) speed *= 0.6;
    speed *= 0.9 + st.morale / 500;
    return base / speed;
  }

  private updateStations(dt: number) {
    for (const it of this.s.items) {
      const def = ITEMS[it.type].station;
      if (!def) continue;
      const staff = this.staff(it.staffId);
      if (it.staffId && staff?.post !== it.id) it.staffId = 0;
      const ready = !!staff && staff.state === 'atPost' && this.world.usable(it);
      let g = this.guest(it.serving);
      if (it.serving && (g?.station !== it.id || (g.state !== 'called' && g.state !== 'served'))) {
        it.serving = 0;
        g = undefined;
      }
      if (it.queue.some((id) => this.guest(id)?.station !== it.id))
        it.queue = it.queue.filter((id) => this.guest(id)?.station === it.id);
      // tired staff finish with their current guest, then stop calling new ones so they can get away
      const wantsBreak = !!staff && staff.energy < 18 && !!this.findAccess('rest', staff.tx, staff.ty);
      if (!it.serving && ready && !wantsBreak) {
        for (const id of it.queue) {
          const q = this.guest(id);
          if (q?.state === 'waiting' || q?.state === 'toWait') {
            this.callGuest(it, q);
            break;
          }
        }
      }
      if (staff && ready) {
        const served = g?.state === 'served' ? g : undefined;
        const mod = served && def.goal === 'treat' ? this.modalityOf(served) : null;
        staff.busy = !!served;
        staff.strain = mod ? mod.strain : 1;
        if (served) {
          it.progress += dt / this.serviceSeconds(mod ? mod.seconds : def.seconds, staff);
          if (it.progress >= 1) this.completeService(it, served, staff);
        }
      }
    }
  }

  private callGuest(it: Item, g: Guest) {
    it.queue = it.queue.filter((id) => id !== g.id);
    it.serving = g.id;
    it.progress = 0;
    this.release(g);
    const ai = this.accessIndex(it, 'guest');
    const [ax, ay] = accessTile(it, ai);
    g.state = 'called';
    g.timer = 40;
    if (!this.goTo(g, ax, ay, accessPose(it, ai))) {
      it.serving = 0;
      this.leave(g);
    }
  }

  private completeService(it: Item, g: Guest, staff: Staff) {
    const def = must(ITEMS[it.type].station, 'station');
    it.serving = 0;
    it.progress = 0;
    staff.busy = false;
    staff.served++;
    g.patience = Math.min(100, g.patience + 30);
    this.addWear(it);
    const room = this.world.roomOfItem(it);
    const nice = room ? (this.prestige(room) - 1) * 0.02 : 0;
    const price = this.s.priceLevel;
    if (def.goal === 'reception') {
      g.goal = 'consult';
      this.say(g, '📋');
      this.emit({ type: 'sfx', name: 'blip' });
    } else if (def.goal === 'consult' || def.goal === 'assess') {
      g.consults++;
      const gain = def.goal === 'consult' ? 0.4 + staff.skill * 0.13 + rnd(0, 0.15) : 0.45 + staff.skill * 0.08;
      g.diagnosis = clamp(g.diagnosis + gain + nice, 0, 1);
      const fee = Math.round((def.goal === 'consult' ? CONSULT_FEE : ASSESS_FEE) * price);
      this.earn(fee, 'consult', g.x, g.y);
      g.spent += fee;
      if (g.diagnosis >= DIAGNOSIS_TARGET || g.consults >= 4) {
        g.goal = 'treat';
        this.say(g, '💡');
        // steep prices put some guests off once they hear what the treatment costs
        if (!g.emergency && random() < Math.max(0, (price - 1) * 0.35)) {
          g.outcome = 'stormed';
          g.goal = 'leave';
          this.s.stats.stormed++;
          this.changeRep(-1);
          this.say(g, '💸', 6);
          this.emit({ type: 'float', text: 'Too pricey!', x: g.x, y: g.y, kind: 'bad' });
          this.tipOnce(
            'pricey',
            'A guest balked at your prices and left. High prices earn more per guest but drive some away.',
            'bad',
          );
        }
      } else {
        // unsure: a scan settles it if there is a Posture Lab, otherwise it is back to the Consultant
        g.goal = def.goal === 'consult' && this.hasRoom('assess') ? 'assess' : 'consult';
        this.say(g, '❓');
        this.tipOnce(
          'rediagnose',
          'Some guests need more than one consultation before the diagnosis is certain. A skilled Consultant helps, and so does a Posture Lab.',
        );
      }
    } else {
      const cond = conditionOf(g.condition);
      const mod = MODALITIES[cond.modality];
      const problem = this.deliveryProblem(it, staff, mod);
      let chance = clamp(
        0.56 +
          staff.skill * 0.09 +
          Math.min(1, g.diagnosis) * 0.15 +
          nice -
          mod.difficulty -
          (staff.energy < 15 ? 0.15 : 0),
        0.3,
        0.98,
      );
      // the wrong hands or missing equipment: they try anyway, and it rarely works
      if (problem) chance *= BOTCH_FACTOR;
      else if (mod.equipment === 'stone_warmer') {
        const zone = this.world.zoneAt(it.x, it.y);
        const warmer = this.s.items
          .filter((i) => i.type === 'stone_warmer' && this.world.zoneAt(i.x, i.y) === zone && i.water >= STONE_USE)
          .sort((a, b) => b.water - a.water)[0];
        if (warmer) warmer.water -= STONE_USE;
      }
      g.goal = 'leave';
      if (random() < chance) {
        g.outcome = 'healed';
        this.s.stats.healed++;
        const fee = Math.round(cond.fee * price);
        this.earn(fee, 'treatment', g.x, g.y);
        g.spent += fee;
        // good value earns a better name than a steep bill does
        this.changeRep((1.8 + g.patience / 100) * (1.25 - 0.25 * price));
        if (g.emergency && this.s.emergency) this.s.emergency.healed++;
        this.say(g, '💖', 6);
        this.emit({ type: 'sfx', name: 'heal' });
      } else {
        g.outcome = 'failed';
        this.s.stats.failed++;
        this.changeRep(-2.5);
        this.say(g, '💢', 6);
        const why = {
          '': 'Still knotted!',
          unqualified: 'Not qualified!',
          'no-equipment': 'No equipment!',
          cold: 'Cold stones!',
        }[problem];
        this.emit({ type: 'float', text: why, x: g.x, y: g.y, kind: 'bad' });
        this.emit({ type: 'sfx', name: 'fail' });
        if (problem === 'unqualified')
          this.tipOnce(
            `botch-qual-${mod.id}`,
            `${staff.name} is not trained in ${modalityLabel(mod.id)} and botched it. Send them on the course in a Training Room.`,
            'bad',
          );
        else if (problem === 'no-equipment')
          this.tipOnce(
            `botch-equipment-${mod.id}`,
            `${modalityLabel(mod.id)} needs a ${mod.equipment ? ITEMS[mod.equipment].name : 'piece of equipment'} in the same ${ROOMS[DISCIPLINES[mod.discipline].room].name} as the table.`,
            'bad',
          );
        else if (problem === 'cold')
          this.tipOnce('botch-cold', 'The massage stones were cold. A Janitor keeps Stone Warmers hot.', 'bad');
        else
          this.tipOnce(
            'failed',
            'A treatment failed, and that guest is not paying. Skilled, well-rested Therapists and a confident diagnosis improve the odds.',
            'bad',
          );
      }
    }
    this.decide(g);
  }

  // ---- Guests --------------------------------------------------------------
  private spawnGuest(condition?: string, emergency = false) {
    const s = this.s;
    const [x, y] = this.streetTile();
    const g: Guest = {
      ...this.baseChar(randomName(), randomLook(), x, y),
      kind: 'guest',
      condition: condition ?? this.rollCondition(),
      // emergency cases arrive already diagnosed and go straight to treatment
      goal: emergency ? 'treat' : 'reception',
      state: 'enter',
      station: 0,
      needKind: '',
      thirst: rnd(0, 45),
      hunger: rnd(0, 40),
      bladder: rnd(0, 40),
      patience: 100,
      diagnosis: emergency ? 1 : 0,
      consults: 0,
      outcome: '',
      spent: 0,
      hasWrapper: false,
      waited: 0,
      emergency,
    };
    const [lx, ly] = this.lobbyTile();
    if (!this.goTo(g, lx, ly)) return;
    s.guests.push(g);
    s.stats.arrived++;
  }

  /**
   * Guests only arrive with conditions the center could treat: the modality is unlocked and
   * its discipline has a finished room. Ones nobody on the payroll is qualified for turn up
   * less often, so a new star or a new clinic is not an instant flood of failures.
   */
  private rollCondition(): string {
    const staff = this.s.staff.filter((x) => x.state !== 'leaving');
    let pool = CONDITIONS.filter((c) => this.unlocked(c.modality) && this.offered(MODALITIES[c.modality].discipline));
    if (!pool.length) pool = CONDITIONS.filter((c) => c.modality === DISCIPLINES.massage.base);
    const weights = pool.map((c) => (staff.some((t) => t.quals.includes(c.modality)) ? 1 : 0.4));
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    for (const [i, condition] of pool.entries()) {
      roll -= at(weights, i);
      if (roll <= 0) return condition.id;
    }
    return at(pool, 0).id;
  }

  private removeFromStations(g: Guest) {
    for (const it of this.s.items) {
      if (it.serving === g.id) it.serving = 0;
      if (it.queue.includes(g.id)) it.queue = it.queue.filter((id) => id !== g.id);
    }
    g.station = 0;
  }

  /** Put a guest back to square one of their current goal. */
  private resetGuest(g: Guest) {
    this.release(g);
    this.removeFromStations(g);
    this.halt(g);
    this.decide(g);
  }

  private decide(g: Guest) {
    if (g.goal === 'leave') {
      this.leave(g);
      return;
    }
    const st = this.pickStation(g);
    g.station = st ? st.id : 0;
    if (st) st.queue.push(g.id);
    this.goWait(g);
  }

  /** The n-th spot in the line in front of a reception desk. */
  private queueTile(it: Item, n: number): [number, number] {
    const ai = this.accessIndex(it, 'guest');
    const [ax, ay] = accessTile(it, ai);
    const face = at(ITEMS[it.type].access, ai).face;
    const [dx, dy] = rotVec(it.rot, -face[0], -face[1]);
    let x = ax;
    let y = ay;
    for (let i = 0; i <= n; i++) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        !inBuilding(nx, ny) ||
        this.world.zone[tileIdx(nx, ny)] !== Z_CORRIDOR ||
        this.world.blocked[tileIdx(nx, ny)]
      ) {
        const spots = this.world.standSpots(ax, ay, n + 6);
        return spots[Math.min(spots.length - 1, n + 2)] ?? [ax, ay];
      }
      x = nx;
      y = ny;
    }
    return [x, y];
  }

  private waitAnchor(g: Guest): [number, number] {
    const st = this.world.item(g.station);
    if (st) {
      const room = this.world.roomOfItem(st);
      if (room) return [room.door.x + room.door.dx, room.door.y + room.door.dy];
      return accessTile(st, this.accessIndex(st, 'guest'));
    }
    return [ENT_X[0], ENT_IN_Y - 3];
  }

  private goWait(g: Guest) {
    this.release(g);
    g.state = 'toWait';
    g.needKind = '';
    const st = this.world.item(g.station);
    let ok = false;
    if (st?.type === 'reception_desk') {
      const [qx, qy] = this.queueTile(st, Math.max(0, st.queue.indexOf(g.id)));
      ok = this.goTo(g, qx, qy);
    } else {
      const [ax, ay] = this.waitAnchor(g);
      const seat = this.findAccess('seat', ax, ay, 11);
      if (seat) {
        this.claim(g, seat.item, seat.idx);
        const [sx, sy] = accessTile(seat.item, seat.idx);
        ok = this.goTo(g, sx, sy, accessPose(seat.item, seat.idx));
        if (!ok) this.release(g);
      }
      if (!ok) {
        const spots = this.world.standSpots(ax, ay, 14);
        if (spots.length) {
          const [sx, sy] = pick(spots);
          ok = this.goTo(g, sx, sy);
        }
      }
    }
    if (!ok) {
      this.halt(g);
      g.state = 'waiting';
    }
  }

  private tryNeed(g: Guest): boolean {
    const kind = g.bladder > 75 ? 'toilet' : g.thirst > 70 ? 'drink' : g.hunger > 75 ? 'eat' : '';
    if (!kind) return false;
    const a = this.findAccess(kind, g.tx, g.ty);
    if (!a) return false;
    this.claim(g, a.item, a.idx);
    const [ax, ay] = accessTile(a.item, a.idx);
    if (!this.goTo(g, ax, ay, accessPose(a.item, a.idx))) {
      this.release(g);
      return false;
    }
    g.needKind = kind;
    g.state = 'toNeed';
    this.say(g, NEED_ICON[kind]);
    return true;
  }

  private waitingThink(g: Guest) {
    const st = this.world.item(g.station);
    if (!st || !this.world.usable(st)) {
      this.removeFromStations(g);
      const ns = this.pickStation(g);
      if (ns) {
        ns.queue.push(g.id);
        g.station = ns.id;
        this.goWait(g);
        return;
      }
      if (g.goal === 'assess') {
        g.goal = 'consult';
        this.decide(g);
        return;
      }
      if (g.goal !== 'leave' && g.goal !== 'reception') {
        const place =
          g.goal === 'treat' ? ROOMS[DISCIPLINES[this.modalityOf(g).discipline].room].name : GOAL_NAME[g.goal];
        this.tipOnce(`missing-${place}`, `Guests are waiting for a ${place}, but there isn't a working one.`, 'bad');
      }
    } else {
      // hop to a clearly better line if one has opened up
      const better = this.pickStation(g);
      if (better && better !== st && this.stationScore(better, g) + 2 < this.stationScore(st, g) - 1) {
        this.removeFromStations(g);
        better.queue.push(g.id);
        g.station = better.id;
        this.goWait(g);
        return;
      }
    }
    if (this.tryNeed(g)) return;

    if (g.hasWrapper && random() < 0.2) {
      g.hasWrapper = false;
      const nearBin = this.s.items.some((i) => i.type === 'bin' && Math.hypot(i.x - g.tx, i.y - g.ty) < 7);
      const clear = !this.s.litter.some((l) => l.x === g.tx && l.y === g.ty);
      if (clear && random() < (nearBin ? 0.12 : 0.9))
        this.s.litter.push({ id: this.s.nextId++, x: g.tx, y: g.ty, claimedBy: 0 });
    }

    if (st?.type === 'reception_desk') {
      const [qx, qy] = this.queueTile(st, Math.max(0, st.queue.indexOf(g.id)));
      if (qx !== g.tx || qy !== g.ty) {
        if (this.goTo(g, qx, qy)) g.state = 'toWait';
      }
    } else if (!g.claimItem) {
      const [ax, ay] = this.waitAnchor(g);
      if (this.findAccess('seat', ax, ay, 11)) this.goWait(g);
    }
  }

  private updateGuest(g: Guest, dt: number) {
    g.thirst = Math.min(100, g.thirst + dt * 0.5);
    g.hunger = Math.min(100, g.hunger + dt * 0.36);
    g.bladder = Math.min(100, g.bladder + dt * 0.42);
    if (g.bubbleT > 0) g.bubbleT -= dt;
    const stiff = g.outcome !== 'healed' && conditionOf(g.condition).visual === 'stiff';
    const arrived = this.move(g, dt, stiff ? 1.75 : 2.1);

    const waiting = g.state === 'toWait' || g.state === 'waiting' || g.state === 'toNeed' || g.state === 'need';
    if (waiting) {
      let drain = 0.85 * this.drainFactor(g.tx, g.ty);
      if (g.pose === 'sit') drain *= 0.6;
      if (g.bladder >= 100 || g.thirst >= 100 || g.hunger >= 100) drain *= 1.6;
      g.patience -= drain * dt;
      g.waited += dt;
      if (g.patience <= 0) {
        this.stormOut(g);
        return;
      }
    }

    switch (g.state) {
      case 'enter':
        if (arrived) this.decide(g);
        break;
      case 'toWait':
        if (arrived || !g.path) {
          g.state = 'waiting';
          g.timer = rnd(0.3, 1);
          const st = this.world.item(g.station);
          if (st && g.pose === 'stand') {
            const [cx, cy] = itemCenter(st);
            g.facing = Math.atan2(cx - g.x, cy - g.y);
          }
        }
        break;
      case 'waiting':
        g.timer -= dt;
        if (g.timer <= 0) {
          g.timer = 0.8;
          this.waitingThink(g);
        }
        break;
      case 'called':
        g.timer -= dt;
        if (arrived) g.state = 'served';
        else if (g.timer <= 0 || !g.path) this.resetGuest(g);
        break;
      case 'served':
        break;
      case 'toNeed':
        if (arrived) {
          g.state = 'need';
          g.timer = g.needKind === 'toilet' ? 3.5 : 2.2;
          g.busy = g.needKind !== 'toilet';
        } else if (!g.path) this.goWait(g);
        break;
      case 'need':
        g.timer -= dt;
        if (g.timer <= 0) {
          if (g.needKind === 'drink') {
            g.thirst = 0;
            g.bladder = Math.min(100, g.bladder + 22);
            this.earn(15, 'vending', g.x, g.y);
          } else if (g.needKind === 'eat') {
            g.hunger = 0;
            g.hasWrapper = true;
            this.earn(25, 'vending', g.x, g.y);
          } else {
            g.bladder = 0;
          }
          g.patience = Math.min(100, g.patience + 8);
          this.goWait(g);
        }
        break;
      case 'leaving':
        if (arrived || !g.path) this.s.guests = this.s.guests.filter((x) => x !== g);
        break;
    }
  }

  private stormOut(g: Guest) {
    g.outcome = 'stormed';
    this.s.stats.stormed++;
    this.changeRep(-3);
    this.say(g, '😤', 8);
    this.emit({ type: 'float', text: 'Fed up!', x: g.x, y: g.y, kind: 'bad' });
    this.tipOnce(
      'stormed',
      'A guest ran out of patience and left. Benches, tea, plants and shorter lines all help.',
      'bad',
    );
    this.leave(g);
  }

  private leave(g: Guest) {
    this.release(g);
    this.removeFromStations(g);
    g.goal = 'leave';
    g.state = 'leaving';
    const [x, y] = this.streetTile();
    if (!this.goTo(g, x, y)) this.s.guests = this.s.guests.filter((q) => q !== g);
  }

  // ---- Staff ---------------------------------------------------------------
  hire(candidateId: number): Staff | null {
    const s = this.s;
    const c = s.candidates.find((x) => x.id === candidateId);
    if (!c) return null;
    const [x, y] = this.streetTile();
    const st: Staff = {
      ...this.baseChar(c.name, c.look, x, y),
      kind: 'staff',
      role: c.role,
      skill: c.skill,
      salary: c.salary,
      traits: c.traits,
      energy: 100,
      state: 'arriving',
      post: 0,
      job: null,
      served: 0,
      quals: [...c.quals],
      training: null,
      strain: 1,
      morale: 75,
      raiseAsked: false,
      unhappyT: 0,
    };
    const [lx, ly] = this.lobbyTile();
    if (!this.goTo(st, lx, ly)) return null;
    s.staff.push(st);
    s.candidates = s.candidates.filter((x) => x !== c);
    s.candidates.push(makeCandidate(s, c.role));
    this.emit({ type: 'sfx', name: 'hire' });
    this.toast(`${c.name} joins as a ${ROLES[c.role].name}.`, 'good');
    return st;
  }

  /** Send a member of staff home for good, either fired or because they quit. */
  fire(id: number, quit = false) {
    const st = this.staff(id);
    if (!st || st.state === 'leaving') return;
    this.staffIdle(st);
    st.state = 'leaving';
    st.raiseAsked = false;
    this.say(st, quit ? '😠' : '📦', 6);
    const [x, y] = this.streetTile();
    if (!this.goTo(st, x, y)) this.s.staff = this.s.staff.filter((q) => q !== st);
    if (quit) {
      this.changeRep(-2);
      this.toast(`${st.name} has quit. Unhappy staff do not stay.`, 'bad');
      this.emit({ type: 'sfx', name: 'fail' });
    } else this.toast(`${st.name} has been let go.`, 'info');
  }

  /** What this member of staff could reasonably expect to be paid. */
  fairPay(st: Staff): number {
    return fairSalary(st.role, st.skill, st.traits, st.quals);
  }
  /** The salary a raise would take them to: the going rate, or 10% more if they already earn it. */
  raiseTo(st: Staff): number {
    return Math.max(this.fairPay(st), Math.round((st.salary * 1.1) / 10) * 10);
  }
  giveRaise(id: number) {
    const st = this.staff(id);
    if (!st || st.state === 'leaving') return;
    st.salary = this.raiseTo(st);
    st.morale = Math.min(100, st.morale + 22);
    st.raiseAsked = false;
    st.unhappyT = 0;
    this.say(st, '😊', 4);
    this.emit({ type: 'sfx', name: 'cash' });
  }

  private updateMorale(st: Staff, dt: number) {
    if (st.state === 'leaving' || st.state === 'arriving') return;
    const fair = this.fairPay(st);
    let target = 62 + clamp((st.salary / fair - 1) * 90, -45, 20);
    if (st.energy < 20) target -= 18;
    const post = this.world.item(st.post);
    const room = post && st.state === 'atPost' ? this.world.roomOfItem(post) : undefined;
    if (room) target += (this.prestige(room) - 2) * 5;
    if (this.s.litter.length > 6) target -= 6;
    st.morale = clamp(st.morale + (target - st.morale) * Math.min(1, dt * 0.03), 0, 100);

    if (!st.raiseAsked && st.salary < fair * 0.97 && st.morale < 56) {
      st.raiseAsked = true;
      this.say(st, '💰', 5);
      this.toast(`${st.name} thinks they are worth ${money(fair)} a month and wants a raise.`, 'info');
    }
    const before = st.unhappyT;
    if (st.morale < 25) st.unhappyT += dt;
    else st.unhappyT = Math.max(0, st.unhappyT - dt);
    if (before < 20 && st.unhappyT >= 20) {
      this.say(st, '😠', 6);
      this.toast(`${st.name} is miserable and thinking of quitting.`, 'bad');
    }
    if (st.unhappyT > 60 && !st.busy && !st.training) this.fire(st.id, true);
  }

  private leavePost(st: Staff) {
    const it = this.world.item(st.post);
    if (it?.staffId === st.id) it.staffId = 0;
    st.post = 0;
    st.busy = false;
  }
  private dropJob(st: Staff) {
    const job = st.job;
    if (!job) return;
    const claimed = job.kind === 'litter' ? this.s.litter.find((x) => x.id === job.id) : this.world.item(job.id);
    if (claimed?.claimedBy === st.id) claimed.claimedBy = 0;
    st.job = null;
  }
  private staffIdle(st: Staff) {
    if (st.training) {
      // interrupted before finishing: the course fee comes back
      this.s.money += st.training.cost;
      this.s.ledger.training -= st.training.cost;
      st.training = null;
    }
    this.leavePost(st);
    this.release(st);
    this.dropJob(st);
    this.halt(st);
    st.state = 'idle';
    st.timer = 0.2;
  }

  private tryBreak(st: Staff): boolean {
    const sofa = this.findAccess('rest', st.tx, st.ty);
    if (!sofa) return false;
    this.leavePost(st);
    this.dropJob(st);
    this.claim(st, sofa.item, sofa.idx);
    const [x, y] = accessTile(sofa.item, sofa.idx);
    if (!this.goTo(st, x, y, accessPose(sofa.item, sofa.idx))) {
      this.release(st);
      return false;
    }
    st.state = 'toBreak';
    this.say(st, '😴');
    return true;
  }

  private findWork(st: Staff) {
    if (st.energy < 18 && this.tryBreak(st)) return;
    const s = this.s;
    if (st.role === 'caretaker') {
      // broken equipment first, then litter, then routine watering and servicing
      interface Task {
        kind: 'litter' | 'water' | 'repair';
        id: number;
        x: number;
        y: number;
        urgency: number;
      }
      const tasks: Task[] = [];
      for (const l of s.litter) if (!l.claimedBy) tasks.push({ kind: 'litter', id: l.id, x: l.x, y: l.y, urgency: 1 });
      for (const p of s.items) {
        if (p.claimedBy) continue;
        if (p.wear >= WEAR_REPAIR)
          tasks.push({ kind: 'repair', id: p.id, x: p.x, y: p.y, urgency: p.wear >= 100 ? 2 : 0 });
        else if ((p.type === 'plant' && p.water <= 40) || (p.type === 'stone_warmer' && p.water <= 55))
          tasks.push({ kind: 'water', id: p.id, x: p.x, y: p.y, urgency: 0 });
      }
      const dist = (t: Task) => Math.hypot(t.x - st.tx, t.y - st.ty);
      tasks.sort((a, b) => b.urgency - a.urgency || dist(a) - dist(b));
      for (const task of tasks.slice(0, 4)) {
        let ok = false;
        if (task.kind === 'litter') ok = this.goTo(st, task.x, task.y);
        else {
          // stand next to the item, on whichever side can be reached
          const item = must(this.world.item(task.id), 'item to tend');
          search: for (const [fx, fy] of footprint(item)) {
            for (const [dx, dy] of BESIDE) {
              if (this.world.walkable(fx + dx, fy + dy) && this.goTo(st, fx + dx, fy + dy)) {
                ok = true;
                break search;
              }
            }
          }
        }
        if (!ok) continue;
        st.job = { kind: task.kind, id: task.id };
        const target = task.kind === 'litter' ? s.litter.find((l) => l.id === task.id) : this.world.item(task.id);
        if (target) target.claimedBy = st.id;
        st.state = 'toJob';
        return;
      }
    } else {
      let best: Item | null = null;
      let bestScore = -1e9;
      for (const it of s.items) {
        const def = ITEMS[it.type].station;
        if (def?.staff !== st.role || it.staffId || !this.world.usable(it)) continue;
        let score = it.queue.length * 10 - Math.hypot(it.x - st.tx, it.y - st.ty);
        if (def.goal === 'treat') {
          for (const id of it.queue) {
            const q = this.guest(id);
            if (q && !this.deliveryProblem(it, st, this.modalityOf(q))) score += 8;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = it;
        }
      }
      if (best) {
        const ai = this.accessIndex(best, 'staff');
        const [x, y] = accessTile(best, ai);
        if (this.goTo(st, x, y, accessPose(best, ai))) {
          best.staffId = st.id;
          st.post = best.id;
          st.state = 'toPost';
          return;
        }
      }
    }
    // nothing to do: amble about
    if (st.state === 'idle' && random() < 0.25) {
      const spots = this.world.standSpots(st.tx, st.ty, 40);
      if (spots.length) {
        const [x, y] = pick(spots);
        if (this.goTo(st, x, y)) st.state = 'wander';
      }
    }
  }

  private updateStaff(st: Staff, dt: number) {
    if (st.bubbleT > 0) st.bubbleT -= dt;
    let walk = 2.3;
    let stamina = 1;
    for (const t of st.traits) {
      walk *= traitOf(t).walk ?? 1;
      stamina *= traitOf(t).stamina ?? 1;
    }
    if (st.energy < 15) walk *= 0.75;
    const arrived = this.move(st, dt, walk);

    this.updateMorale(st, dt);
    if (st.state === 'leaving' && !this.s.staff.includes(st)) return;
    if (st.state === 'onBreak') st.energy = Math.min(100, st.energy + dt * 9);
    else if (st.state !== 'leaving' && st.state !== 'training') {
      const rate = st.busy ? 0.42 * (st.strain || 1) : st.state === 'atPost' ? 0.14 : 0.2;
      st.energy = Math.max(0, st.energy - rate * stamina * dt);
    }

    switch (st.state) {
      case 'arriving':
        if (arrived || !st.path) {
          st.state = 'idle';
          st.timer = 0;
        }
        break;
      case 'idle':
      case 'wander':
        if (st.state === 'wander' && (arrived || !st.path)) st.state = 'idle';
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = 0.7;
          this.findWork(st);
        }
        break;
      case 'toPost': {
        const it = this.world.item(st.post);
        if (it?.staffId !== st.id) this.staffIdle(st);
        else if (arrived) st.state = 'atPost';
        else if (!st.path) this.staffIdle(st);
        break;
      }
      case 'atPost': {
        const it = this.world.item(st.post);
        if (it?.staffId !== st.id || !this.world.usable(it)) this.staffIdle(st);
        else if (st.energy < 18 && !it.serving) {
          st.timer -= dt;
          if (st.timer <= 0) {
            st.timer = 2;
            if (!this.tryBreak(st))
              this.tipOnce(
                'tired',
                'Tired staff members work slowly and botch treatments. Build a Staff Room so they can rest.',
                'bad',
              );
          }
        }
        break;
      }
      case 'toBreak':
        if (arrived) st.state = 'onBreak';
        else if (!st.path) this.staffIdle(st);
        break;
      case 'onBreak':
        if (st.energy >= 100 || !st.claimItem) this.staffIdle(st);
        break;
      case 'toJob':
        if (arrived) {
          st.state = 'doingJob';
          st.timer = st.job?.kind === 'repair' ? 3.2 : 1.6;
          st.busy = true;
          if (st.job && st.job.kind !== 'litter') {
            const p = this.world.item(st.job.id);
            if (p) st.facing = Math.atan2(p.x + 0.5 - st.x, p.y + 0.5 - st.y);
          }
        } else if (!st.path) this.staffIdle(st);
        break;
      case 'doingJob':
        st.timer -= dt;
        if (st.timer <= 0) {
          const job = st.job;
          if (job?.kind === 'litter') this.s.litter = this.s.litter.filter((l) => l.id !== job.id);
          else if (job) {
            const p = this.world.item(job.id);
            if (p) {
              if (job.kind === 'repair') p.wear = 0;
              else p.water = 100;
              p.claimedBy = 0;
              if (job.kind === 'repair') this.world.version++;
            }
          }
          st.job = null;
          this.staffIdle(st);
        }
        break;
      case 'toTrain':
        if (arrived) st.state = 'training';
        else if (!st.path) this.staffIdle(st);
        break;
      case 'training': {
        const t = st.training;
        if (!t || !st.claimItem) {
          this.staffIdle(st);
          break;
        }
        t.progress += dt / t.seconds;
        if (t.progress >= 1) this.graduate(st);
        break;
      }
      case 'leaving':
        if (arrived || !st.path) this.s.staff = this.s.staff.filter((x) => x !== st);
        break;
    }
  }

  // ---- Upkeep ----------------------------------------------------------------
  private addWear(it: Item) {
    const add = ITEMS[it.type].wear ?? 0;
    if (!add || it.wear >= 100) return;
    it.wear = Math.min(100, it.wear + add);
    if (it.wear < 100) return;
    // broken: nobody can use it until a Janitor has been
    this.world.version++;
    const [cx, cy] = itemCenter(it);
    this.emit({ type: 'float', text: 'Broken!', x: cx, y: cy, kind: 'bad' });
    this.emit({ type: 'sfx', name: 'fail' });
    this.toast(`A ${ITEMS[it.type].name} has broken down. It is out of action until a Janitor repairs it.`, 'bad');
  }

  // ---- Loans & prices --------------------------------------------------------
  borrow(): boolean {
    const s = this.s;
    if (s.loan + LOAN_STEP > LOAN_MAX) return false;
    s.loan += LOAN_STEP;
    s.money += LOAN_STEP;
    this.emit({ type: 'sfx', name: 'cash' });
    return true;
  }
  repay(): boolean {
    const s = this.s;
    const amount = Math.min(LOAN_STEP, s.loan, Math.max(0, s.money));
    if (amount <= 0) return false;
    s.loan -= amount;
    s.money -= amount;
    this.emit({ type: 'sfx', name: 'sell' });
    return true;
  }
  setPrice(level: number) {
    this.s.priceLevel = clamp(Math.round(level * 10) / 10, PRICE_MIN, PRICE_MAX);
  }

  // ---- Emergencies -----------------------------------------------------------
  private updateEmergency() {
    const s = this.s;
    if (s.offer && s.day >= s.offer.deadline) this.declineEmergency();
    const e = s.emergency;
    if (e) {
      // arrivals trickle in, one a second
      if (e.pending > 0) {
        this.spawnGuest(e.condition, true);
        e.pending--;
      }
      const stillHere = s.guests.some((g) => g.emergency);
      if (e.healed >= e.target || s.day >= e.deadline || (e.pending === 0 && !stillHere)) this.endEmergency();
    } else if (!s.offer && s.open && s.stars >= 1 && s.day >= s.nextEmergency) this.offerEmergency();
  }

  /** Put an emergency on the table. Only conditions someone on the payroll can treat are offered. */
  offerEmergency(): boolean {
    const s = this.s;
    if (s.offer || s.emergency) return false;
    const staff = s.staff.filter((x) => x.state !== 'leaving');
    const pool = CONDITIONS.filter(
      (c) =>
        this.unlocked(c.modality) &&
        this.offered(MODALITIES[c.modality].discipline) &&
        staff.some((t) => t.quals.includes(c.modality)),
    );
    if (!pool.length) {
      s.nextEmergency = s.day + 20;
      return false;
    }
    const cond = pick(pool);
    const total = irnd(4, 5 + s.stars * 2);
    s.offer = {
      condition: cond.id,
      cause: pick(EMERGENCY_CAUSES),
      total,
      target: Math.ceil(total * 0.6),
      healed: 0,
      pending: 0,
      reward: Math.round((total * cond.fee * 0.7) / 100) * 100,
      deadline: s.day + 8,
    };
    this.emit({ type: 'announce', text: `Emergency incoming! ${s.offer.cause}` });
    return true;
  }
  acceptEmergency() {
    const s = this.s;
    const e = s.offer;
    if (!e) return;
    s.offer = null;
    e.deadline = s.day + 25;
    e.pending = e.total;
    e.healed = 0;
    s.emergency = e;
    this.emit({ type: 'sfx', name: 'place' });
  }
  declineEmergency() {
    this.s.offer = null;
    this.s.nextEmergency = this.s.day + rnd(45, 75);
  }
  private endEmergency() {
    const s = this.s;
    const e = s.emergency;
    if (!e) return;
    const name = conditionOf(e.condition).name;
    if (e.healed >= e.target) {
      s.money += e.reward;
      s.ledger.bonus += e.reward;
      this.changeRep(4);
      this.toast(`Emergency handled: ${e.healed} cases of ${name} healed. ${money(e.reward)} bonus.`, 'good');
      this.emit({ type: 'sfx', name: 'fanfare' });
    } else {
      this.changeRep(-4);
      this.toast(`Emergency failed: only ${e.healed} of the ${e.target} needed cases of ${name} were healed.`, 'bad');
      this.emit({ type: 'sfx', name: 'fail' });
    }
    for (const g of s.guests) g.emergency = false;
    s.emergency = null;
    s.nextEmergency = s.day + rnd(50, 80);
  }

  // ---- Training ------------------------------------------------------------
  /** Courses this member of staff could take right now. */
  courses(st: Staff): Course[] {
    const out: Course[] = [];
    const discipline = ROLES[st.role].discipline;
    if (discipline) {
      for (const m of MODALITY_ORDER) {
        const def = MODALITIES[m];
        if (def.discipline !== discipline || st.quals.includes(m) || !this.unlocked(m)) continue;
        out.push({
          id: m,
          name: modalityLabel(m),
          icon: def.icon,
          desc: def.desc,
          cost: def.trainCost,
          days: def.trainDays,
        });
      }
    }
    if (st.skill < 5)
      out.push({
        id: 'skill',
        name: `Skill level ${st.skill + 1}`,
        icon: '⭐',
        desc: 'General professional development. Faster and more reliable at everything.',
        cost: 600 + st.skill * 700,
        days: 5 + st.skill * 2,
      });
    return out;
  }

  /** Why training cannot start ('' when it can). */
  trainBlocker(st: Staff, course: Course): string {
    if (st.state === 'leaving') return 'They are leaving.';
    if (st.training) return 'Already on a course.';
    if (!this.hasRoom('training')) return 'Build a Training Room first.';
    if (!this.findAccess('study', st.tx, st.ty)) return 'Every Study Desk is taken. Add another.';
    if (this.s.money < course.cost) return 'Not enough money.';
    return '';
  }

  train(staffId: number, courseId: string): boolean {
    const st = this.staff(staffId);
    const course = st && this.courses(st).find((c) => c.id === courseId);
    if (!st || !course || this.trainBlocker(st, course)) {
      this.emit({ type: 'sfx', name: 'error' });
      return false;
    }
    const desk = this.findAccess('study', st.tx, st.ty);
    if (!desk) return false;
    this.staffIdle(st);
    this.claim(st, desk.item, desk.idx);
    const [x, y] = accessTile(desk.item, desk.idx);
    if (!this.goTo(st, x, y, accessPose(desk.item, desk.idx))) {
      this.release(st);
      this.emit({ type: 'sfx', name: 'error' });
      return false;
    }
    this.spend(course.cost, 'training');
    st.training = { course: course.id, progress: 0, seconds: course.days * DAY_SECONDS, cost: course.cost };
    st.state = 'toTrain';
    this.say(st, '📚', 3);
    this.emit({ type: 'sfx', name: 'place' });
    this.toast(`${st.name} is off to study ${course.name}.`, 'info');
    return true;
  }

  private graduate(st: Staff) {
    const t = st.training;
    if (!t) return;
    let what: string;
    if (t.course === 'skill') {
      st.skill = Math.min(5, st.skill + 1);
      what = `reached skill level ${st.skill}`;
    } else {
      const m = t.course as Modality;
      if (!st.quals.includes(m)) st.quals.push(m);
      what = `is now qualified in ${modalityLabel(m)}`;
    }
    st.training = null;
    this.staffIdle(st);
    this.say(st, '🎓', 5);
    // being worth more now, they will soon ask to be paid more
    this.toast(`${st.name} ${what}.`, 'good');
    this.emit({ type: 'sfx', name: 'build' });
  }

  // ---- Building ------------------------------------------------------------
  private worldChanged() {
    this.world.rebuild();
    this.repathAll();
  }

  placeItem(
    type: ItemType,
    x: number,
    y: number,
    rot: number,
    opts: { free?: boolean; roomId?: number } = {},
  ): Item | null {
    const def = ITEMS[type];
    if (!this.world.canPlaceItem(type, x, y, rot, opts.roomId).ok) return null;
    if (!opts.free && this.s.money < def.cost) {
      this.toast(`Not enough money for a ${def.name}.`, 'bad');
      this.emit({ type: 'sfx', name: 'error' });
      return null;
    }
    const it: Item = {
      id: this.s.nextId++,
      type,
      x,
      y,
      rot,
      users: def.access.map(() => 0),
      queue: [],
      serving: 0,
      staffId: 0,
      progress: 0,
      water: 100,
      wear: 0,
      claimedBy: 0,
    };
    this.s.items.push(it);
    if (!opts.free) this.spend(def.cost, 'building');
    this.worldChanged();
    this.emit({ type: 'sfx', name: 'place' });
    return it;
  }

  createRoom(type: RoomType, r: Rect, door: Room['door']): Room {
    const room: Room = { id: this.s.nextId++, type, x: r.x, y: r.y, w: r.w, h: r.h, door, windows: [], done: false };
    this.s.rooms.push(room);
    this.worldChanged();
    this.emit({ type: 'sfx', name: 'place' });
    return room;
  }

  finishRoom(room: Room) {
    room.done = true;
    this.spend(ROOMS[room.type].cost, 'building');
    this.world.version++;
    this.toast(`${ROOMS[room.type].name} built!`, 'good');
    this.emit({ type: 'sfx', name: 'build' });
  }

  private itemsInRoom(room: Room) {
    return this.s.items.filter((it) => this.world.zoneAt(it.x, it.y) === room.id);
  }

  /** Can this item be picked up and put down here instead? */
  canMoveItem(it: Item, x: number, y: number, rot: number) {
    const zone = this.world.zoneAt(it.x, it.y);
    const at = this.s.items.indexOf(it);
    // judge the new spot as if the item had already been lifted out
    this.s.items.splice(at, 1);
    this.world.rebuild(true);
    const check = this.world.canPlaceItem(it.type, x, y, rot, zone > 0 ? zone : undefined);
    this.s.items.splice(at, 0, it);
    this.world.rebuild(true);
    return check;
  }

  /** Move an item for free. Furniture that belongs to a room has to stay in that room. */
  moveItem(id: number, x: number, y: number, rot: number): boolean {
    const it = this.world.item(id);
    if (!it || !this.canMoveItem(it, x, y, rot).ok) return false;
    const users = this.usersOf(new Set([id]));
    it.x = x;
    it.y = y;
    it.rot = rot;
    this.world.rebuild();
    this.resetUsers(users);
    this.emit({ type: 'sfx', name: 'place' });
    return true;
  }

  private usersOf(ids: Set<number>) {
    return {
      guests: this.s.guests.filter((g) => ids.has(g.claimItem) || ids.has(g.station)),
      staff: this.s.staff.filter(
        (st) =>
          ids.has(st.post) || ids.has(st.claimItem) || (!!st.job && st.job.kind !== 'litter' && ids.has(st.job.id)),
      ),
    };
  }
  private resetUsers({ guests, staff }: { guests: Guest[]; staff: Staff[] }) {
    for (const g of guests) {
      this.release(g);
      this.resetGuest(g);
    }
    for (const st of staff) {
      this.release(st);
      if (st.state !== 'leaving') this.staffIdle(st);
    }
    for (const it of this.s.items) {
      it.users = it.users.map((u) => (this.char(u) ? u : 0));
    }
    this.repathAll();
  }

  /** Remove items and patch up anyone who was using them. */
  private removeItems(gone: Item[]) {
    const ids = new Set(gone.map((i) => i.id));
    const users = this.usersOf(ids);
    this.s.items = this.s.items.filter((i) => !ids.has(i.id));
    this.world.rebuild();
    for (const g of users.guests) g.claimItem = 0;
    for (const st of users.staff) {
      st.claimItem = 0;
      if (st.job && st.job.kind !== 'litter') st.job = null;
    }
    this.resetUsers(users);
  }

  /** Remove a room. `refund` is the fraction of its cost returned (0 while still a blueprint). */
  removeRoom(roomId: number, refund: number) {
    const room = this.world.room(roomId);
    if (!room) return;
    const items = this.itemsInRoom(room);
    // a blueprint has not been paid for yet, but any extras bought for it have
    let back = room.done ? ROOMS[room.type].cost * refund : 0;
    for (const it of items) back += ITEMS[it.type].cost * refund;
    back += room.windows.length * WINDOW_COST * refund;
    this.s.rooms = this.s.rooms.filter((r) => r !== room);
    this.removeItems(items);
    if (back > 0) {
      this.s.money += back;
      this.s.ledger.building -= back;
      if (room.done) this.toast(`${ROOMS[room.type].name} demolished. ${money(back)} recovered.`, 'info');
      this.emit({ type: 'sfx', name: 'sell' });
    }
  }

  /** Required furniture a room still lacks, in the order it is asked for. */
  missingItems(room: Room): ItemType[] {
    const have = this.itemsInRoom(room).map((i) => i.type);
    const missing: ItemType[] = [];
    for (const type of ROOMS[room.type].required) {
      const at = have.indexOf(type);
      if (at >= 0) have.splice(at, 1);
      else missing.push(type);
    }
    return missing;
  }

  /**
   * Add a window to a stretch of wall, or take out the one already there.
   * Returns what happened, or '' if it could not be done.
   */
  toggleWindow(roomId: number, spot: WallSpot): 'added' | 'removed' | '' {
    const room = this.world.room(roomId);
    if (!room) return '';
    const at = room.windows.findIndex((w) => sameSpot(w, spot));
    if (at >= 0) {
      room.windows.splice(at, 1);
      // a blueprint's windows come back in full; a built room's at half, like everything else
      const back = Math.round(WINDOW_COST * (room.done ? 0.5 : 1));
      this.s.money += back;
      this.s.ledger.building -= back;
      this.world.version++;
      this.emit({ type: 'sfx', name: 'sell' });
      return 'removed';
    }
    if (!this.world.windowValid(room, spot).ok) return '';
    if (this.s.money < WINDOW_COST) {
      this.toast('Not enough money for a window.', 'bad');
      this.emit({ type: 'sfx', name: 'error' });
      return '';
    }
    room.windows.push({ ...spot });
    this.spend(WINDOW_COST, 'building');
    this.world.version++;
    this.emit({ type: 'sfx', name: 'place' });
    return 'added';
  }

  /** Move a room's door to another stretch of its wall, for free. */
  moveDoor(roomId: number, door: WallSpot): boolean {
    const room = this.world.room(roomId);
    if (!room || sameSpot(room.door, door)) return false;
    if (!this.world.doorValid(room.type, room, door, room).ok) return false;
    room.door = { ...door };
    this.worldChanged();
    this.emit({ type: 'sfx', name: 'place' });
    return true;
  }

  canSell(it: Item): boolean {
    const room = this.world.roomOfItem(it);
    if (!room) return true;
    const def = ROOMS[room.type];
    if (!def.required.includes(it.type)) return true;
    return this.itemsInRoom(room).filter((o) => o.type === it.type).length > 1;
  }

  sellItem(id: number) {
    const it = this.world.item(id);
    if (!it || !this.canSell(it)) return;
    const back = Math.round(ITEMS[it.type].cost * 0.5);
    this.removeItems([it]);
    this.s.money += back;
    this.s.ledger.building -= back;
    this.emit({ type: 'sfx', name: 'sell' });
    const [cx, cy] = itemCenter(it);
    if (back > 0) this.emit({ type: 'float', text: `+${money(back)}`, x: cx, y: cy, kind: 'good' });
  }

  /** Tiles a blueprint's footprint covers, for the build overlay. */
  footprintOf(type: ItemType, x: number, y: number, rot: number) {
    return footprint({ type, x, y, rot });
  }
}

export function netOf(l: Ledger) {
  return l.consult + l.treatment + l.vending + l.bonus - l.salaries - l.building - l.training - l.interest;
}
