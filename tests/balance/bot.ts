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
  CAPACITY_ARRIVALS,
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
  machineRoom,
  MODALITIES,
  type Modality,
  NOISE_NOTICE,
  type Role,
  ROLES,
  ROOM_ORDER,
  ROOMS,
  type RoomType,
  SIDEWALK_Y,
  WINDOW_COST,
  WINDOW_MAX_BONUS,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { roomCost } from '../../src/core/resize';
import { BUSY_DAYS } from '../../src/core/sim/bottleneck';
import { daysUntilBankrupt, loanLimit, projectedCashflow, putOffChance, wagesDue } from '../../src/core/sim/economy';
import type { SimEvent, Subject } from '../../src/core/sim/events';
import { INTAKE_CAP_MIN } from '../../src/core/sim/guests';
import { rivalPoints } from '../../src/core/sim/rival';
import { matsPlayed } from '../../src/core/sim/sessions';
import { Sim } from '../../src/core/sim/sim';
import { inRush, SEASON_AHEAD_DAYS, seasonOf } from '../../src/core/sim/twists';
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
  /**
   * In a center with seasons, limit guests at once through the summer to what the staffed tables can treat, from the
   * fortnight's warning until autumn. An extra, measured in balance log 29.
   */
  'throttle',
  /**
   * Build the center's own treatment machine once its star is earned and the center pays its way, as a station more:
   * on free floor or on land bought for it, never in place of another room; and send a practitioner on its course. An
   * extra for now, so the bot's pace stays as measured before the machines: compare `BOT_ON=machines` with the bot
   * without them, seed by seed.
   */
  'machines',
] as const;
export type BotFlag = (typeof BOT_FLAGS)[number];
export type BotFlags = Record<BotFlag, boolean>;
/**
 * Flags that are off unless `BOT_ON` names them: a different way to play rather than better play, or play that was
 * measured and found to gain nothing.
 */
const BOT_EXTRAS: readonly BotFlag[] = ['junior', 'lab', 'clear', 'trouble', 'triage', 'throttle', 'machines'];

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
  const all = botMode(env) === 'new';
  const off = list(env.BOT_OFF);
  const on = list(env.BOT_ON);
  return Object.fromEntries(
    BOT_FLAGS.map((f) => [f, (all && !BOT_EXTRAS.includes(f) && !off.has(f)) || on.has(f)]),
  ) as BotFlags;
}

/**
 * How the bot plays: as a good player (`new`), as it did before it learned its flags (`old`), or as a thoughtless
 * baseline (`baseline`): the opening build and nothing on purpose after it, a room and someone to work it only once
 * a line has formed, never a price changed, a call taken or a loan asked for, so the game is measured as a new
 * player who reads nothing meets it. `advised` plays as the baseline and also does exactly what the game's toasts and
 * advisor tell it, and nothing they do not, so the game is measured as a new player who reads it and does as it says.
 */
export type BotMode = 'new' | 'old' | 'baseline' | 'advised';

/** The bot's mode from the environment (`BOT=old`, `BOT=baseline`, `BOT=advised`): a good player unless told otherwise. */
export function botMode(env: Record<string, string | undefined> = process.env): BotMode {
  const mode = env.BOT ?? 'new';
  if (mode !== 'new' && mode !== 'old' && mode !== 'baseline' && mode !== 'advised')
    throw new Error(`Unknown BOT=${mode}: use new, old, baseline or advised`);
  return mode;
}

/** A sum of money the bot keeps back before spending on something: so many months' wages and so many dollars more. */
export interface Reserve {
  k: number;
  c: number;
}

/** What the bot keeps a reserve back for, each in its own method. */
export const RESERVES = [
  /** Word of mouth and a condition in the spotlight (`market`). */
  'marketing',
  /** A recruitment drive while holding out for a better applicant (`hirePractitioner`). */
  'recruit',
  /** The staff room, restroom, drinks and hamper any center needs (`basics`). */
  'basics',
  /** What a new star unlocks: its rooms (at half the reserve) and equipment (`unlocks`). */
  'unlocks',
  /** A course (`train`). */
  'training',
  /** Another room, desk, consulting room or Posture Lab (`grow`, `growOnProfit`, `buildLab`; rooms at half of it). */
  'growth',
  /** Charts, Recliners and equipment upgrades (`equip`). */
  'kit',
  /** A Qi Gong Studio and its Practice Spots (`classes`). */
  'classes',
  /** Decor in the treatment rooms (`decorate`). */
  'decor',
  /** Plants, drinks and toilets in the corridor (`comforts`). */
  'comforts',
] as const;
export type ReservePurpose = (typeof RESERVES)[number];

/**
 * How the good bot plays where a player has a choice of temper rather than of skill: what it charges, what it keeps
 * back, how far it borrows, how soon a new room must pay, and whether it markets. The same decisions, weighted
 * differently (the persona idea of docs/research/balancing_methods.md), so the styles can be run over the same seeds
 * and a style that always wins, or an income that always carries, can be seen. `BOT_STYLE` picks one.
 */
export interface Style {
  /** The highest price level the bot sets, and the most it adds on top for a discipline whose line runs long. */
  priceTop: number;
  premiumTop: number;
  /** The share of guests put off by prices the bot aims for: a little under it, it charges more; well over, less. */
  putOff: number;
  reserve: Record<ReservePurpose, Reserve>;
  /**
   * How far it borrows for what it buys: `payday`, never beyond what a payday forces (the bank's own loan at payday,
   * nothing asked for); `build`, for what is worth borrowing for while the center pays its way, keeping back enough
   * of the bank's limit for a payday; `limit`, for anything, up to the bank's limit, keeping only the next payday in
   * hand.
   */
  borrow: 'payday' | 'build' | 'limit';
  /** The loan is paid back once the money is over this. */
  repay: Reserve;
  /**
   * The months a new treatment room must pay back its cost within: its cost is spread over them in `roomValue`, and
   * a room is built only if it is still worth something after that. And how many months of that worth must cover the
   * cost for the bot to borrow for it.
   */
  payback: number;
  borrowPayback: number;
  /** Whether it markets: `never`; `pays`, where it pays (see `market`); `always`, word of mouth whenever affordable. */
  marketing: 'never' | 'pays' | 'always';
}

/** The good bot: as it has played since entry 23 of the balance log. */
const GOOD: Style = {
  priceTop: 1.4,
  premiumTop: 1.3,
  putOff: 0.1,
  reserve: {
    marketing: { k: 0.5, c: 2000 },
    recruit: { k: 0.5, c: 1500 },
    basics: { k: 0.5, c: 0 },
    unlocks: { k: 1, c: 0 },
    training: { k: 0, c: 1000 },
    growth: { k: 1.2, c: 2000 },
    kit: { k: 1, c: 3000 },
    classes: { k: 0.8, c: 2000 },
    decor: { k: 1, c: 3000 },
    comforts: { k: 1, c: 2000 },
  },
  borrow: 'build',
  repay: { k: 1, c: 25000 },
  payback: 12,
  borrowPayback: 6,
  marketing: 'pays',
};

/** Every reserve's share of the wages set by a rule, the dollars on top left as the good bot keeps them. */
const reserves = (k: (good: number) => number) =>
  Object.fromEntries(RESERVES.map((p) => [p, { k: k(GOOD.reserve[p].k), c: GOOD.reserve[p].c }])) as Style['reserve'];

/** The play styles `BOT_STYLE` picks from. */
export const STYLES = {
  good: GOOD,
  /**
   * Cautious and dear: never borrows beyond what payday forces, keeps two months' wages back for everything, prices
   * to 1.6 aiming to put off one guest in five, builds only a room that pays back within a month, and never markets.
   * The premium for a long line stays at 1.3: on top of 1.6 it already meets the game's ceiling of 2.
   */
  hoarder: {
    ...GOOD,
    priceTop: 1.6,
    putOff: 0.2,
    reserve: reserves((k) => Math.max(k, 2)),
    borrow: 'payday',
    repay: { k: 2, c: 0 },
    payback: 1,
    borrowPayback: 0,
    marketing: 'never',
  },
  /**
   * Bold and cheap: borrows to the bank's limit from the start, keeps half a month's wages back (a reserve the good
   * bot keeps lower, the training one, is left lower), prices from 1 to 1.2 with no premium on top, builds whatever
   * pays back, and runs word of mouth whenever it can pay for it. The brief's "pays back within six months" would be
   * stricter than the good bot, which spreads a room's cost over a year (`payback` 12), so the grower spreads it
   * over two years instead, and borrows for any room that is worth something after that.
   */
  grower: {
    ...GOOD,
    priceTop: 1.2,
    premiumTop: 1,
    reserve: reserves((k) => Math.min(k, 0.5)),
    borrow: 'limit',
    payback: 24,
    borrowPayback: Infinity,
    marketing: 'always',
  },
} satisfies Record<string, Style>;
export type StyleName = keyof typeof STYLES;

/** The bot's play style from the environment (`BOT_STYLE=hoarder`): the good bot unless told otherwise. */
export function botStyle(env: Record<string, string | undefined> = process.env): Style {
  const name = env.BOT_STYLE ?? 'good';
  if (!(name in STYLES)) throw new Error(`Unknown BOT_STYLE=${name}: use ${Object.keys(STYLES).join(', ')}`);
  return STYLES[name as StyleName];
}

/** The share of the time a discipline's staffed tables are kept busy that the bot staffs for. */
const BUSY_TARGET = 0.7;
/** The share of diagnosed guests who are new, and so balk at the full chance (balance log 35: 26% new, 6% plain regulars). */
const NEW_GUESTS = 0.3;

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
  /** The lowest reputation seen over the month, sampled daily. */
  repLow: number;
  stars: number;
  grade: number;
  /** The center's standing points and the rival's, at the month's end (0 for a rival not yet open); not in older logs. */
  standing?: number;
  rival?: number;
  /** Center of the Year awards the center has won so far; not in older logs. */
  coty?: number;
  staff: number;
  rooms: number;
  /** Finished treatment rooms (a discipline’s own), and Qi Gong Instructors on the payroll, at the month’s end; not in older logs. */
  treatRooms?: number;
  instructors?: number;
  /** Staffed treatment stations and the building's limit on guests at once, at the month's end; not in older logs. */
  stations?: number;
  guestCap?: number;
  arrived: number;
  /** Guests who found the center full and went elsewhere. */
  turnedAway: number;
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
  /** The month's income by source, from the ledger: treatments and consultations, and the side incomes. */
  incomeBy: IncomeBy;
}

/** A month's income by where it came from, rounded to the dollar. */
export interface IncomeBy {
  treatment: number;
  consult: number;
  classes: number;
  calls: number;
  shop: number;
  mushrooms: number;
  vending: number;
  bonus: number;
}

/** A treatment machine the bot built, and how it paid; or one it wanted and found no space for. */
export interface MachineLog {
  room: RoomType;
  /** The day it was built, or, while it is skipped, the day it was first put off. */
  day: number;
  /**
   * Where its room went: on the floor the center had free, or on land bought once it would not fit; or nowhere yet,
   * since nothing fitted without knocking a room down.
   */
  site: 'floor' | 'expansion' | 'skipped';
  /** The months in which it was put off for want of space, before it was built (or since, if it never was). */
  skipped: number;
  /** What its room cost to build. */
  cost: number;
  /** Fees from the guests it healed, and how many. */
  earned: number;
  healed: number;
  /** Its running costs and overload bills paid so far. */
  upkeep: number;
  /** The day its fees first covered its room and running costs, or null if they never have. */
  paybackDay: number | null;
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
  /** The first thing to go against the center once it was open: a twist's first blow or trouble, and the day. */
  firstAdverse: { what: string; day: number } | null;
  /** Every thing that went against the center once it was open, as it began: the kinds of `firstAdverse`, in order. */
  adverse: { what: string; day: number }[];
  /** The warnings the game gave: its 'bad' toasts, each cut to its first 60 characters, once a day each. */
  warnings: { day: number; text: string }[];
  /** The day the game ended in bankruptcy, or null if it did not. */
  bankruptDay: number | null;
  /** The treatment machines built, with the `machines` flag. */
  machines: MachineLog[];
}

const TREAT_ROOM: Record<Discipline, RoomType> = {
  massage: 'massage',
  acupuncture: 'acupuncture',
  reiki: 'reiki',
  sound: 'sound',
  shaman: 'lodge',
};

/**
 * The size the bot builds each room at: roomy enough for a bit of decor, and within the floor a room's price covers (a
 * tile more each way than its smallest), so none of it is paid for on top. A smaller Restroom or Training Room would
 * move where the rooms after it go, and on Willow Lane that walls off the one plot a second Massage Suite fits on.
 */
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

/** What a room of a type costs at the size the bot builds it, any floor past what its price covers included. */
function price(type: RoomType): number {
  const def = ROOMS[type];
  const [w, h] = SIZE[type] ?? [def.minShort, def.minLong];
  return roomCost(type, { w, h });
}

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
  /** Reception desks left without their own receptionist, by the advised bot letting one go as the game named them. */
  private benchedDesks = 0;
  /** What the bot sees over the month under way, and what it saw over the last, by discipline. */
  private watch: Watch;
  private seen: Partial<Record<Discipline, DisciplineMonth>> = {};
  /** Reputation when the bot last looked at its prices, and the month it last let anyone go. */
  private repAtReview = 0;
  private trimmedMonth = -1;
  /** The day the bank last called the overdraft in on the bot, after which it builds and hires nothing for a month. */
  private rescuedOn = -Infinity;
  /** The day the bot began waiting for a better applicant for a role. */
  private waitingToHire: Partial<Record<Role, number>> = {};
  /** The day until which the bot does not try again to fit a room of a type that did not fit. */
  private noFit: Partial<Record<RoomType, number>> = {};
  /** The discipline each guest in a treatment line is waiting for, as last seen. */
  private inLine = new Map<number, Discipline>();
  /** The guests seen sent for a posture scan, and how many of them this month. */
  private sentForScan = new Set<number>();
  private scans = 0;
  /** The lowest reputation seen so far this month. */
  private repLow = Infinity;

  constructor(
    readonly center: CenterId,
    readonly seed = 1,
    difficulty: Difficulty = {},
    readonly flags: BotFlags = botFlags(),
    readonly mode: BotMode = botMode(),
    readonly style: Style = botStyle(),
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
      firstAdverse: null,
      adverse: [],
      warnings: [],
      bankruptDay: null,
      machines: [],
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
        const events = this.sim.drain();
        this.noteWarnings(events);
        this.hear(events);
        // a payday the bank cannot cover is borrowed for, as the player would, and past the loan paid into the red
        if (this.s.payrollDue) {
          if (this.sim.takePayrollLoan())
            this.note(`day ${Math.floor(this.s.day)}: borrowed to make payday, loan now ${this.s.loan}`);
          else if (this.sim.payIntoRed())
            this.note(`day ${Math.floor(this.s.day)}: wages into the red, ${this.s.money}`);
        }
        // the days the bank gives to put the books right start paused: play on through them
        if (this.s.insolvency) this.s.speed = 1;
        if (this.s.bankrupt) {
          this.note(`day ${Math.floor(this.s.day)}: BANKRUPT, loan ${this.s.loan}`);
          this.log.bankruptDay = Math.floor(this.s.day);
          return false;
        }
        if (i % 10 === 0) {
          this.sampleTables();
          if (this.flags.machines) this.watchMachines();
          if (this.flags.trouble) this.calmCarriers();
        }
      }
      this.noteAdverse();
      this.log.lowestMoney = Math.min(this.log.lowestMoney, this.s.money);
      this.log.peakLoan = Math.max(this.log.peakLoan, this.s.loan);
      this.repLow = Math.min(this.repLow, this.s.reputation);
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

  /**
   * The first thing to go against the center once it is open, for the log: its twist's first blow (a summer, a
   * rush hour, a snowed-in spell), a stress outbreak, a mishap, a failed inspection, the rival opening, or someone
   * quitting, whichever comes first.
   */
  private noteAdverse() {
    this.noteEveryAdverse();
    const s = this.s;
    if (this.log.firstAdverse || !s.open) return;
    const what =
      this.center === 'boardwalk' && seasonOf(s.day) === 'summer'
        ? 'summer'
        : this.center === 'exchange' && inRush(s.day)
          ? 'rush hour'
          : this.sim.snowedIn()
            ? 'snowed in'
            : s.outbreak
              ? 'stress outbreak'
              : s.mishap?.started
                ? `mishap (${s.mishap.kind})`
                : s.visitReport?.bribe !== undefined
                  ? 'failed inspection'
                  : s.rival.opened !== null
                    ? 'rival opened'
                    : s.stats.lastQuit >= 0
                      ? 'someone quit'
                      : null;
    if (what) this.log.firstAdverse = { what, day: Math.floor(s.day) };
  }

  /** The lasting adverse conditions seen yesterday, and the mishap, inspection report and quit already logged. */
  private adverseOn = new Set<string>();
  private adverseSeen: { mishap: unknown; report: unknown; quit: number } = { mishap: null, report: null, quit: -1 };

  /** Log each adverse event as it begins: a condition that was not there yesterday, or a new mishap, report or quit. */
  private noteEveryAdverse() {
    const s = this.s;
    if (!s.open) return;
    const day = Math.floor(s.day);
    const seen = this.adverseSeen;
    const on = new Set<string>();
    if (this.center === 'boardwalk' && seasonOf(s.day) === 'summer') on.add('summer');
    if (this.center === 'exchange' && inRush(s.day)) on.add('rush hour');
    if (this.sim.snowedIn()) on.add('snowed in');
    if (s.outbreak) on.add('stress outbreak');
    for (const what of on) if (!this.adverseOn.has(what)) this.log.adverse.push({ what, day });
    this.adverseOn = on;
    if (s.mishap?.started && s.mishap !== seen.mishap) {
      seen.mishap = s.mishap;
      this.log.adverse.push({ what: `mishap (${s.mishap.kind})`, day });
    }
    if (s.visitReport?.bribe !== undefined && s.visitReport !== seen.report) {
      seen.report = s.visitReport;
      this.log.adverse.push({ what: 'failed inspection', day });
    }
    if (s.rival.opened !== null && !this.log.adverse.some((a) => a.what === 'rival opened'))
      this.log.adverse.push({ what: 'rival opened', day });
    if (s.stats.lastQuit >= 0 && s.stats.lastQuit !== seen.quit) {
      seen.quit = s.stats.lastQuit;
      this.log.adverse.push({ what: 'someone quit', day });
    }
  }

  /** Log the game's warnings among the events just drained, each text once a day. */
  private noteWarnings(events: SimEvent[]) {
    const day = Math.floor(this.s.day);
    for (const e of events) {
      if (e.type !== 'toast' || e.kind !== 'bad') continue;
      const text = e.text.slice(0, 60);
      if (!this.log.warnings.some((w) => w.day === day && w.text === text)) this.log.warnings.push({ day, text });
    }
  }

  /** Write up the month just ended. */
  private closeMonth(month: number) {
    const s = this.s;
    const st = s.stats;
    const l = s.lastLedger;
    const income = l.consult + l.treatment + l.classes + l.vending + l.shop + l.mushrooms + l.calls + l.bonus;
    const spending = l.salaries + l.building + l.upkeep + l.training + l.interest + l.marketing + l.fines;
    // the machines' running costs, shared out among those built
    const built = this.log.machines.filter((m) => m.site !== 'skipped');
    for (const m of built) m.upkeep += l.upkeep / built.length;
    const rec = s.months.at(-1);
    const wait = rec?.waitCount ? rec.waitTotal / rec.waitCount / DAY_SECONDS : null;
    this.log.months.push({
      month,
      money: Math.round(s.money),
      loan: s.loan,
      rep: Math.round(s.reputation * 10) / 10,
      repLow: Math.round(Math.min(this.repLow, s.reputation) * 10) / 10,
      stars: s.stars,
      grade: s.grade,
      standing: this.sim.standing().total,
      rival: rivalPoints(s),
      coty: s.trophies.filter((t) => t.award === 'center-of-the-year').length,
      staff: s.staff.filter((x) => x.state !== 'leaving').length,
      rooms: s.rooms.filter((r) => r.done).length,
      treatRooms: s.rooms.filter((r) => r.done && ROOMS[r.type].discipline).length,
      instructors: this.staffOf('instructor').length,
      stations: this.sim.arrivalPace().capacity.stations,
      guestCap: this.sim.guestCap(),
      arrived: st.arrived - this.monthStart.arrived,
      turnedAway: rec?.turnedAway ?? 0,
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
      incomeBy: {
        treatment: Math.round(l.treatment),
        consult: Math.round(l.consult),
        classes: Math.round(l.classes),
        calls: Math.round(l.calls),
        shop: Math.round(l.shop),
        mushrooms: Math.round(l.mushrooms),
        vending: Math.round(l.vending),
        bonus: Math.round(l.bonus),
      },
    });
    this.scans = 0;
    this.repLow = Infinity;
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
    if (this.markets()) this.market();
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
    // the share of all guests the price puts off, read from the Prices tab's chance rather than the month's count,
    // which on a quiet month is two balks read as a quarter: the chance is per new guest, and about three guests in
    // ten are new (the rest regulars and emergencies, who balk less or not at all)
    const putOff = putOffChance(s.priceLevel, s.reputation) * NEW_GUESTS;
    const wanted = Math.max(this.openGoal('reputation')?.percent ?? 0, 0);
    const falling = s.reputation < this.repAtReview - 4;
    let level = s.priceLevel;
    if (s.reputation < Math.max(wanted, 30) || putOff > this.style.putOff * 1.6 || (falling && s.reputation < 60))
      level -= 0.1;
    else if (putOff < this.style.putOff && s.reputation >= Math.max(wanted, 45) && !falling) level += 0.1;
    level = Math.round(Math.min(this.style.priceTop, Math.max(1, level)) * 10) / 10;
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
      const next = Math.round(Math.min(this.style.premiumTop, Math.max(1, own)) * 10) / 10;
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
    const reserve = this.reserve('marketing');
    const saving = this.saving();
    const repGoal = this.openGoal('reputation');
    const lines = DISCIPLINE_ORDER.map((d) => ({ d, m: this.seen[d] })).filter(
      (x): x is { d: Discipline; m: DisciplineMonth } => !!x.m && x.m.busy !== null,
    );
    const idle = lines.length > 0 && lines.every((x) => (x.m.busy ?? 0) < 0.5 && x.m.lost === 0);
    const needRep =
      (!!repGoal && s.reputation < repGoal.percent + 2 && s.reputation >= repGoal.percent - 8) ||
      (idle && s.reputation < 60 && this.profit() > 0 && !saving) ||
      this.style.marketing === 'always';
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
   * Through the summer, from the fortnight's warning: let in at once only as many guests as the staffed treatment
   * tables can see to (three a table, plus two a consultation room and a few at the desk), so the line never runs to
   * guests going home worse off; and lift the limit as autumn comes.
   */
  private throttle() {
    const s = this.s;
    if (!CENTERS[this.center].seasons) return;
    const summer = seasonOf(s.day) === 'summer' || seasonOf(s.day + SEASON_AHEAD_DAYS) === 'summer';
    if (!summer) {
      if (s.intakeCap !== null) {
        this.sim.setIntakeCap(null);
        this.note(`day ${Math.floor(s.day)}: summer over, no limit on guests at once`);
      }
      return;
    }
    let tables = 0;
    for (const it of s.items) {
      const d = ITEMS[it.type].station;
      if (d?.goal === 'treat' && this.sim.stationStaff(it))
        tables += d.group ? matsPlayed(this.sim.stationStaff(it)?.skill ?? 1) : 1;
    }
    const cap = Math.max(INTAKE_CAP_MIN, tables * 3 + this.rooms('consult').length * 2 + 3);
    if (s.intakeCap !== cap) {
      this.sim.setIntakeCap(cap);
      this.note(`day ${Math.floor(s.day)}: summer: ${cap} guests at once for ${tables} staffed tables`);
    }
  }

  /**
   * While the bank is calling the overdraft in: prices to the top, and then, while the books still lose money, let go
   * the practitioner doing least for their pay, one a day, never the last of a discipline, as a player with ten days
   * to put the books right would.
   */
  private rescue() {
    const s = this.s;
    if (daysUntilBankrupt(s) === null) return;
    this.rescuedOn = s.day;
    // whatever the style, as dear as the good bot would go: a style's own prices are for a center not in danger
    const top = Math.max(GOOD.priceTop, this.style.priceTop);
    if (s.priceLevel < top) {
      this.sim.setPrice(top);
      this.note(`day ${Math.floor(s.day)}: the bank is calling the overdraft in: prices to ${top}`);
    }
    if (projectedCashflow(s) >= 0) return;
    const now = this.sumUp();
    const spare = DISCIPLINE_ORDER.flatMap((d) => {
      const def = DISCIPLINES[d];
      const staff = this.staffOf(def.role).filter((st) => !st.training && !st.call && st.state !== 'away');
      if (staff.length < 2) return [];
      const busy = now[d]?.busy ?? 0;
      return staff.map((st) => ({ st, d, busy }));
    });
    const go = spare.sort((a, b) => a.busy - b.busy || a.st.skill - b.st.skill || b.st.salary - a.st.salary)[0];
    if (!go) return;
    this.sim.fire(go.st.id);
    this.benched[DISCIPLINES[go.d].room] = (this.benched[DISCIPLINES[go.d].room] ?? 0) + 1;
    this.note(
      `day ${Math.floor(s.day)}: the bank is calling the overdraft in: let a ${go.st.role} go, saving ${go.st.salary}, books now ${projectedCashflow(s)} a month`,
    );
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
    if (!who || (atWork.length < 2 && (this.waiting(role) > 2 || this.openGoal('monthHeals')))) return;
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
    if (this.mode === 'baseline') {
      this.decideThoughtless();
      return;
    }
    if (this.mode === 'advised') {
      this.decideAdvised();
      return;
    }
    if (this.flags.clear) this.freeTrapped();
    this.keepStaffHappy();
    this.handleEvents();
    this.manageLoan();
    if (!s.open) {
      this.buildOpening();
      return;
    }
    this.sampleLines();
    if (this.flags.throttle) this.throttle();
    if (this.flags.payroll) this.rescue();
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
    if (this.flags.machines) this.machines();
    this.decorate();
    this.comforts();
  }

  /**
   * The thoughtless baseline's day: the opening build, then raises and promotions when asked for (the game asks),
   * every emergency taken and every house call and outbreak turned down, fines paid, nothing done about a mishap,
   * the comforts the advisor asks for, heating when it is cold, a room (or a desk) and someone to work it only once a
   * line has formed for it and the money is in the bank, with no reserve kept for the wages, and never a price
   * changed, a course taken, a loan asked for, or anything built that a star unlocks.
   */
  private decideThoughtless() {
    const s = this.s;
    this.keepStaffHappy();
    if (s.offer) this.sim.acceptEmergency();
    if (s.outbreakOffer) this.sim.declineOutbreak();
    if (s.callOffer) this.sim.declineCall();
    if (s.visitReport?.bribe !== undefined) this.sim.settleInspection(false);
    if (!s.open) {
      this.buildOpening();
      return;
    }
    this.sampleLines();
    this.hireToFill();
    this.basics();
    this.growOnLines();
  }

  /**
   * A desk, a consulting room or a treatment room, with someone to work it, wherever a line has formed for one, if
   * its cost is in the bank: how a player who builds only when the guests are visibly piling up grows.
   */
  private growOnLines() {
    const s = this.s;
    const desks = this.count('reception_desk');
    if (this.waiting('receptionist') > desks * 5 && s.money > ITEMS.reception_desk.cost) {
      this.placeNearEntrance('reception_desk');
      this.hireToFill();
    }
    const consults = this.rooms('consult').length;
    if (this.waiting('consultant') > consults * 4 && s.money > price('consult')) {
      this.buildRoom('consult');
      this.hireToFill();
    }
    for (const d of DISCIPLINE_ORDER) {
      const room = TREAT_ROOM[d];
      const n = this.rooms(room).length;
      if (!n) continue;
      if (this.waiting(DISCIPLINES[d].role) > n * 3 && s.money > price(room) && this.buildRoom(room)) this.hireToFill();
    }
    const seats = this.count('bench') * 2;
    if (s.guests.length > seats + 2 && s.money > 400) this.placeNearEntrance('bench');
  }

  // ---- the advised persona -----------------------------------------------------

  /** The toasts heard since the advised bot last decided: the bad news and the plain news, and the bank letting off. */
  private heard: { text: string; about?: Subject | undefined }[] = [];
  /** What the bank last said while calling the overdraft in, until it says it is content; the summer notice heard. */
  private calledIn: string | null = null;
  private summerHeard = false;
  /** The day the advised bot last built for each stage the advisor named, so it sees what a build did first. */
  private grewStage: Partial<Record<string, number>> = {};
  /** The day the advised bot last cut on the advisor's "staff down first", so a daily nudge is one cut, not one a day. */
  private cutDay = -Infinity;

  /** Keep the toasts the advised bot reads; the other personas read none. */
  private hear(events: SimEvent[]) {
    if (this.mode !== 'advised') return;
    for (const e of events) {
      if (e.type !== 'toast') continue;
      if (e.kind === 'bad' || e.kind === 'info' || /no longer (being called|calling the overdraft)/.test(e.text))
        this.heard.push({ text: e.text, about: e.about });
    }
  }

  /** Note an action of the advised bot with the words that caused it, so the log shows the chain. */
  private heed(signal: string, action: string) {
    const said = signal.length > 70 ? `${signal.slice(0, 70)}…` : signal;
    this.note(`day ${Math.floor(this.s.day)}: "${said}" → ${action}`);
  }

  /**
   * The advised persona's day: everything the thoughtless baseline does, and then exactly what the game has said
   * since yesterday (its toasts) and says now (the advisor), each mapped to the lever its words name and no more.
   */
  private decideAdvised() {
    const s = this.s;
    this.decideThoughtless();
    const toasts = this.heard;
    this.heard = [];
    if (!s.open) return;
    for (const t of toasts) this.heedToast(t.text, t.about);
    const advice = this.sim.adviceNote();
    // the bank's countdown, every day of it: from the advisor when it says so, or from what the bank last said
    const countdown = advice.text.startsWith('The bank calls the overdraft in in') ? advice.text : this.calledIn;
    if (countdown) {
      this.priceUp(countdown);
      if (countdown.includes('losing')) this.letGo(countdown);
    }
    if (this.summerHeard) {
      this.throttle();
      if (seasonOf(s.day) !== 'summer' && seasonOf(s.day + SEASON_AHEAD_DAYS) !== 'summer') this.summerHeard = false;
    }
    this.heedAdvice(advice.text, advice.about);
  }

  /** Act on one toast, by the words the game uses for it. */
  private heedToast(text: string, about?: Subject) {
    if (text.startsWith('⚠️ Payday in')) {
      if (!text.includes("more than the bank and this month's pace will have")) return;
      this.priceUp(text);
      if (text.includes('with the books losing about')) this.letGo(text);
      return;
    }
    if (
      text.includes('The bank is calling the overdraft in') ||
      text.includes('days before the bank calls the overdraft in')
    ) {
      if (!this.calledIn) this.heed(text, 'prices up and staff down every day until the bank is content');
      this.calledIn = text;
      return;
    }
    if (/no longer (being called|calling the overdraft)/.test(text)) {
      if (this.calledIn) this.heed(text, 'the bank is content: stop');
      this.calledIn = null;
      return;
    }
    if (text.startsWith('⚠️ You are') && text.includes('borrow what is left from the Money menu')) {
      // the books losing money: prices up or staff down first, then borrow for what is left
      this.priceUp(text);
      this.letGo(text);
      if (this.s.money < 0 && this.sim.borrow()) this.heed(text, `borrowed a step, loan now ${this.s.loan}`);
      return;
    }
    if (
      about?.kind === 'guest' &&
      (text.includes('getting worse: shorten the line') || text.includes('will go home worse off in about'))
    ) {
      this.heedGuest(text, about.id);
      return;
    }
    if (text.startsWith('☀️ Summer in')) {
      this.summerHeard = true;
      this.heed(text, 'a limit on guests at once until autumn');
      return;
    }
    if (text.startsWith('❄️ Winter in')) this.letGo(text);
  }

  /** Act on the advisor's nudge, by its words. */
  private heedAdvice(text: string, about?: Subject) {
    const s = this.s;
    if (about?.kind === 'guest' && text.includes('goes home worse off in about')) {
      this.heedGuest(text, about.id);
      return;
    }
    // the payday the advisor says is not covered, with the books losing money: the cut it names, now and then
    if (text.startsWith('Payday in') && text.includes('Prices up or staff down first')) {
      if (s.day - this.cutDay < BUSY_DAYS) return;
      this.cutDay = s.day;
      this.priceUp(text);
      this.letGo(text);
      return;
    }
    if (text.startsWith('Guests wait longest for the ')) {
      this.heedBottleneck(text);
      return;
    }
    if (/a loan from the Money menu is cheaper/i.test(text)) {
      // while the books lose money it says to cut first: once in the days the bot's own look back covers
      if (text.includes('Prices up or staff down first') && s.day - this.cutDay >= BUSY_DAYS) {
        this.cutDay = s.day;
        this.priceUp(text);
        this.letGo(text);
      }
      if (this.sim.borrow()) this.heed(text, `borrowed a step, loan now ${s.loan}`);
      return;
    }
    if (text.includes('Build a Staff Room') && !this.sim.hasRoom('staffroom') && s.money > price('staffroom')) {
      if (this.buildRoom('staffroom')) this.heed(text, 'built a Staff Room');
      return;
    }
    // the staff asks: someone the advisor says to hire, by the role's name
    const asked = /Hire (?:a|an) ([A-Z][A-Za-z ]+?)(?: from| for| to|\.)/.exec(text)?.[1];
    const role = asked && (Object.keys(ROLES) as Role[]).find((r) => ROLES[r].name === asked);
    if (role && this.hire(role)) this.heed(text, `hired a ${role}`);
  }

  /** A guest the game warns about: to the front of their line, or home if they go home worse off in about a day. */
  private heedGuest(text: string, id: number) {
    const g = this.s.guests.find((x) => x.id === id);
    if (!g) return;
    if (/worse off in about 1 day(?!s)/.test(text)) {
      if (this.sim.sendHome(id)) this.heed(text, `sent ${g.name} home`);
      return;
    }
    const at = this.s.items.find((i) => i.id === g.station)?.queue.indexOf(id) ?? -1;
    if (at > 0 && this.sim.moveInLine(id, -at)) this.heed(text, `moved ${g.name} up ${at} to the front`);
  }

  /**
   * The stage the advisor says holds guests up, by the lever its words name: prices up when the books cannot carry
   * another wage, a Staff Room when there is none and breaks keep its staff away, a hire when there are too few to
   * staff it, or another of its room or desk, with someone to work it, when its cost is in the bank (a room let go of
   * first). Nothing when it names none. Once in the days the advisor looks back over, so it sees what the last step did.
   */
  private heedBottleneck(text: string) {
    const s = this.s;
    const stage = this.sim.bottleneck();
    const top = stage?.stations[0];
    const def = top && ITEMS[top.type].station;
    if (!stage || !def || s.day - (this.grewStage[stage.key] ?? -Infinity) < BUSY_DAYS) return;
    // the books cannot carry another: the lever it names instead
    if (text.includes('a month in the red: raise prices')) {
      this.grewStage[stage.key] = s.day;
      this.priceUp(text);
      return;
    }
    if (text.includes('Build a Staff Room nearby')) {
      if (this.sim.hasRoom('staffroom') || s.money <= price('staffroom')) return;
      this.grewStage[stage.key] = s.day;
      if (this.buildRoom('staffroom')) this.heed(text, 'built a Staff Room');
      return;
    }
    if (text.includes(': hire another.')) {
      this.grewStage[stage.key] = s.day;
      if (this.hire(def.staff)) this.heed(text, `hired a ${def.staff}`);
      return;
    }
    // no other lever named: more skill, or saving up first
    if (!text.includes('to work it would move them along') && !text.includes('would share the load')) return;
    const room: RoomType | null =
      stage.key === 'consult' || stage.key === 'assess'
        ? stage.key
        : stage.key in TREAT_ROOM
          ? TREAT_ROOM[stage.key as Discipline]
          : null;
    if (stage.key === 'reception') {
      if (s.money <= ITEMS.reception_desk.cost) return;
      this.grewStage[stage.key] = s.day;
      this.placeNearEntrance('reception_desk');
      this.hireToFill();
      this.heed(text, 'another Reception Desk and a receptionist');
      return;
    }
    if (!room) {
      this.heed(text, `no lever for the ${stage.key} stage`);
      this.grewStage[stage.key] = s.day;
      return;
    }
    if (this.benched[room]) {
      this.benched[room]--;
      this.grewStage[stage.key] = s.day;
      this.hireToFill();
      this.heed(text, `staffed a ${room} room let go of before`);
      return;
    }
    if (s.money <= price(room)) return;
    this.grewStage[stage.key] = s.day;
    if (!this.buildRoom(room)) {
      this.heed(text, `another ${room} room did not fit`);
      return;
    }
    this.hireToFill();
    this.heed(text, `built another ${room} room, money now ${Math.round(s.money)}`);
  }

  /** Prices up a step, to the bot's top at most. */
  private priceUp(signal: string) {
    const s = this.s;
    if (s.priceLevel >= this.style.priceTop - 1e-9) return;
    this.sim.setPrice(Math.min(this.style.priceTop, s.priceLevel + 0.1));
    this.heed(signal, `prices up to ${s.priceLevel.toFixed(1)}`);
  }

  /**
   * Let go the member of staff the game names, or with nobody named the least busy practitioner in a role with two or
   * more, as the game says to; never the last of one.
   */
  private letGo(signal: string) {
    // the one the game names, if it names someone
    const named = /Letting (.+?) go \(/.exec(signal)?.[1];
    const who = named && this.s.staff.find((st) => st.name === named && st.state !== 'leaving');
    if (who) {
      this.sim.fire(who.id);
      // their room or desk left without them, so the thoughtless refill does not hire them back
      const d = DISCIPLINE_ORDER.find((x) => DISCIPLINES[x].role === who.role);
      if (d) this.benched[DISCIPLINES[d].room] = (this.benched[DISCIPLINES[d].room] ?? 0) + 1;
      else if (who.role === 'consultant') this.benched.consult = (this.benched.consult ?? 0) + 1;
      else if (who.role === 'receptionist') this.benchedDesks++;
      this.heed(signal, `let ${who.name} go, a ${who.role}, saving ${who.salary}`);
      return;
    }
    const now = this.sumUp();
    const spare = DISCIPLINE_ORDER.flatMap((d) => {
      const staff = this.staffOf(DISCIPLINES[d].role).filter((st) => !st.training && !st.call && st.state !== 'away');
      return staff.length < 2 ? [] : staff.map((st) => ({ st, d, busy: now[d]?.busy ?? 0 }));
    });
    const go = spare.sort((a, b) => a.busy - b.busy || a.st.skill - b.st.skill || b.st.salary - a.st.salary)[0];
    if (!go) return;
    this.sim.fire(go.st.id);
    const room = DISCIPLINES[go.d].room;
    this.benched[room] = (this.benched[room] ?? 0) + 1;
    this.heed(signal, `let a ${go.st.role} go (busy ${Math.round(go.busy * 100)}%), saving ${go.st.salary}`);
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
    // (a style that borrows only what payday forces leaves it to the bank at payday)
    const asks = this.style.borrow !== 'payday';
    if (asks && s.money < wagesDue(s) && nearPayday) this.sim.borrow();
    // otherwise keep enough of the bank's limit back to borrow for the wages
    if (asks && s.money < 1500 && s.loan + wagesDue(s) <= loanLimit(s)) {
      if (this.sim.borrow()) this.note(`day ${Math.floor(s.day)}: borrowed, loan now ${s.loan}`);
    } else if (s.loan > 0 && s.money > this.reserve('repay')) this.sim.repay();
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
    const limit = this.style.borrow === 'limit';
    if ((!borrow && !limit) || this.style.borrow === 'payday') return false;
    const last = s.months.at(-1);
    const operating = last
      ? last.ledger.consult + last.ledger.treatment + last.ledger.vending + last.ledger.shop - last.ledger.salaries
      : 0;
    if (!limit && s.months.length && operating < 0 && s.loan >= 25000) return false;
    // keeping enough of the bank's limit back to borrow for a payday the takings might not meet
    // (a first month's payroll is not on the books yet while the staff are still being taken on); to the limit, none
    const headroom = limit ? 0 : Math.max(wagesDue(s), FIRST_PAYROLL);
    if (s.loan + headroom > loanLimit(s)) return false;
    // and with the next payday still covered, since a payday the bank cannot meet is a loan, or the end
    while (s.money < cost + Math.max(1000, wagesDue(s))) {
      if (s.loan + LOAN_STEP + headroom > loanLimit(s) || !this.sim.borrow()) return false;
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

  /** What the bot's style keeps back for something, or above which it pays the loan back, at today's wages. */
  private reserve(what: ReservePurpose | 'repay') {
    const r = what === 'repay' ? this.style.repay : this.style.reserve[what];
    return this.wages() * r.k + r.c;
  }

  /** Whether the bot markets at all: the flag, and a style that does. */
  private markets() {
    return this.flags.marketing && this.style.marketing !== 'never';
  }

  /** Keep a line about something the bot did, up to a limit. */
  private note(text: string) {
    if (this.log.notes.length < (this.mode === 'advised' ? 3000 : 150)) this.log.notes.push(text);
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
  /** The finished machine rooms of a discipline. */
  private machineRooms(d: Discipline): Room[] {
    return this.s.rooms.filter(
      (r) => r.done && ROOMS[r.type].discipline === d && ROOMS[r.type].required.some((t) => ITEMS[t].machine),
    );
  }

  /**
   * Build a room of a type with its furniture and any extras, somewhere along the walls. A spot that would leave no
   * space for a room of a type in `keep` is given up while the room is still a plan, as a player would.
   */
  buildRoom(type: RoomType, extras: ItemType[] = [], keep: RoomType[] = []): Room | null {
    const def = ROOMS[type];
    const extraCost = extras.reduce((a, t) => a + ITEMS[t].cost, 0);
    // the room at the size it builds it, any floor past what its price covers included
    if (this.s.money < price(type) + extraCost + 500) return null;
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
      this.afford(offer.price + price(type) + extraCost, 0, true) &&
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
    if (!this.markets() || !s.open) {
      this.hire(role);
      return;
    }
    const best = Math.max(0, ...s.candidates.filter((c) => c.role === role).map((c) => c.skill));
    const since = (this.waitingToHire[role] ??= s.day);
    if (best >= 2 || (best > 0 && s.day - since >= 7)) {
      if (this.hire(role)) this.waitingToHire = { ...this.waitingToHire, [role]: undefined };
      return;
    }
    if (!this.running('recruit') && s.money > this.reserve('recruit') && !this.saving())
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
    if (this.staffOf('receptionist').length < desks - this.benchedDesks) this.hire('receptionist');
    const consultRooms = this.rooms('consult').length + this.rooms('assess').length - (this.benched.consult ?? 0);
    if (this.staffOf('consultant').length < consultRooms) this.hire('consultant');
    for (const d of DISCIPLINE_ORDER) {
      const def = DISCIPLINES[d];
      // a machine room is a station more, so its chair takes no one from a table
      const rooms = this.rooms(def.room).length - (this.benched[def.room] ?? 0) + this.machineRooms(d).length;
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
    const reserve = this.reserve('basics');
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
    const reserve = this.reserve('unlocks');
    // a Training Room as soon as anyone on the payroll is not trained in something guests now arrive needing
    const untrained =
      s.staff.some((st) => this.sim.courses(st).some((c) => c.id in MODALITIES)) ||
      (this.flags.kit && upTo >= 1 && !this.mechanic());
    if (untrained && !this.sim.hasRoom('training') && this.afford(price('training') + 400, 0, true))
      this.buildRoom('training');
    for (const d of DISCIPLINE_ORDER) {
      if (d === 'massage' || !disciplineOn(s, d)) continue;
      const room = TREAT_ROOM[d];
      const unlock = ROOMS[room].unlock ?? 0;
      if (this.saving() && !this.goalNeeds(d)) continue;
      if (upTo >= unlock && !this.sim.hasRoom(room) && this.afford(price(room) + 2000, reserve * 0.5, true)) {
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
    const reserve = this.reserve('training');
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

  /**
   * The center's own machine room, once its star is earned, while the center pays its way and the bot is not saving,
   * with the money for a few months' running in hand; and a practitioner sent on its course once it stands. It is a
   * station more, so it goes on free floor or on land bought for it, never where a room was knocked down: when nothing
   * fits, it waits for a month the bot can buy land.
   */
  private machines() {
    const s = this.s;
    for (const type of ROOM_ORDER) {
      const def = ROOMS[type];
      const machine = def.required.find((t) => ITEMS[t].machine);
      // the Carousel of Rebirth is for karma, which the bot does not spend
      if (!machine || !def.only?.includes(s.center) || !def.discipline || !disciplineOn(s, def.discipline)) continue;
      if (this.sim.hasRoom(type)) {
        this.trainOperator(machine, def.discipline);
        continue;
      }
      if ((def.unlock ?? 0) > unlockedUpTo(s) || this.saving() !== null || this.profit() <= 0) continue;
      const upkeep = ITEMS[machine].machine?.upkeep ?? 0;
      if (!this.afford(def.cost, this.wages() * 1.2 + upkeep * 3 + 2000)) continue;
      let log = this.log.machines.find((m) => m.room === type);
      if (!log) {
        log = {
          room: type,
          day: Math.floor(s.day),
          site: 'skipped',
          skipped: 0,
          cost: def.cost,
          earned: 0,
          healed: 0,
          upkeep: 0,
          paybackDay: null,
        };
        this.log.machines.push(log);
        this.landWhenWanted[type] = s.land.length;
      }
      const room = this.buildRoom(type);
      const month = Math.floor(s.day / DAYS_PER_MONTH);
      if (!room) {
        if (this.skippedIn[type] !== month) {
          this.skippedIn[type] = month;
          log.skipped++;
        }
        continue;
      }
      // on land bought since the bot first wanted it, it is an expansion; anywhere else, the floor was free
      const bought = s.land.slice(this.landWhenWanted[type] ?? s.land.length).flatMap((l) => l.rects);
      const onBought = bought.some(
        (r) => room.x <= r.x1 && room.x + room.w - 1 >= r.x0 && room.y <= r.y1 && room.y + room.h - 1 >= r.y0,
      );
      log.site = onBought ? 'expansion' : 'floor';
      log.day = Math.floor(s.day);
      this.note(`day ${Math.floor(s.day)}: built a ${def.name}${onBought ? ', on the land bought for it' : ''}`);
      this.hireToFill();
    }
  }

  /** The number of plots bought when the bot first wanted each machine, to tell an expansion from free floor. */
  private landWhenWanted: Partial<Record<RoomType, number>> = {};
  /** The month each machine was last put off for want of space. */
  private skippedIn: Partial<Record<RoomType, number>> = {};

  /** Send the best practitioner of a machine's discipline on its course, if nobody knows it or is learning it. */
  private trainOperator(machine: ItemType, discipline: Discipline) {
    const s = this.s;
    // a machine is no use without someone trained to run it, so a Training Room comes first
    if (!this.sim.hasRoom('training')) {
      if (this.afford(price('training') + 400, 0, true) && this.buildRoom('training'))
        this.note(`day ${Math.floor(s.day)}: a Training Room, for the ${ITEMS[machine].name}`);
      return;
    }
    const role = DISCIPLINES[discipline].role;
    for (const m of ITEMS[machine].machine?.performs ?? []) {
      const staff = this.staffOf(role);
      if (staff.some((st) => st.quals.includes(m) || st.training?.course === m)) continue;
      // the best practitioner with a qualification to spare, who is not away
      const free = staff
        .filter((st) => !st.training && !st.call && this.sim.courses(st).some((c) => c.id === m))
        .sort((a, b) => b.skill - a.skill);
      const pick = free[0];
      if (!pick) {
        // everyone's qualifications are full: take on someone new to run it, as a player would, now and then
        if ((this.operatorHired[m] ?? -Infinity) + 10 <= s.day && this.hire(role)) {
          this.operatorHired[m] = s.day;
          this.note(`day ${Math.floor(s.day)}: hired a ${role} to run the ${ITEMS[machine].name}`);
        }
        continue;
      }
      const course = this.sim.courses(pick).find((c) => c.id === m);
      if (course && this.afford(course.cost, 1000, true) && this.sim.train(pick.id, m))
        this.note(`day ${Math.floor(s.day)}: sent a ${role} on the ${MODALITIES[m].name} course`);
    }
  }

  /** The day the bot last took someone on to run a machine, by its technique. */
  private operatorHired: Partial<Record<Modality, number>> = {};

  /** The guests in each machine, and what they had spent when they went in, to count what it earns. */
  private inMachine = new Map<number, { room: RoomType; spent: number }>();

  /** Note who is in each machine, and count what it earned from those who have come out healed. */
  private watchMachines() {
    const s = this.s;
    for (const g of s.guests) {
      const it = g.state === 'served' ? this.sim.world.item(g.station) : undefined;
      const room = it && ITEMS[it.type].machine ? machineRoom(it.type) : undefined;
      if (room && !this.inMachine.has(g.id)) this.inMachine.set(g.id, { room, spent: g.spent });
    }
    for (const [id, seen] of this.inMachine) {
      const g = this.sim.guest(id);
      if (g && !g.outcome) continue;
      this.inMachine.delete(id);
      const log = this.log.machines.find((m) => m.room === seen.room && m.site !== 'skipped');
      if (g?.outcome !== 'healed' || !log) continue;
      log.earned += g.spent - seen.spent;
      log.healed++;
      if (log.paybackDay === null && log.earned >= log.cost + log.upkeep) log.paybackDay = Math.floor(s.day);
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
    if (!this.afford(price('assess'), this.reserve('growth'))) return;
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
    const reserve = this.reserve('growth');
    const desks = this.count('reception_desk');
    if (this.waiting('receptionist') > desks * 5 && s.money > 2500 + reserve) {
      this.placeNearEntrance('reception_desk');
      this.hireToFill();
    }
    const consults = this.rooms('consult').length;
    if (this.waiting('consultant') > consults * 4 && this.afford(price('consult'), reserve * 0.5, true)) {
      if (!this.sim.hasRoom('assess') && s.money > price('assess') + reserve) this.buildRoom('assess');
      else this.buildRoom('consult');
      this.hireToFill();
    }
    for (const d of DISCIPLINE_ORDER) {
      const room = TREAT_ROOM[d];
      const n = this.rooms(room).length;
      if (!n) continue;
      const role = DISCIPLINES[d].role;
      if (this.waiting(role) > n * 3 && this.afford(price(room), reserve * 0.5, true)) {
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
    // a month after the bank called the overdraft in, nothing is added back: the books have to show a month in profit first
    if (s.day - this.rescuedOn < DAYS_PER_MONTH) return;
    const reserve = this.reserve('growth');
    const saving = this.saving();
    if (this.profit() > 0 && !saving) {
      const desks = this.count('reception_desk');
      if (this.waiting('receptionist') > desks * 5 && s.money > 2500 + reserve) {
        this.placeNearEntrance('reception_desk');
        this.hireToFill();
      }
      const consults = this.rooms('consult').length;
      // a building at its limit keeps the line from growing to show it: guests turned away last month count toward
      // another room too, while two or more wait for each consultation
      const full = (this.s.months.at(-1)?.turnedAway ?? 0) >= 3 && this.waiting('consultant') >= consults * 2;
      if ((this.waiting('consultant') > consults * 4 || full) && this.afford(price('consult'), reserve * 0.5, true)) {
        if (!this.sim.hasRoom('assess') && s.money > price('assess') + reserve) this.buildRoom('assess');
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
      const cost = price(room);
      if (saving && value * 3 < cost) continue;
      if (!this.afford(cost + 1000, reserve * 0.5, value * this.style.borrowPayback > cost)) continue;
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
   * waiting for the treatment last month, those waiting beyond one a room, its share of those who found the center
   * full, and the guests a staffed station more draws in all), as many as the coming season brings,
   * healed at the rate the discipline heals and paying its fees, less a practitioner's pay and, for a new room, its
   * cost spread over a year.
   */
  private roomValue(d: Discipline): number {
    const m = this.seen[d];
    if (!m) return 0;
    const def = DISCIPLINES[d];
    const rooms = Math.max(1, this.rooms(def.room).length - (this.benched[def.room] ?? 0));
    // guests who found the center full last month would have come for this discipline by its share of treatments
    const treated = DISCIPLINE_ORDER.reduce((a, x) => a + (this.seen[x]?.treated ?? 0), 0);
    const full = (this.s.months.at(-1)?.turnedAway ?? 0) * (treated ? m.treated / treated : 0);
    // and a staffed station more draws guests more often in all, and lets more in at once
    const last = this.s.months.at(-1);
    const pace = this.sim.arrivalPace();
    const drawn = last ? ((last.arrived + (last.turnedAway ?? 0)) * CAPACITY_ARRIVALS.each) / pace.staffed : 0;
    const guests = (m.lost + full + drawn + Math.max(0, m.line - rooms)) * this.ahead(3);
    const rate = m.treated >= 3 ? m.healed / m.treated : 0.6;
    const room = this.benched[def.room] ? 0 : price(def.room) / this.style.payback;
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
    const reserve = this.reserve('kit');
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
    const reserve = this.reserve('classes');
    if (!this.sim.hasRoom('qigong')) {
      if (this.saving() || this.profit() <= 0 || !this.afford(price('qigong') + 3000, reserve)) return;
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
    const reserve = this.reserve('decor');
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
      if (this.flags.layout && !this.openGoal('monthHeals')) {
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
    const reserve = this.reserve('comforts');
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
