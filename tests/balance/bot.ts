// A playtest bot: plays a center the way a good player would, so the pace of the campaign can be measured rather than
// guessed. It builds the opening rooms, staffs them, adds comforts and decor, trains staff in what each star unlocks,
// gives raises when asked, and takes on emergencies. On top of that, each of which can be switched off (`BotFlags`)
// to compare with the bot as it was: it sets prices by how many guests they put off, buys marketing when it pays,
// lets practitioners go when they are not needed, saves toward a money goal, builds on the profit a room is expected
// to make, takes house calls, and evens out lines. And as a good player also does: it upgrades the equipment, takes
// on only the emergencies it can see through, lays rooms out for their kit and dresses them with windows first, fills
// a Sound Bath Studio's mats, runs Qi Gong classes and picks courses by what guests need. Some things it can also do
// were measured and found to gain nothing, and are extras switched on with `BOT_ON` (see `BOT_EXTRAS`).

import { itemOpen } from '../../src/core/campaign';
import {
  type CampaignKind,
  type CenterId,
  CENTERS,
  CLASS_DAYS,
  conditionHere,
  type ConditionId,
  conditionOf,
  CONDITIONS,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  type Difficulty,
  type Discipline,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  EMERGENCY_DAYS,
  type GoalSpec,
  ITEMS,
  type ItemType,
  LOAN_STEP,
  MODALITIES,
  type Modality,
  NOISE_NOTICE,
  type Role,
  ROOMS,
  type RoomType,
  SIDEWALK_Y,
  WINDOW_COST,
  WINDOW_MAX_BONUS,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { loanLimit, wagesDue } from '../../src/core/sim/economy';
import { matsPlayed } from '../../src/core/sim/sessions';
import { Sim } from '../../src/core/sim/sim';
import { seasonOf } from '../../src/core/sim/twists';
import { upgradeCost } from '../../src/core/sim/upgrades';
import { worsenRate } from '../../src/core/sim/worsening';
import { disciplineOn, newGame, offeringOn, unlockedUpTo } from '../../src/core/state/game';
import type { Emergency, GameState, Guest, Item, Room, Staff, WallSpot } from '../../src/core/state/types';
import { footprint, onWall, type Rect } from '../../src/core/world';

/** What the bot does beyond building, staffing and training as it always has. */
export const BOT_FLAGS = [
  /** Set the price level by how many guests it puts off, and charge more where a line runs long. */
  'prices',
  /** Buy word of mouth, a condition in the spotlight or a recruitment drive when it pays. */
  'marketing',
  /** Let practitioners go who are not needed, and take them back on when they are. */
  'payroll',
  /** Save toward an open money goal: no decor, land or rooms that do not pay for themselves soon. */
  'saving',
  /** Build treatment rooms on the profit they are expected to make, looking ahead to the season. */
  'expansion',
  /** Take house calls when someone can be spared. */
  'calls',
  /** Move guests to a shorter line, and stagger breaks so a station is not left empty. */
  'lines',
  /** Hire the cheapest Consultant going rather than the best: a junior one, who often needs a second look. */
  'junior',
  /** Build a Posture Lab when the consultants send many guests back for a second look: junior, or a long line. */
  'lab',
  /**
   * Never put furniture down where someone stands, and free anyone walled in by selling what boxes them in. An extra
   * since the game itself stopped anything walling anyone in: it made no difference that could be told from the seeds.
   */
  'clear',
  /** Train a Caretaker in Mechanics and upgrade the treatment equipment; a chart on the wall; a Recliner for each. */
  'kit',
  /** Take on only the emergencies the staff can see through in time, and put their guests first while one runs. */
  'emergencies',
  /**
   * Take on stress outbreaks and calm the guests seen sweating; have a Shaman ward off a mishap. An extra: it made no
   * difference that could be told from the seeds.
   */
  'trouble',
  /** Treatment rooms big enough for all their equipment, windows and space-saving decor first, decor sold for kit. */
  'layout',
  /** As many mats in a Sound Bath Studio as the healer plays for. */
  'mats',
  /**
   * A Qi Gong Studio once it opens, with an Instructor, as many Practice Spots as they can lead, classes every
   * weekday, and more Shop Counters for the crowd let out. Classes cost the center more than they brought in until
   * the rules for booking them changed (balance log, 24).
   */
  'classes',
  /** Courses for the techniques guests come for most, that nobody else on the staff covers yet. */
  'courses',
  /**
   * Move a guest who would get worse before their turn up their line, past guests who can spare the wait. An extra:
   * it cost more patience than it saved.
   */
  'triage',
] as const;
export type BotFlag = (typeof BOT_FLAGS)[number];
export type BotFlags = Record<BotFlag, boolean>;
/**
 * Flags that are off unless `BOT_ON` names them: a different way to play rather than better play, or play that was
 * measured and found to gain nothing.
 */
const BOT_EXTRAS: readonly BotFlag[] = ['junior', 'lab', 'clear', 'trouble', 'triage'];

/**
 * The bot's flags from the environment. `BOT=old` plays as the bot did before it learned any of them; `BOT_OFF`
 * switches some off (`BOT_OFF=prices,calls`), and `BOT_ON` switches some on for the old bot, or the extras
 * (`BOT_ON=junior,lab`), which are off unless named.
 */
export function botFlags(env: Record<string, string | undefined> = process.env): BotFlags {
  /** The flags named in a comma-separated list, refusing any the bot does not know. */
  const list = (v: string | undefined) => {
    const names = (v ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const unknown = names.filter((x) => !(BOT_FLAGS as readonly string[]).includes(x));
    if (unknown.length) throw new Error(`Unknown bot flag ${unknown.join(', ')}: use ${BOT_FLAGS.join(', ')}`);
    return new Set(names);
  };
  const all = (env.BOT ?? 'new') !== 'old';
  const off = list(env.BOT_OFF);
  const on = list(env.BOT_ON);
  return Object.fromEntries(
    BOT_FLAGS.map((f) => [f, (all && !BOT_EXTRAS.includes(f) && !off.has(f)) || on.has(f)]),
  ) as BotFlags;
}

/** The highest price level the bot sets, and the most it adds on top for a discipline whose line runs long. */
const PRICE_TOP = 1.4;
const PREMIUM_TOP = 1.3;
/** The share of guests put off by prices the bot aims for: a little under it, it charges more; well over, less. */
const PUT_OFF = 0.1;
/** The share of the time a discipline's staffed tables are kept busy that the bot staffs for. */
const BUSY_TARGET = 0.7;

/** What the bot sees over a month: lines and busy tables by discipline, sampled, and the casebook at its start. */
interface Watch {
  days: number;
  line: Partial<Record<Discipline, number>>;
  staffed: Partial<Record<Discipline, number>>;
  busy: Partial<Record<Discipline, number>>;
  /** Guests who gave up waiting for a discipline's treatment, or got worse waiting for it and left. */
  lost: Partial<Record<Discipline, number>>;
  casebook: GameState['casebook'];
}

/** What the bot saw of one discipline over the month just ended. */
interface DisciplineMonth {
  /** Guests waiting for its treatment, on average. */
  line: number;
  /** The share of its staffed tables' time spent treating someone, or null if none were staffed. */
  busy: number | null;
  /** Guests who gave up waiting for its treatment or got worse and left, those healed, and those treated in all. */
  lost: number;
  healed: number;
  treated: number;
}

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
  /** The price level at the month's end. */
  price: number;
  /** Whether there is a Posture Lab at the month's end, and the guests sent for a scan over the month. */
  lab: boolean;
  scans: number;
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
  qigong: [5, 5],
};

/** The chart that helps treatments in a room of each kind. */
const CHART_FOR: Partial<Record<RoomType, ItemType>> = {
  massage: 'meridian_poster',
  acupuncture: 'meridian_poster',
  reiki: 'chakra_chart',
  sound: 'chakra_chart',
};
/** Decor to dress a treatment room with, the most prestige for the money and the floor first. */
const DRESS: readonly ItemType[] = [
  'landscape_painting',
  'tapestry',
  'prayer_flags',
  'rug',
  'salt_lamp',
  'diffuser',
  'statue',
  'plant',
];
/** Decor standing on a room's floor, the least prestige for the tile it takes first, to sell for equipment. */
const FLOOR_DECOR: readonly ItemType[] = ['plant', 'diffuser', 'salt_lamp', 'statue'];

/** What the bot expects its first payroll to come to, before it has hired everyone. */
const FIRST_PAYROLL = 20000;

export class Bot {
  readonly sim: Sim;
  readonly s: GameState;
  readonly log: Playtest;
  private monthStart = { arrived: 0, healed: 0, failed: 0, stormed: 0, worse: 0, priced: 0 };

  /** Treatment rooms per type the bot has let the practitioner go from, which it leaves empty until they are needed. */
  private benched: Partial<Record<RoomType, number>> = {};
  /** What the bot sees over the month under way, and what it saw over the last, by discipline. */
  private watch: Watch;
  private seen: Partial<Record<Discipline, DisciplineMonth>> = {};
  /** Reputation when the bot last looked at its prices, and the month it last let anyone go. */
  private repAtReview = 0;
  private trimmedMonth = -1;
  /** The day the bot began waiting for a better applicant for a role. */
  private waitingToHire: Partial<Record<Role, number>> = {};
  /** The day until which the bot does not try again to fit a room of a type that did not fit. */
  private noFit: Partial<Record<RoomType, number>> = {};
  /** The discipline each guest in a treatment line is waiting for, as last seen. */
  private inLine = new Map<number, Discipline>();
  /** The guests seen sent for a posture scan, and how many of them this month. */
  private sentForScan = new Set<number>();
  private scans = 0;

  constructor(
    readonly center: CenterId,
    readonly seed = 1,
    difficulty: Difficulty = {},
    readonly flags: BotFlags = botFlags(),
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
    this.watch = this.freshWatch();
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
        // a payday the bank cannot cover is borrowed for, as the player would; a loan that is not there is bankruptcy
        if (this.s.payrollDue) {
          this.sim.takePayrollLoan();
          this.note(`day ${Math.floor(this.s.day)}: borrowed to make payday, loan now ${this.s.loan}`);
        }
        if (this.s.bankrupt) {
          this.note(`day ${Math.floor(this.s.day)}: BANKRUPT, loan ${this.s.loan}`);
          return false;
        }
        if (i % 10 === 0) {
          this.sampleTables();
          if (this.flags.trouble) this.calmCarriers();
        }
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
      price: s.priceLevel,
      lab: this.sim.hasRoom('assess'),
      scans: this.scans,
    });
    this.scans = 0;
    for (const id of this.sentForScan) if (!this.sim.guest(id)) this.sentForScan.delete(id);
    this.monthStart = {
      arrived: st.arrived,
      healed: st.healed,
      failed: st.failed,
      stormed: st.stormed,
      worse: st.worse,
      priced: st.priced,
    };
    this.seen = this.sumUp();
    this.watch = this.freshWatch();
    for (const id of this.inLine.keys()) if (!this.sim.guest(id)) this.inLine.delete(id);
    if (s.open) this.review();
  }

  /** At each month's end: prices, and marketing. */
  private review() {
    if (this.flags.prices) this.setPrices();
    if (this.flags.marketing) this.market();
    this.repAtReview = this.s.reputation;
  }

  // ---- prices, marketing, payroll, house calls and lines --------------------

  /**
   * The price level, a tenth at a time: up while fewer than one guest in ten is put off by it and reputation is
   * comfortable, down when more are or reputation is short of a goal or falling. On top, a discipline whose line runs
   * past three a room costs more, up to 30%, to put off the guests who would otherwise wait and walk out.
   */
  private setPrices() {
    const s = this.s;
    const last = s.months.at(-1);
    if (!last) return;
    const putOff = last.priced / Math.max(1, last.arrived);
    const wanted = Math.max(this.openGoal('reputation')?.percent ?? 0, 0);
    const falling = s.reputation < this.repAtReview - 4;
    let level = s.priceLevel;
    if (s.reputation < Math.max(wanted, 30) || putOff > PUT_OFF * 1.6 || (falling && s.reputation < 60)) level -= 0.1;
    else if (putOff < PUT_OFF && s.reputation >= Math.max(wanted, 45) && !falling) level += 0.1;
    level = Math.round(Math.min(PRICE_TOP, Math.max(1, level)) * 10) / 10;
    if (level !== s.priceLevel) {
      this.sim.setPrice(level);
      this.note(`day ${Math.floor(s.day)}: prices to ${level} (${Math.round(putOff * 100)}% put off)`);
    }
    for (const d of DISCIPLINE_ORDER) {
      const m = this.seen[d];
      const def = DISCIPLINES[d];
      const rooms = this.rooms(def.room).length - (this.benched[def.room] ?? 0);
      if (!m || rooms <= 0) continue;
      const mods = Object.values(MODALITIES).filter((x) => x.discipline === d);
      const first = mods[0];
      if (!first) continue;
      const now = s.prices[first.id] ?? 1;
      const perRoom = m.line / rooms;
      const own = perRoom > 3 ? now + 0.1 : perRoom < 1.5 ? now - 0.1 : now;
      const next = Math.round(Math.min(PREMIUM_TOP, Math.max(1, own)) * 10) / 10;
      if (next === now) continue;
      for (const x of mods) this.sim.setTechniquePrice(x.id, next);
      this.note(`day ${Math.floor(s.day)}: ${d} at ${next} (line ${perRoom.toFixed(1)} a room)`);
    }
  }

  /**
   * A month of marketing where it pays: word of mouth when a month of it (about 4 to 6 points) could carry
   * reputation to a goal, or while there is room for more guests; a condition in the spotlight for a goal that asks
   * for guests healed with one discipline while it has time to spare, or to send guests to an idle discipline from a
   * crowded one. A reputation far short of its goal is a matter of results, which word of mouth does not fix.
   */
  private market() {
    const s = this.s;
    const reserve = this.wages() * 0.5 + 2000;
    const saving = this.saving();
    const repGoal = this.openGoal('reputation');
    const lines = DISCIPLINE_ORDER.map((d) => ({ d, m: this.seen[d] })).filter(
      (x): x is { d: Discipline; m: DisciplineMonth } => !!x.m && x.m.busy !== null,
    );
    const idle = lines.length > 0 && lines.every((x) => (x.m.busy ?? 0) < 0.5 && x.m.lost === 0);
    const needRep =
      (!!repGoal && s.reputation < repGoal.percent + 2 && s.reputation >= repGoal.percent - 8) ||
      (idle && s.reputation < 60 && this.profit() > 0 && !saving);
    if (needRep && !this.running('word') && s.money > 3000 + reserve)
      this.campaign('word', `reputation ${Math.round(s.reputation)}`);
    if (this.running('condition') || saving || s.money < 2000 + reserve) return;
    // a goal for guests healed with one discipline, or an idle discipline while another turns guests away
    const goal = this.goals().find((g) => !g.done && g.spec.kind === 'healed' && g.spec.discipline)?.spec;
    let target = goal?.kind === 'healed' ? goal.discipline : undefined;
    if (target && (this.seen[target]?.busy ?? 1) >= 0.6) target = undefined;
    const crowded = lines.some((x) => x.m.lost >= 2);
    if (!target && crowded)
      target = lines.filter((x) => (x.m.busy ?? 1) < 0.4 && x.m.lost === 0).sort((a, b) => a.m.line - b.m.line)[0]?.d;
    if (!target) return;
    const cond = this.bestCondition(target);
    if (cond) this.campaign('condition', `for ${target}`, cond);
  }

  /** The condition of a discipline the staff are best set to heal: someone is trained in it, and it pays the most. */
  private bestCondition(d: Discipline): ConditionId | undefined {
    const role = DISCIPLINES[d].role;
    const staff = this.staffOf(role);
    return CONDITIONS.filter(
      (c) =>
        MODALITIES[c.modality].discipline === d &&
        conditionHere(c, this.s.center) &&
        this.sim.unlocked(c.modality) &&
        staff.some((st) => st.quals.includes(c.modality)),
    ).sort((a, b) => b.fee - a.fee)[0]?.id;
  }

  /**
   * Toward a month's end, before payday: let go a practitioner a discipline does not need, the one doing least for
   * their pay, when its tables were busy well under the time the bot staffs for and the month ahead is no busier.
   * Their room stands empty until it is wanted again. Never the last of a discipline, nor anyone on a course or call.
   */
  private trimPayroll() {
    const s = this.s;
    const month = Math.floor(s.day / DAYS_PER_MONTH);
    if (s.day - month * DAYS_PER_MONTH < DAYS_PER_MONTH - 3 || this.trimmedMonth === month) return;
    this.trimmedMonth = month;
    // judge by what this month has seen so far
    const now = this.sumUp();
    for (const d of DISCIPLINE_ORDER) {
      const def = DISCIPLINES[d];
      const m = now[d];
      const staff = this.staffOf(def.role);
      if (m?.busy === undefined || m.busy === null || staff.length < 2 || m.lost > 0) continue;
      const load = m.busy * staff.length * this.ahead();
      if (load > (staff.length - 1) * BUSY_TARGET * 0.8 || m.line / staff.length > 1) continue;
      const go = staff
        .filter((st) => !st.training && !st.call && st.state !== 'away')
        .sort((a, b) => a.skill - b.skill || b.salary - a.salary)[0];
      if (!go) continue;
      this.sim.fire(go.id);
      this.benched[def.room] = (this.benched[def.room] ?? 0) + 1;
      this.note(
        `day ${Math.floor(s.day)}: let a ${def.role} go (busy ${Math.round(m.busy * 100)}%), saving ${go.salary}`,
      );
    }
  }

  /**
   * A house call, if someone can go: the one it pays most for, provided someone else in the role stays at work or
   * the line for the discipline is short. Otherwise the offer waits a day.
   */
  private houseCall() {
    const s = this.s;
    const call = s.callOffer;
    if (!call) return;
    const role = DISCIPLINES[call.discipline].role;
    const atWork = this.staffOf(role).filter((st) => !st.training && !st.call);
    const who = this.sim
      .whoCanGo()
      .filter((st) => !st.training)
      .sort((a, b) => this.sim.callFee(b) - this.sim.callFee(a))[0];
    // with nobody else in the role, only while the line is short and no goal asks for short waits
    if (!who || (atWork.length < 2 && (this.waiting(role) > 2 || this.openGoal('patience')))) return;
    const fee = this.sim.callFee(who);
    if (this.sim.acceptCall(who.id)) this.note(`day ${Math.floor(s.day)}: house call, ${call.days} days for ${fee}`);
  }

  /**
   * Guests in a line with nobody at its station, or two or more longer than another of the same kind, move to the
   * shorter one; and in any role with two or more on the payroll, half at most take a break at once.
   */
  private evenLines() {
    for (const it of this.s.items) {
      if (!it.queue.length || !ITEMS[it.type].station) continue;
      const other = this.sim.shortestOtherLine(it);
      if (!other || !this.sim.stationStaff(other)) continue;
      const staffed = !!this.sim.stationStaff(it);
      while (it.queue.length && (staffed ? it.queue.length >= other.queue.length + 2 : other.queue.length < 3)) {
        const id = it.queue.at(-1);
        if (id === undefined || !this.sim.moveToStation(id, other.id)) break;
      }
    }
    const roles = new Map<Role, number>();
    for (const st of this.s.staff) if (st.state !== 'leaving') roles.set(st.role, (roles.get(st.role) ?? 0) + 1);
    for (const [role, n] of roles) {
      const limit = n >= 2 ? Math.max(1, Math.floor(n / 2)) : 0;
      if ((this.s.policy.breakLimit[role] ?? 0) !== limit) this.sim.setPolicy({ breakLimit: { role, limit } });
    }
  }

  // ---- what the bot keeps an eye on ----------------------------------------

  /** A new month's watch: nothing seen yet, and the casebook as it stands, to tell how the month's visits went. */
  private freshWatch(): Watch {
    return {
      days: 0,
      line: {},
      staffed: {},
      busy: {},
      lost: {},
      casebook: structuredClone(this.s.casebook),
    };
  }

  /**
   * Every so often: which treatment tables have someone at them and which of those are treating a guest, and who
   * has given up waiting for their treatment since the last look.
   */
  private sampleTables() {
    const w = this.watch;
    for (const g of this.s.guests) {
      if (g.goal === 'assess' && !this.sentForScan.has(g.id)) {
        this.sentForScan.add(g.id);
        this.scans++;
      }
      const was = this.inLine.get(g.id);
      if (!g.outcome) {
        if (g.goal === 'treat') this.inLine.set(g.id, this.sim.modalityOf(g).discipline);
        else this.inLine.delete(g.id);
      } else if (was) {
        if (g.outcome === 'stormed' || g.outcome === 'worse') w.lost[was] = (w.lost[was] ?? 0) + 1;
        this.inLine.delete(g.id);
      }
    }
    for (const it of this.s.items) {
      const d = ITEMS[it.type].station;
      if (d?.goal !== 'treat' || !d.discipline || !this.sim.stationStaff(it)) continue;
      w.staffed[d.discipline] = (w.staffed[d.discipline] ?? 0) + 1;
      if (this.sim.servedAt(it)) w.busy[d.discipline] = (w.busy[d.discipline] ?? 0) + 1;
    }
  }

  /** Once a day: how many wait for each discipline's treatment. */
  private sampleLines() {
    const w = this.watch;
    w.days++;
    for (const g of this.s.guests) {
      if (g.goal !== 'treat' || (g.state !== 'waiting' && g.state !== 'toWait')) continue;
      const d = this.sim.modalityOf(g).discipline;
      w.line[d] = (w.line[d] ?? 0) + 1;
    }
  }

  /** The month's watch, discipline by discipline. */
  private sumUp(): Partial<Record<Discipline, DisciplineMonth>> {
    const w = this.watch;
    const out: Partial<Record<Discipline, DisciplineMonth>> = {};
    for (const d of DISCIPLINE_ORDER) {
      const month: DisciplineMonth = {
        line: (w.line[d] ?? 0) / Math.max(1, w.days),
        busy: w.staffed[d] ? (w.busy[d] ?? 0) / w.staffed[d] : null,
        lost: w.lost[d] ?? 0,
        healed: 0,
        treated: 0,
      };
      for (const c of CONDITIONS) {
        if (MODALITIES[c.modality].discipline !== d) continue;
        const now = this.s.casebook[c.id];
        if (!now) continue;
        const was = w.casebook[c.id] ?? { healed: 0, failed: 0, stormed: 0, sent: 0, priced: 0, worse: 0 };
        month.healed += now.healed - was.healed;
        month.treated += now.healed - was.healed + now.failed - was.failed;
      }
      out[d] = month;
    }
    return out;
  }

  /** The goals for the next star, each with whether it is met. */
  private goals(): { spec: GoalSpec; done: boolean }[] {
    const specs = CENTERS[this.center].goals[this.s.stars] ?? [];
    const objectives = this.sim.objectives();
    return specs.map((spec, i) => ({ spec, done: objectives[i]?.done ?? false }));
  }

  /** The open goal of a kind for the next star, if there is one. */
  private openGoal<K extends GoalSpec['kind']>(kind: K): Extract<GoalSpec, { kind: K }> | undefined {
    return this.goals().find((g) => !g.done && g.spec.kind === kind)?.spec as Extract<GoalSpec, { kind: K }>;
  }

  /** How busy a season is against an ordinary one, for a center with seasons. */
  private seasonal(day: number): number {
    const seasons = CENTERS[this.center].seasons;
    if (!seasons) return 1;
    const season = seasonOf(day);
    return season === 'summer' ? seasons.summer : season === 'winter' ? seasons.winter : 1;
  }

  /** How much busier the coming months look than this one: the next, or the busiest of the next few. */
  private ahead(months = 1): number {
    const now = this.seasonal(this.s.day);
    let most = 0;
    for (let m = 1; m <= months; m++) most = Math.max(most, this.seasonal(this.s.day + m * DAYS_PER_MONTH));
    return most / now;
  }

  /** What a healed guest of a discipline pays, on average over the conditions guests can come with for it. */
  private feeFor(d: Discipline): number {
    const s = this.s;
    const conds = CONDITIONS.filter(
      (c) => MODALITIES[c.modality].discipline === d && conditionHere(c, s.center) && this.sim.unlocked(c.modality),
    );
    if (!conds.length) return 0;
    const picky = CENTERS[s.center].picky?.fee ?? 1;
    return (conds.reduce((a, c) => a + c.fee * this.sim.priceFor(c.modality), 0) / conds.length) * picky;
  }

  // ---- what the bot does each day -------------------------------------------

  /** Everything the bot looks at once a day. */
  private decide() {
    const s = this.s;
    if (this.flags.clear) this.freeTrapped();
    this.keepStaffHappy();
    this.handleEvents();
    this.manageLoan();
    if (!s.open) {
      this.buildOpening();
      return;
    }
    this.sampleLines();
    if (this.flags.lines) this.evenLines();
    if (this.flags.triage) this.triage();
    if (this.flags.payroll) this.trimPayroll();
    this.hireToFill();
    this.basics();
    this.unlocks();
    if (this.flags.kit) this.equip();
    this.train();
    this.grow();
    if (this.flags.classes) this.classes();
    if (this.flags.lab) this.buildLab();
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

  /**
   * Take on emergencies (with `emergencies`, only those the staff can see through, their guests first while one
   * runs), turn down outbreaks (with `trouble`, take them on unless an emergency is running) and house calls, prepare
   * for mishaps (with `trouble`, a Shaman's ward where there is one) and pay any fine.
   */
  private handleEvents() {
    const s = this.s;
    if (s.offer) {
      if (!this.flags.emergencies || this.canSeeThrough(s.offer)) this.sim.acceptEmergency();
      else {
        this.note(`day ${Math.floor(s.day)}: turned down an emergency (${s.offer.total} with ${s.offer.condition})`);
        this.sim.declineEmergency();
      }
    }
    if (this.flags.emergencies && s.policy.emergenciesFirst !== !!s.emergency)
      this.sim.setPolicy({ emergenciesFirst: !!s.emergency });
    if (s.outbreakOffer) {
      if (this.flags.trouble && !s.emergency && !s.offer) this.sim.acceptOutbreak();
      else this.sim.declineOutbreak();
    }
    if (s.callOffer) {
      if (this.flags.calls) this.houseCall();
      else this.sim.declineCall();
    }
    const ward = this.flags.trouble && (!!s.mishap?.ward || this.sim.canWard());
    if (ward && s.mishap && !s.mishap.ward) this.sim.askWard();
    else if (!ward && s.mishap && !s.mishap.started && !s.mishap.prepared) this.sim.prepareMishap();
    if (s.visitReport?.bribe !== undefined) this.sim.settleInspection(false);
  }

  /** Borrow when nearly broke, and pay the loan back when flush. */
  private manageLoan() {
    const s = this.s;
    // the days before payday, with the wages not in the bank: borrow what they come to, rather than be asked
    const nearPayday = Math.ceil((Math.floor(s.day / 30) + 1) * 30 - s.day) <= 5;
    if (s.money < wagesDue(s) && nearPayday) this.sim.borrow();
    // otherwise keep enough of the bank's limit back to borrow for the wages
    if (s.money < 1500 && s.loan + wagesDue(s) <= loanLimit(s)) {
      if (this.sim.borrow()) this.note(`day ${Math.floor(s.day)}: borrowed, loan now ${s.loan}`);
    } else if (s.loan > 0 && s.money > 25000 + this.wages()) this.sim.repay();
    // saving toward a goal that counts the loan against the money, paying it off only saves the interest
    else if (s.loan > 0 && this.saving() && s.money > 6000 + this.wages()) this.sim.repay();
  }

  /** The money goal the bot is saving toward: one is open, and the rest of the star is met or it is halfway there. */
  private saving(): number | null {
    if (!this.flags.saving) return null;
    const goals = this.goals();
    const goal = goals.find((g) => g.spec.kind === 'balance' && !g.done)?.spec;
    if (goal?.kind !== 'balance') return null;
    const others = goals.filter((g) => g.spec.kind !== 'balance' && !g.done).length;
    return others === 0 || this.s.money - this.s.loan >= goal.amount * 0.5 ? goal.amount : null;
  }

  /** Whether an open goal asks for something of this discipline: guests healed with it. */
  private goalNeeds(d: Discipline): boolean {
    const goal = this.goals().find((g) => !g.done && g.spec.kind === 'healed' && g.spec.discipline === d);
    return !!goal;
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
    // keeping enough of the bank's limit back to borrow for a payday the takings might not meet
    // (a first month's payroll is not on the books yet while the staff are still being taken on)
    if (s.loan + Math.max(wagesDue(s), FIRST_PAYROLL) > loanLimit(s)) return false;
    // and with the next payday still covered, since a payday the bank cannot meet is a loan, or the end
    while (s.money < cost + Math.max(1000, wagesDue(s))) {
      if (s.loan + LOAN_STEP + Math.max(wagesDue(s), FIRST_PAYROLL) > loanLimit(s) || !this.sim.borrow()) return false;
    }
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
    if (this.log.notes.length < 150) this.log.notes.push(text);
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

  /**
   * Build a room of a type with its furniture and any extras, somewhere along the walls. A spot that would leave no
   * space for a room of a type in `keep` is given up while the room is still a plan, as a player would.
   */
  buildRoom(type: RoomType, extras: ItemType[] = [], keep: RoomType[] = []): Room | null {
    const def = ROOMS[type];
    const extraCost = extras.reduce((a, t) => a + ITEMS[t].cost, 0);
    if (this.s.money < def.cost + extraCost + 500) return null;
    // a room that would not fit is not tried again for a few days (looking takes time)
    if (this.flags.expansion && (this.noFit[type] ?? 0) > this.s.day) return null;
    for (const { r, door } of this.roomSpots(type)) {
      const room = this.sim.createRoom(type, r, door);
      if (this.furnish(room, [...def.required, ...extras]) && keep.every((k) => this.fits(k))) {
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
      !this.saving() &&
      this.profit() > 0 &&
      this.afford(offer.price + def.cost + extraCost, 0, true) &&
      this.sim.buyPlot(offer.def.id)
    )
      this.note(`day ${Math.floor(this.s.day)}: bought ${offer.name} for ${offer.price}`);
    this.note(`day ${Math.floor(this.s.day)}: could not fit a ${type}`);
    this.noFit[type] = this.s.day + 10;
    return null;
  }

  /** Where a room of a type could go, the best first: a rectangle along the walls and the doorway nearest the middle. */
  private *roomSpots(type: RoomType): Generator<{ r: Rect; door: WallSpot }> {
    const def = ROOMS[type];
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
    const cx = (p.x0 + p.x1) / 2;
    const cy = (p.y0 + p.y1) / 2;
    for (const { r } of cands.slice(0, 80)) {
      const doors = perimeterDoors(r).sort(
        (a, b) => Math.hypot(a.x + a.dx - cx, a.y + a.dy - cy) - Math.hypot(b.x + b.dx - cx, b.y + b.dy - cy),
      );
      const door = doors.find((d) => this.sim.world.doorValid(type, r, d).ok);
      if (door) yield { r, door };
    }
  }

  /** Whether a room of a type would fit somewhere now. */
  private fits(type: RoomType): boolean {
    return !this.roomSpots(type).next().done;
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
      if (this.flags.clear && this.underfoot(t, x, y, rot)) continue;
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
        if (this.flags.clear && this.underfoot(t, x, y, rot)) continue;
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
    const cheap = role === 'consultant' && this.flags.junior;
    const c = this.s.candidates
      .filter((x) => x.role === role)
      // a player picks the best rank going, then the cheaper, or (for a junior Consultant) just the cheapest
      .sort((a, b) => (cheap ? a.salary - b.salary : b.skill - a.skill || a.salary - b.salary))[0];
    if (!c) return false;
    return !!this.sim.hire(c.id);
  }

  /** Staff in a role who are staying. */
  private staffOf(role: Role) {
    return this.s.staff.filter((x) => x.role === role && x.state !== 'leaving');
  }

  /**
   * A practitioner for a room that needs one. Once open, with marketing on, the bot holds out up to a week for an
   * applicant above Trainee, with a recruitment drive running, as a rank is worth far more than a week's fees.
   */
  private hirePractitioner(role: Role) {
    const s = this.s;
    if (!this.flags.marketing || !s.open) {
      this.hire(role);
      return;
    }
    const best = Math.max(0, ...s.candidates.filter((c) => c.role === role).map((c) => c.skill));
    const since = (this.waitingToHire[role] ??= s.day);
    if (best >= 2 || (best > 0 && s.day - since >= 7)) {
      if (this.hire(role)) this.waitingToHire = { ...this.waitingToHire, [role]: undefined };
      return;
    }
    if (!this.running('recruit') && s.money > 1500 + this.wages() * 0.5 && !this.saving())
      this.campaign('recruit', `hiring a ${role}`);
  }

  /** Whether a marketing campaign of a kind is running. */
  private running(kind: CampaignKind) {
    return this.s.campaigns.some((c) => c.kind === kind);
  }

  /** Start a month's campaign of a kind, and note why. */
  private campaign(kind: CampaignKind, why: string, condition?: ConditionId): boolean {
    if (!this.sim.startCampaign(kind, 1, condition)) return false;
    this.note(`day ${Math.floor(this.s.day)}: ${kind}${condition ? ` (${condition})` : ''} campaign, ${why}`);
    return true;
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
      const rooms = this.rooms(def.room).length - (this.benched[def.room] ?? 0);
      if (this.staffOf(def.role).length < rooms) this.hirePractitioner(def.role);
    }
    if (this.flags.classes && this.staffOf('instructor').length < this.rooms('qigong').length)
      this.hirePractitioner('instructor');
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
    const untrained =
      s.staff.some((st) => this.sim.courses(st).some((c) => c.id in MODALITIES)) ||
      (this.flags.kit && upTo >= 1 && !this.mechanic());
    if (untrained && !this.sim.hasRoom('training') && this.afford(ROOMS.training.cost + 400, 0, true))
      this.buildRoom('training');
    for (const d of DISCIPLINE_ORDER) {
      if (d === 'massage' || !disciplineOn(s, d)) continue;
      const room = TREAT_ROOM[d];
      const unlock = ROOMS[room].unlock ?? 0;
      if (this.saving() && !this.goalNeeds(d)) continue;
      if (upTo >= unlock && !this.sim.hasRoom(room) && this.afford(ROOMS[room].cost + 2000, reserve * 0.5, true)) {
        if (this.buildRoom(room) ?? (this.goalNeeds(d) && this.makeSpace(room))) this.hireToFill();
      }
    }
    // equipment for every unlocked technique, in every room of its discipline; with `courses`, as soon as someone is
    // trained in it, borrowing if need be, since without it every guest who needs it is botched
    for (const m of Object.values(MODALITIES)) {
      if (!m.equipment || !this.sim.unlocked(m.id)) continue;
      const cost = ITEMS[m.equipment].cost;
      const wanted = this.flags.courses && s.staff.some((st) => st.state !== 'leaving' && st.quals.includes(m.id));
      for (const room of this.rooms(TREAT_ROOM[m.discipline])) {
        const has = s.items.some((i) => i.type === m.equipment && this.sim.world.zoneAt(i.x, i.y) === room.id);
        if (has) continue;
        if (wanted ? this.afford(cost, 300, true) : s.money > cost + reserve) this.placeOrMakeRoom(room, m.equipment);
      }
    }
    // a mat for every guest the best Sound Healer can play for
    if (this.flags.mats) {
      const skill = Math.max(0, ...this.staffOf(DISCIPLINES.sound.role).map((st) => st.skill));
      for (const room of this.rooms('sound')) {
        const mats = s.items.filter((i) => i.type === 'sound_mat' && this.sim.world.zoneAt(i.x, i.y) === room.id);
        if (skill && mats.length < matsPlayed(skill) && s.money > ITEMS.sound_mat.cost + reserve)
          this.placeOrMakeRoom(room, 'sound_mat');
      }
    }
    const restNeeded = Object.values(MODALITIES).some((m) => m.rest && this.sim.unlocked(m.id));
    if (restNeeded && upTo >= 1 && !this.sim.hasRoom('recovery') && s.money > 6000 + reserve)
      this.buildRoom('recovery');
    if (upTo >= 1 && !this.has('shop_counter') && s.money > 4000 + reserve) this.placeNearEntrance('shop_counter');
  }

  /** Whether the bot has already knocked a room down to make space, and found it was no use. */
  private noSpace = false;

  /**
   * When a goal needs a room that will not fit and there is no more land to buy, knock down one of a type the center
   * has two or more of (the most of, a treatment room before a consultation room) for half its cost back, as a player
   * would, and build in its place. If even that does not fit, put the old one back and give up.
   */
  private makeSpace(type: RoomType): Room | null {
    const s = this.s;
    if (!this.flags.expansion || this.noSpace) return null;
    if (this.sim.landOffers().some((o) => o.state === 'open' || o.state === 'building')) return null;
    const counts = new Map<RoomType, Room[]>();
    for (const r of s.rooms) if (r.done) counts.set(r.type, [...(counts.get(r.type) ?? []), r]);
    const spare = [...counts.entries()]
      .filter(([t, rs]) => rs.length >= 2 && t !== type)
      .sort(
        (a, b) => b[1].length - a[1].length || Number(!!ROOMS[b[0]].discipline) - Number(!!ROOMS[a[0]].discipline),
      )[0];
    const victim = spare?.[1].at(-1);
    if (!victim) return null;
    this.sim.removeRoom(victim.id, 0.5);
    this.noFit[type] = 0;
    const built = this.buildRoom(type);
    this.note(
      `day ${Math.floor(s.day)}: knocked down a ${victim.type} to make space for a ${type}${built ? '' : ', in vain'}`,
    );
    if (!built) {
      this.noSpace = true;
      this.buildRoom(victim.type);
    }
    return built;
  }

  /** Send treatment staff on the courses for what is unlocked, one at a time each, keeping a reserve. */
  private train() {
    const s = this.s;
    if (!this.sim.hasRoom('training')) return;
    const reserve = 1000;
    const training = s.staff.filter((x) => x.training).length;
    if (training >= 1) return;
    // a Caretaker who can install upgrades, once there are upgrades to install
    if (this.flags.kit && unlockedUpTo(s) >= 1 && !this.mechanic()) {
      const ct = this.staffOf('caretaker').find(
        (st) => !st.training && this.sim.courses(st).some((c) => c.id === 'mechanics'),
      );
      if (ct && this.afford(900, reserve, true) && this.sim.train(ct.id, 'mechanics')) return;
    }
    for (const st of s.staff) {
      if (st.state === 'leaving' || st.training || st.call) continue;
      const course = this.flags.courses
        ? this.bestCourse(st)
        : this.sim
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

  /**
   * A Posture Lab, once, when the consultants send many guests back for a second look: all of them rank 2 or below
   * (a rank 3 Consultant is always sure enough the first time), or more than three waiting a Consultation Room. Only
   * while the center pays its way and the bot is not saving, and with the money in hand.
   */
  private buildLab() {
    if (this.sim.hasRoom('assess') || this.saving() !== null || this.profit() <= 0) return;
    const consultants = this.staffOf('consultant');
    const junior = consultants.length > 0 && consultants.every((x) => x.skill <= 2);
    const long = this.waiting('consultant') > this.rooms('consult').length * 3;
    if (!junior && !long) return;
    if (!this.afford(ROOMS.assess.cost, this.wages() * 1.2 + 2000)) return;
    if (this.buildRoom('assess')) {
      this.note(`day ${Math.floor(this.s.day)}: a Posture Lab (${junior ? 'junior consultants' : 'a long line'})`);
      this.hireToFill();
    }
  }

  /** Build another room where a line is long and the money is there. */
  private grow() {
    if (this.flags.expansion) {
      this.growOnProfit();
      return;
    }
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

  /** The month in which the bot last added (or took back into use) a room for each discipline. */
  private grewIn: Partial<Record<Discipline, number>> = {};

  /**
   * Grow on the profit a room is expected to make: a desk or a consultation room where their lines are long and the
   * center pays its way, as before, and a treatment room (an empty one taken back into use first) wherever another
   * is expected to earn more than its practitioner and its cost spread over a year. One room a discipline at a time,
   * judged again once a full month has gone by with it. Saving toward a money goal, only a room that pays for itself
   * within three months.
   */
  private growOnProfit() {
    const s = this.s;
    const reserve = this.wages() * 1.2 + 2000;
    const saving = this.saving();
    if (this.profit() > 0 && !saving) {
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
      const seats = this.count('bench') * 2;
      if (s.guests.length > seats + 2 && s.money > 400 + reserve) {
        const room = s.rooms.filter((r) => r.done)[Math.floor(s.day) % Math.max(1, s.rooms.length)];
        if (room) this.placeNear('bench', room.door.x + room.door.dx * 2, room.door.y + room.door.dy * 2);
      }
    }
    const month = Math.floor(s.day / DAYS_PER_MONTH);
    // space is kept for a discipline that is open, or opens at the next star, and has no room yet
    const upTo = unlockedUpTo(s);
    const toCome = DISCIPLINE_ORDER.filter(
      (d) =>
        d !== 'massage' &&
        disciplineOn(s, d) &&
        (ROOMS[TREAT_ROOM[d]].unlock ?? 0) <= upTo + 1 &&
        !this.sim.hasRoom(TREAT_ROOM[d]),
    ).map((d) => TREAT_ROOM[d]);
    for (const d of DISCIPLINE_ORDER) {
      const room = TREAT_ROOM[d];
      if (!this.rooms(room).length || month < (this.grewIn[d] ?? -9) + 2) continue;
      const value = this.roomValue(d);
      if (value <= 0) continue;
      if (this.benched[room]) {
        this.benched[room]--;
        this.grewIn[d] = month;
        this.note(`day ${Math.floor(s.day)}: taking a ${DISCIPLINES[d].role} back on, worth ${Math.round(value)}`);
        this.hireToFill();
        continue;
      }
      const cost = ROOMS[room].cost;
      if (saving && value * 3 < cost) continue;
      if (!this.afford(cost + 1000, reserve * 0.5, value * 6 > cost)) continue;
      // not where it would leave no space for a discipline still to come
      const keep = toCome.filter((t) => this.fits(t));
      if (this.buildRoom(room, [], keep)) {
        this.grewIn[d] = month;
        this.note(`day ${Math.floor(s.day)}: another ${room}, worth ${Math.round(value)} a month`);
        this.hireToFill();
      }
    }
  }

  /**
   * What another staffed room for a discipline is expected to add a month: the guests it would see (those who gave up
   * waiting for the treatment last month, and those waiting beyond one a room), as many as the coming season brings,
   * healed at the rate the discipline heals and paying its fees, less a practitioner's pay and, for a new room, its
   * cost spread over a year.
   */
  private roomValue(d: Discipline): number {
    const m = this.seen[d];
    if (!m) return 0;
    const def = DISCIPLINES[d];
    const rooms = Math.max(1, this.rooms(def.room).length - (this.benched[def.room] ?? 0));
    const guests = (m.lost + Math.max(0, m.line - rooms)) * this.ahead(3);
    const rate = m.treated >= 3 ? m.healed / m.treated : 0.6;
    const room = this.benched[def.room] ? 0 : ROOMS[def.room].cost / 12;
    return guests * rate * this.feeFor(d) - this.salaryFor(def.role) - room;
  }

  /** What the bot would expect to pay a new practitioner in a role: the cheapest applicant, or the cheapest on staff. */
  private salaryFor(role: Role): number {
    const pay = [...this.s.candidates.filter((c) => c.role === role), ...this.staffOf(role)].map((x) => x.salary);
    return pay.length ? Math.min(...pay) : 2000;
  }

  // ---- what a good player does besides -------------------------------------

  /** Whether putting an item down here would cover a tile someone is standing on, and could wall them in. */
  private underfoot(t: ItemType, x: number, y: number, rot: number): boolean {
    if (onWall(t) || ITEMS[t].walkable) return false;
    const tiles = footprint({ type: t, x, y, rot });
    return [...this.s.guests, ...this.s.staff, ...this.s.visitors].some((c) =>
      tiles.some(([tx, ty]) => tx === c.tx && ty === c.ty),
    );
  }

  /**
   * Anyone who cannot get out to the street, walled into a pocket of the building: sell the cheapest thing that boxes
   * them in, one a day, as a player who spotted them would.
   */
  private freeTrapped() {
    const w = this.sim.world;
    const street = new Set(w.flood(0, SIDEWALK_Y).map(([x, y]) => w.idx(x, y)));
    for (const c of [...this.s.staff, ...this.s.guests]) {
      if (!w.inside(c.tx, c.ty) || !w.walkable(c.tx, c.ty) || street.has(w.idx(c.tx, c.ty))) continue;
      const edge = new Set<number>();
      for (const [x, y] of w.flood(c.tx, c.ty, 400))
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const)
          if (w.onMap(nx, ny)) edge.add(w.idx(nx, ny));
      const wall = this.s.items
        .filter(
          (it) =>
            !ITEMS[it.type].station &&
            !onWall(it.type) &&
            this.sim.canSell(it) &&
            footprint(it).some(([x, y]) => edge.has(w.idx(x, y))),
        )
        .sort((a, b) => ITEMS[a.type].cost - ITEMS[b.type].cost)[0];
      if (!wall) continue;
      this.sim.sellItem(wall.id);
      this.note(`day ${Math.floor(this.s.day)}: sold a ${wall.type} that walled someone in`);
      return;
    }
  }

  /** In a stress outbreak, a calming session for each guest seen sweating, while there are sessions left. */
  private calmCarriers() {
    const o = this.s.outbreak;
    if (!o) return;
    for (const g of this.s.guests) {
      if (o.calms <= 0) return;
      if (g.stressed && !g.calmed && g.state !== 'leaving') this.sim.calm(g.id);
    }
  }

  /**
   * Whether the staff can heal enough of an emergency's guests in time: practitioners trained in its technique, with
   * its equipment in place, each giving it about half their time over the days it runs (less a few for the guests to
   * arrive and be seen), at the chance their rank gives a guest who has waited a little.
   */
  private canSeeThrough(e: Emergency): boolean {
    const mod = MODALITIES[conditionOf(e.condition).modality];
    const able = this.staffOf(DISCIPLINES[mod.discipline].role).filter((st) => st.quals.includes(mod.id));
    if (!able.length || (mod.equipment && !this.has(mod.equipment))) return false;
    let healed = 0;
    for (const st of able) {
      const days = mod.seconds / DAY_SECONDS / (0.85 + st.skill * 0.05);
      const chance = Math.min(0.95, Math.max(0.3, 0.6 + st.skill * 0.09 - mod.difficulty));
      const places = mod.discipline === 'sound' ? matsPlayed(st.skill) : 1;
      healed += ((EMERGENCY_DAYS - 6) / days) * places * chance * 0.5;
    }
    return healed >= e.target;
  }

  /**
   * A guest whose condition would run out before their turn moves up their line, to the last place that gets them
   * seen in time, one a line a day. Their turn comes after the treatments ahead of them, at the pace of whoever works
   * the table.
   */
  private triage() {
    for (const it of this.s.items) {
      const def = ITEMS[it.type].station;
      if (def?.goal !== 'treat' || def.group || it.queue.length < 2) continue;
      const st = this.sim.stationStaff(it);
      const speed = st ? 0.85 + st.skill * 0.05 : 0.5;
      /** How long a guest's treatment takes here. */
      const takes = (g: Guest) => this.sim.modalityOf(g).seconds / speed;
      const line = it.queue.map((id) => this.sim.guest(id)).filter((g): g is Guest => !!g);
      const served = this.sim.servedAt(it);
      const before: number[] = [];
      let wait = served ? takes(served) * (1 - it.progress) : 0;
      for (const g of line) {
        before.push(wait);
        wait += takes(g);
      }
      /** How long until a guest's condition runs out. */
      const left = (g: Guest) => g.health / worsenRate(g.condition);
      for (const [p, g] of line.entries()) {
        if (p === 0 || left(g) >= (before[p] ?? 0)) continue;
        let q = p - 1;
        while (q > 0 && (before[q] ?? 0) > left(g)) q--;
        // only past guests who can spare the wait: patient still, and in no danger of getting worse themselves
        const passed = line.slice(q, p);
        const spare = passed.every((h, i) => h.patience >= 50 && left(h) > (before[q + i] ?? 0) + takes(g) * 2);
        if (spare && this.sim.moveInLine(g.id, q - p)) break;
      }
    }
  }

  /** Whether a Caretaker on the payroll can install upgrades. */
  private mechanic(): boolean {
    return this.staffOf('caretaker').some((st) => st.general.includes('mechanics'));
  }

  /** Whether a room has an item of a type in it. */
  private inRoom(room: Room, t: ItemType): boolean {
    return this.s.items.some((i) => i.type === t && this.sim.world.zoneAt(i.x, i.y) === room.id);
  }

  /**
   * Kit a good player buys once the first star opens it: a chart on the wall of every room it helps, a Recliner for
   * every two practitioners trained in a technique that needs a rest, and, once a Caretaker can install them, the
   * upgrades for the treatment equipment, the least upgraded and busiest first, one a day while the center pays its
   * way and the bot is not saving.
   */
  private equip() {
    const s = this.s;
    const upTo = unlockedUpTo(s);
    if (upTo < 1) return;
    const reserve = this.wages() + 3000;
    for (const room of s.rooms.filter((r) => r.done)) {
      const chart = CHART_FOR[room.type];
      if (chart && !this.inRoom(room, chart) && s.money > ITEMS[chart].cost + reserve) this.placeIn(room, chart);
    }
    const resting = s.staff.filter((st) => st.state !== 'leaving' && st.quals.some((q) => MODALITIES[q].rest)).length;
    const lounge = this.rooms('recovery')[0];
    if (lounge && this.count('recliner') < Math.ceil(resting / 2) && s.money > ITEMS.recliner.cost + reserve)
      this.placeIn(lounge, 'recliner');
    if (!this.mechanic() || this.saving() || this.profit() <= 0) return;
    /** How busy the discipline an item serves was last month. */
    const busy = (it: Item) => {
      const d = ITEMS[it.type].station?.discipline;
      return d ? (this.seen[d]?.busy ?? 0) : 0;
    };
    const next = s.items
      .filter(
        (it) =>
          ITEMS[it.type].upgrade !== undefined &&
          it.type !== 'posture_scanner' &&
          !it.upgradePaid &&
          it.level < Math.min(upTo, 3),
      )
      .sort((a, b) => a.level - b.level || busy(b) - busy(a))[0];
    if (next && s.money > upgradeCost(next.type, next.level + 1) + reserve) this.sim.orderUpgrade(next.id);
  }

  /**
   * A Qi Gong Studio once the second star opens it, while the center pays its way and the bot is not saving: classes
   * bring guests of their own, who take nothing from the treatment rooms. Then as many Practice Spots as the
   * Instructor can lead.
   */
  private classes() {
    const s = this.s;
    if (unlockedUpTo(s) < 2 || !offeringOn(s, 'qigong')) return;
    const reserve = this.wages() * 0.8 + 2000;
    if (!this.sim.hasRoom('qigong')) {
      if (this.saving() || this.profit() <= 0 || !this.afford(ROOMS.qigong.cost + 3000, reserve)) return;
      if (this.buildRoom('qigong')) {
        this.note(`day ${Math.floor(s.day)}: a Qi Gong Studio`);
        this.hireToFill();
      }
      return;
    }
    this.shops();
    const places = this.sim.classLeader()?.places;
    if (!places) return;
    for (const room of this.rooms('qigong')) {
      // a class every weekday rather than three a week: the week's class-goers are shared among its classes, so
      // smaller crowds let out at once, and the weekend is left for the Instructor's rest
      for (const day of [1, 3])
        if (!(room.classDays ?? CLASS_DAYS).includes(day)) this.sim.toggleClassDay(room.id, day);
      // class-goers have places of their own, so a class as big as the Instructor can lead keeps nobody out
      const spots = s.items.filter((i) => i.type === 'practice_spot' && this.sim.world.zoneAt(i.x, i.y) === room.id);
      if (spots.length < places && s.money > ITEMS.practice_spot.cost + reserve) this.placeIn(room, 'practice_spot');
    }
  }

  /**
   * Another Shop Counter, and a Receptionist for it, whenever more than six wait at each, up to three: a class lets
   * a crowd out at once, and a long line puts treated guests off stopping at the counter.
   */
  private shops() {
    const s = this.s;
    const counters = this.count('shop_counter');
    if (!counters || counters >= 3) return;
    const waiting = s.guests.filter((g) => g.goal === 'shop' && (g.state === 'waiting' || g.state === 'toWait'));
    if (waiting.length <= counters * 5 || !this.afford(ITEMS.shop_counter.cost, 1000, true)) return;
    if (this.placeNearEntrance('shop_counter')) {
      this.note(`day ${Math.floor(s.day)}: another Shop Counter (${waiting.length} waiting)`);
      this.hireToFill();
    }
  }

  /**
   * The course a good player picks for someone: the technique worth most to the center, by how often guests come
   * needing it and what they pay and how hard it is to get right, and much more where nobody else on the staff is
   * trained in it yet (guests needing a technique nobody knows come less often, and are botched when they do).
   */
  private bestCourse(st: Staff) {
    const local = CENTERS[this.center].conditions ?? {};
    /** What learning a technique is worth. */
    const value = (m: Modality) => {
      const covered = this.s.staff.some((o) => o !== st && o.state !== 'leaving' && o.quals.includes(m));
      const worth = CONDITIONS.filter((c) => c.modality === m && conditionHere(c, this.s.center)).reduce(
        (a, c) => a + (local[c.id] ?? 1) * c.fee,
        0,
      );
      return worth * (0.9 - MODALITIES[m].difficulty) * (covered ? 0.35 : 1);
    };
    return this.sim
      .courses(st)
      .filter((c): c is typeof c & { id: Modality } => c.id in MODALITIES)
      .sort((a, b) => value(b.id) - value(a.id) || a.cost - b.cost)[0];
  }

  /**
   * Put a piece of equipment into a room; with `layout`, if it will not fit, push a wall out a tile where there is
   * space for it, or failing that sell the room's floor decor a piece at a time, as a player would rather have the
   * treatment than the statue.
   */
  private placeOrMakeRoom(room: Room, t: ItemType): Item | null {
    const placed = this.placeIn(room, t);
    if (placed || !this.flags.layout) return placed;
    const { x, y, w, h } = room;
    for (const r of [
      { x, y, w: w + 1, h },
      { x: x - 1, y, w: w + 1, h },
      { x, y, w, h: h + 1 },
      { x, y: y - 1, w, h: h + 1 },
    ]) {
      if (!this.sim.world.resizeValid(room, r).ok || !this.sim.resizeRoom(room.id, r)) continue;
      const it = this.placeIn(room, t);
      this.note(`day ${Math.floor(this.s.day)}: made a ${room.type} bigger for a ${t}`);
      if (it) return it;
    }
    const decor = this.s.items
      .filter((i) => FLOOR_DECOR.includes(i.type) && this.sim.world.zoneAt(i.x, i.y) === room.id)
      .sort((a, b) => FLOOR_DECOR.indexOf(a.type) - FLOOR_DECOR.indexOf(b.type));
    for (const d of decor) {
      this.sim.sellItem(d.id);
      const it = this.placeIn(room, t);
      if (it) {
        this.note(`day ${Math.floor(this.s.day)}: sold a ${d.type} to make space for a ${t}`);
        return it;
      }
    }
    return null;
  }

  /**
   * Dress a treatment room as a good player would, the cheapest prestige first and keeping the floor for equipment:
   * a window ($150 for half a star's worth, up to four, onto the street before the corridor, and onto the corridor
   * only where the room is quiet), then a picture or a hanging on the wall, a rug (it lies under the furniture), and
   * only then lamps and statues. One thing a day.
   */
  private dress(room: Room, reserve: number) {
    const s = this.s;
    const w = this.sim.world;
    if (room.windows.length < WINDOW_MAX_BONUS && s.money > WINDOW_COST + reserve) {
      const tables = s.items.filter((i) => ITEMS[i.type].station && w.zoneAt(i.x, i.y) === room.id);
      const quiet = tables.every((t) => this.sim.itemNoise(t) < NOISE_NOTICE / 2);
      const spots = perimeterDoors(room).filter(
        (sp) =>
          !room.windows.some((x) => x.x === sp.x && x.y === sp.y && x.dx === sp.dx && x.dy === sp.dy) &&
          w.windowValid(room, sp).ok,
      );
      const spot = spots.find((sp) => !w.inside(sp.x + sp.dx, sp.y + sp.dy)) ?? (quiet ? spots[0] : undefined);
      if (spot && this.sim.toggleWindow(room.id, spot) === 'added') return;
    }
    const upTo = unlockedUpTo(s);
    for (const t of DRESS) {
      if (!itemOpen(ITEMS[t], upTo, []) || s.money < ITEMS[t].cost + reserve) continue;
      if (this.placeIn(room, t)) return;
    }
  }

  /** Decor in the treatment rooms until each is a star of prestige above what guests expect. */
  private decorate() {
    const s = this.s;
    const reserve = this.wages() + 3000;
    const picky = CENTERS[s.center].picky?.expects ?? 0;
    const target = Math.min(5, Math.max(3, 2 + picky + (s.grade >= 2 ? 1 : 0)));
    const treat = s.rooms.filter((r) => r.done && ROOMS[r.type].discipline);
    // saving for a money goal, only what a prestige goal asks for
    const wanted = this.openGoal('prestige');
    for (const room of treat) {
      if (this.saving() && wanted?.room !== room.type) continue;
      if (this.sim.prestige(room) >= target || s.money < reserve) continue;
      // with a goal for patience, decor that stands on the floor, which cheers the corridor outside where guests wait
      // as well as the room (decor carries through walls, and a window adds only to the room)
      if (this.flags.layout && !this.openGoal('patience')) {
        this.dress(room, reserve);
        continue;
      }
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
    if (this.count('plant') < rooms && s.money > 500 + reserve && !this.saving()) {
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
