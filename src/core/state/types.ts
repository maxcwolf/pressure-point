// The shape of a game in progress. Everything here is plain JSON, so saving is a stringify away.

import type {
  AchievementId,
  Aspect,
  AwardId,
  CampaignKind,
  CenterId,
  ConditionId,
  Difficulty,
  Discipline,
  Duty,
  FeelingId,
  FloorId,
  GeneralId,
  GoalSpec,
  ItemType,
  Land,
  MishapId,
  Modality,
  Offering,
  Pose,
  Priced,
  Role,
  RoomType,
  RugPatternId,
  SceneIconId,
  Sex,
  ThermostatSetting,
  TraitId,
  WallId,
} from '../data';

/** An icon that can show in a speech bubble over someone's head. */
export type BubbleId = Extract<SceneIconId, `bubble-${string}`>;

export interface Room {
  id: number;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Inside tile of the door plus the outward direction. */
  door: WallSpot;
  /** Windows, each on one tile's worth of wall. */
  windows: WallSpot[];
  /** True once the room has been built: every required item placed and the blueprint confirmed. */
  done: boolean;
  /** Staff fill its stations, and caretakers see to it, before anywhere else. */
  priority: boolean;
  /** The bad vibes a failed treatment left in it, from 0 (none) to 100, until someone clears them. */
  vibes: number;
  /** Whoever is on their way to clear its bad vibes. */
  claimedBy: number;
  /**
   * Tiles of floor paid for beyond the smallest a room of its kind can be, when it was built and by resizing it since:
   * only these are refunded when given up.
   */
  bought?: number;
  /** How it is decorated, if not as standard. */
  floor?: FloorId;
  wall?: WallId;
  /** A Qi Gong Studio's timetable: the days of the week, from Monday as 0, it holds classes, if not the usual. */
  classDays?: number[];
  /** A Qi Gong Studio's next or latest class: its day, how many booked a place, and how many found it full. */
  booked?: ClassBooking;
  /** The day a Qi Gong Studio last started a class, so each class day has one class. */
  lastClass?: number;
  /** A Qi Gong Studio's latest class days that passed without a class, and why, to tell its class-goers. */
  missed?: MissedClass[];
  /** The day a Shaman's blessing on it runs out, once it has had one. */
  blessedUntil?: number;
}

/**
 * Why a class-goer went home without a class: no Instructor on the payroll, the Instructor resting or otherwise away
 * from the mat on the day, the class before still going, they got there after it ended, the day taken off the
 * timetable, no Practice Spot to use, or every place in the class taken by others.
 */
export type ClassMiss = 'no-instructor' | 'break' | 'no-lead' | 'overran' | 'late' | 'off' | 'no-spot' | 'full';

/** A class day that passed without a class, and why. */
export interface MissedClass {
  day: number;
  why: ClassMiss;
}

/**
 * How a Qi Gong class filled up: its day, how many booked a place, and how many were turned away; or that nobody was
 * booked, the Instructor being away from the studio as it was booked.
 */
export interface ClassBooking {
  day: number;
  count: number;
  turned: number;
  away?: boolean;
}

/** A class-goer due to arrive: when, and the day of the class they booked. */
export interface Arrival {
  at: number;
  day: number;
}

/** A room's floor and walls, where they are not standard. */
export interface RoomDecor {
  floor?: FloorId;
  wall?: WallId;
}

/** One tile's worth of a room's wall: the tile just inside it, and the direction pointing out. */
export interface WallSpot {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface Item {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  rot: number;
  /** Character id occupying each access spot (0 = free). Used for seats and facilities. */
  users: number[];
  // station state
  queue: number[];
  serving: number;
  staffId: number;
  progress: number;
  /** How much of the time a station has had a guest called or in hand, and has stood staffed, over the last few days. */
  busy?: number;
  staffed?: number;
  /** A plant's water, a stone warmer's heat, or how many soiled sets of linens are in a hamper. */
  water: number;
  /** 0 is new, 100 is broken. */
  wear: number;
  /** 0 is spotless, 100 is filthy. */
  dirt: number;
  /** Caretaker currently heading over to deal with it. */
  claimedBy: number;
  /** How many times treatment equipment has been upgraded, from 0 up to `UPGRADE_LEVELS`. */
  level: number;
  /** The next upgrade has been paid for and is waiting for a Mechanic to install it. */
  upgradePaid: boolean;
  /** A rug's pattern, when it is not the original Kilim. */
  pattern?: RugPatternId;
  /** How a heater or air conditioner's thermostat is set, when it is not on Auto. */
  thermostat?: ThermostatSetting;
  /** The award a Certificate of Excellence was earned for. */
  trophy?: Trophy;
  /** A treatment machine that overloaded, out of action until a Caretaker has repaired it. */
  overloaded?: boolean;
}

export interface Look {
  skin: number;
  hair: number;
  hairStyle: number;
  top: number;
  bottom: number;
  scale: number;
  /** Whether they are a woman or a man: their hair and first name follow it. */
  sex: Sex;
  /** A man's facial hair: 0 none, 1 a moustache, 2 a beard. */
  beard: number;
  /** 0 slight, 1 average, 2 stocky; a number already in saves never changes meaning. */
  build: number;
  /** 0 none, 1 round, 2 square; a number already in saves never changes meaning. */
  glasses: number;
}

interface CharBase {
  id: number;
  name: string;
  x: number;
  y: number;
  /** Logical grid tile, used as the pathfinding origin. */
  tx: number;
  ty: number;
  facing: number;
  /** Waypoints: [x, y, isPosePoint]. */
  path: Waypoint[] | null;
  dest: Destination | null;
  pose: Pose;
  h: number;
  busy: boolean;
  /** Pose to adopt on reaching a pose waypoint. */
  endPose: Pose;
  endH: number;
  endFace: number;
  look: Look;
  /** The speech bubble over their head, if any: one of the scene's bubble icons. */
  bubble: BubbleId | '';
  bubbleT: number;
  /** Item access spot currently claimed (seat, facility, sofa). */
  claimItem: number;
  claimIdx: number;
  timer: number;
}

export type StaffState =
  | 'arriving'
  | 'idle'
  | 'wander'
  | 'toPost'
  | 'atPost'
  | 'toBreak'
  | 'onBreak'
  | 'toJob'
  | 'doingJob'
  | 'toTrain'
  | 'training'
  | 'toCall'
  | 'away'
  | 'leaving';

/** A house call a member of staff is out on: who for, how long, when they are back, and what it pays when they are. */
export interface Call {
  client: string;
  days: number;
  /** The game day they are back: counted from when they set off down the street. */
  back: number;
  /**
   * What it pays at standard prices, for the rank they went at, and what sets its price on the day they are back: the
   * overall level, or the technique it asked for. A call taken before calls were priced on the way back has no
   * `pricedBy`, and pays the fee fixed as it was taken.
   */
  fee: number;
  pricedBy?: Modality | 'level';
}

export interface Staff extends CharBase {
  kind: 'staff';
  role: Role;
  /** Their rank, from 1 to 5: how skilled they are. */
  skill: number;
  /** Experience from the work they have done, toward their next rank. */
  xp: number;
  /** Ready for promotion, and waiting on it. */
  promotion: boolean;
  /** General courses passed, beyond the treatments of their discipline. */
  general: GeneralId[];
  /** Duties they are kept from. */
  off: Duty[];
  /** The rooms they are assigned to work in, or none to work anywhere. */
  rooms: number[];
  /** The day by which they will take the rival's job offer unless cheered up, or 0 for no offer. */
  offer: number;
  /** The house call they are on, if any. */
  call: Call | null;
  salary: number;
  /** The day their pay is settled up to: payday pays from here, and leaving pays from here. */
  paidTo: number;
  traits: TraitId[];
  energy: number;
  /** 0 to 100: how much they want a drink, and a snack, seen to between jobs. */
  thirst: number;
  hunger: number;
  state: StaffState;
  /** Station item this staff member is assigned to. */
  post: number;
  job: Job | null;
  served: number;
  /** Modalities of their discipline this member of staff is qualified in. */
  quals: Modality[];
  /** The course they are on, if any. */
  training: Enrollment | null;
  /** Energy-drain multiplier of the session in progress. */
  strain: number;
  /** 0 to 100. Low morale means slow work, then a demand for a raise, then a resignation. */
  morale: number;
  raiseAsked: boolean;
  /** Seconds spent miserable; they quit when it runs too long. */
  unhappyT: number;
  /** Guests served, or jobs done, since the year began, for the year-end awards. */
  yearServed: number;
  /** A Shaman has been asked to retrieve their soul, and has not yet. */
  soulAsked?: boolean;
}

/**
 * A chore: the litter or item a Caretaker sees to (changing a table's linens is cleaning it, and laundering is emptying
 * a hamper), the room someone clears of bad vibes, the drink or snack someone goes to for themselves, or the guest on
 * a really bad trip someone is sent to calm down.
 */
export interface Job {
  kind:
    'litter' | 'water' | 'repair' | 'clean' | 'smudge' | 'launder' | 'refresh' | 'install' | 'soul' | 'ward' | 'calm';
  id: number;
}

/** Something staff can study: a modality, a general course, or (on a course begun before ranks) a step up in skill. */
export type CourseId = Modality | GeneralId | 'skill';

/** A course in progress. The fee is kept so it can be refunded if the course is cut short. */
export interface Enrollment {
  course: CourseId;
  progress: number;
  seconds: number;
  cost: number;
}

/** The step of a visit a guest is on. */
export type GuestGoal = 'reception' | 'consult' | 'assess' | 'treat' | 'class' | 'shop' | 'leave';
/** Something a guest breaks off waiting to see to. */
export type Need = 'drink' | 'eat' | 'toilet' | 'play';
/** How a guest's visit ended. */
export type Outcome = 'healed' | 'failed' | 'stormed' | 'sent' | 'worse' | 'class';

export type GuestState =
  | 'enter'
  | 'toWait'
  | 'waiting'
  | 'called'
  | 'served'
  | 'toRest'
  | 'resting'
  | 'toNeed'
  | 'need'
  | 'running'
  | 'leaving';

export interface Guest extends CharBase {
  kind: 'guest';
  condition: ConditionId;
  goal: GuestGoal;
  state: GuestState;
  station: number;
  needKind: Need | '';
  thirst: number;
  hunger: number;
  bladder: number;
  patience: number;
  /** The lowest their patience has fallen this visit: what the waiting cost them. Missing in saves from before it was kept. */
  lowest?: number;
  diagnosis: number;
  consults: number;
  /** Had a posture scan, which makes their treatment likelier to work. */
  scanned?: boolean;
  outcome: Outcome | '';
  spent: number;
  hasWrapper: boolean;
  waited: number;
  /** Arrived as part of an emergency. */
  emergency: boolean;
  /** Put in their line by the player, so they stay in it rather than look for a shorter one. */
  placed: boolean;
  /** What they have felt about their visit so far, each once. */
  feelings: FeelingId[];
  /** How they are holding up, from 100 down: it worsens while they wait, and at 0 they leave worse off. */
  health: number;
  /** Caught the stress going around in an outbreak, and spreading it. */
  stressed: boolean;
  /** Given a calming session in an outbreak, so it cannot catch them. */
  calmed: boolean;
  /** On a really bad trip, running round the institute: the seconds left before they find the door. */
  runaway?: number;
  /** For a class-goer, the day of the Qi Gong class they came for; 0 for anyone come for a treatment. */
  classDay: number;
  /** For a class-goer who went home without a class, why. */
  missed?: ClassMiss;
  /** For a regular back for another visit, who they are among the regulars. */
  regular?: number;
}

/** A guest who enjoyed their visit and comes back every few weeks, greeted by name. */
export interface Regular {
  /** Who they are among the regulars: the id they had on their first visit. */
  id: number;
  name: string;
  look: Look;
  /** Visits made so far, the first included. */
  visits: number;
  /** How attached they are to the center, from 0 to 100. Good visits raise it, bad ones lower it, and at 0 they stop
   * coming. */
  loyalty: number;
  /** The game day they are due back. */
  due: number;
}

/** Who a visitor is: a VIP, or the health inspector. */
export type VisitorKind = 'vip' | 'inspector';

/** What a visitor is doing: on the way to a room, looking round it, or on the way out. */
export type VisitorState = 'toRoom' | 'looking' | 'leaving';

/** What a visitor made of one room. */
export interface RoomVerdict {
  room: number;
  name: string;
  /** From 0 to 100: for a VIP how much they liked it, for the inspector how well it did. */
  score: number;
  note: string;
  /** What the inspector found wrong in it. Empty for a VIP. */
  problems: string[];
}

/** Someone touring the center to judge it. */
export interface Visitor extends CharBase {
  kind: 'visitor';
  visit: VisitorKind;
  /** Who they are, in a few words: a VIP's line of work, or "the health inspector". */
  title: string;
  /** What a VIP cares about most. Absent for the inspector, who goes by the rules. */
  cares?: Aspect;
  state: VisitorState;
  /** The rooms still to see, by id, the one being seen or walked to first. */
  tour: number[];
  /** What they made of each room seen so far. */
  seen: RoomVerdict[];
}

/** A visit written ahead: who is coming, and on which day. */
export interface VisitNotice {
  visit: VisitorKind;
  name: string;
  title: string;
  cares?: Aspect;
  arrives: number;
}

/** How a visit went, kept until the next one. */
export interface VisitReport {
  visit: VisitorKind;
  name: string;
  title: string;
  day: number;
  rooms: RoomVerdict[];
  /** A VIP's verdict from 0 to 100, or the number of problems the inspector found. */
  score: number;
  outcome: 'delighted' | 'satisfied' | 'disappointed' | 'passed' | 'failed' | 'paid off';
  /** What it brought in, or (below zero) what it cost, in money and reputation. */
  money: number;
  rep: number;
  /**
   * For a failed inspection still to be settled: what it would take to make it go away. Paying the fine or the bribe
   * settles it, and its report stays until one is chosen.
   */
  bribe?: number;
}

export type Char = Staff | Guest | Visitor;

/** A point on a route. `pose` is 1 for the final step off the grid into a seat, onto a table and so on. */
export type Waypoint = [x: number, y: number, pose: number];

/** Where someone is headed: the tile, then the pose point beyond it and whether there is one. */
export type Destination = [tx: number, ty: number, px: number, py: number, hasPose: number];

export interface Litter {
  id: number;
  x: number;
  y: number;
  claimedBy: number;
  /** A puddle of kombucha rather than a wrapper: it slows whoever walks through it. */
  puddle?: boolean;
  /** Sea water from a storm, by the id of the restroom it flooded: the room is out of action until it is mopped up. */
  flood?: number;
}

export interface Candidate {
  id: number;
  name: string;
  role: Role;
  skill: number;
  salary: number;
  traits: TraitId[];
  quals: Modality[];
  look: Look;
}

export interface Ledger {
  consult: number;
  treatment: number;
  vending: number;
  salaries: number;
  building: number;
  training: number;
  interest: number;
  /** Emergency rewards, and other prizes and rewards. */
  bonus: number;
  /** Sales at the Shop Counter. */
  shop: number;
  /** Fees for house calls. */
  calls: number;
  /** Marketing campaigns. */
  marketing: number;
  /** Fines, such as the health inspector's. */
  fines: number;
  /** What treatment machines cost to run, in power and parts each month, and in repairs when they overload. */
  upkeep: number;
  /** Fees for places in Qi Gong classes. */
  classes: number;
  /** Magic mushrooms sold under the Shop Counter. */
  mushrooms: number;
}

/** A marketing campaign: for word of mouth, for more guests with one condition, or for applicants. */
export interface Campaign {
  kind: CampaignKind;
  /** The condition a condition campaign is for. */
  condition?: ConditionId;
  /** The game day it ends. */
  until: number;
}

/** An offer to send someone out for a day or more, to an office, a hotel or a home. */
export interface HouseCall {
  client: string;
  days: number;
  /** What it pays for each day, for someone of the first rank; more for higher ranks. */
  perDay: number;
  /** The discipline it is for, and a technique it asks for, if any. */
  discipline: Discipline;
  modality?: Modality;
  /** The game day the offer lapses. */
  deadline: number;
}

/** A batch of guests with one condition, to be healed against the clock for a reward. */
export interface Emergency {
  condition: ConditionId;
  cause: string;
  total: number;
  target: number;
  healed: number;
  /** Guests still to arrive. */
  pending: number;
  reward: number;
  /** Game day the offer lapses, or the accepted emergency ends. */
  deadline: number;
}

/** A stress outbreak: on offer, or in progress, with calming sessions to hand out to the guests carrying it. */
export interface Outbreak {
  cause: string;
  /** Guests it starts with. */
  seed: number;
  /** Calming sessions left to hand out. */
  calms: number;
  /** Carriers who have left still stressed, and how many may before it counts as a failure. */
  lost: number;
  lostMax: number;
  reward: number;
  /** Carriers still to be chosen from the next guests to arrive. */
  pending: number;
  /** Game day the offer lapses, or the outbreak in progress ends. */
  deadline: number;
}

/** Running totals of how guests' visits have gone. */
export interface Stats {
  healed: number;
  failed: number;
  /** Ran out of patience waiting. */
  stormed: number;
  /** Turned down the treatment once they heard what it cost. */
  priced: number;
  /** Sent home by the player. */
  sent: number;
  /** Got worse while they waited, and left. */
  worse: number;
  arrived: number;
  /** Would have come, but found the center full: at the building's limit, or the player's own. */
  turnedAway: number;
  /** Guests healed, by the discipline that healed them. */
  healedBy: Partial<Record<Discipline, number>>;
  /** Emergencies seen through successfully. */
  emergencies: number;
  /** The game day someone last quit, or -1 if nobody ever has. */
  lastQuit: number;
  /** Qi Gong classes held, and the class-goers who came to them. */
  classes: number;
  classgoers: number;
}

/** A month's count of guests: how many came, how each visit ended, and how long they waited. */
export interface Tally {
  arrived: number;
  /** Guests who would have come but found the center full; missing from months before it was counted. */
  turnedAway?: number;
  healed: number;
  failed: number;
  stormed: number;
  priced: number;
  sent: number;
  worse: number;
  /** Seconds spent waiting, summed over the guests who left this month, and how many they were: all but those put off by the prices. */
  waitTotal: number;
  waitCount: number;
  /** The lowest each of those guests' patience fell during their visit, summed (0 to 100 each); missing from months before it was kept. */
  patienceTotal?: number;
  /** Guests healed, by the discipline that healed them. */
  healedBy: Partial<Record<Discipline, number>>;
  /** Class-goers who came to a Qi Gong class. */
  classgoers: number;
}

/** A finished month: its tally and its books, and how the center stood at the end of it. */
export interface MonthRecord extends Tally {
  ledger: Ledger;
  reputation: number;
  money: number;
}

/** The rules the player sets for how the center is run. */
export interface Policy {
  /** How sure a diagnosis must be before a guest goes for treatment, from 0.5 to 0.95. */
  diagnosis: number;
  /** Emergency guests are called before anyone else in line. */
  emergenciesFirst: boolean;
  /** The energy at which staff stop for a break. */
  breakAt: number;
  /** How many of each role may be on a break at once. Absent means no limit. */
  breakLimit: Partial<Record<Role, number>>;
  /** Put the mushrooms away under the Shop Counter as soon as the health inspector writes ahead. */
  stashMushrooms: boolean;
}

/** An objective a member of staff sets the center, with a deadline and a reward. */
export interface Challenge {
  /** Who set it, kept by name too in case they leave. */
  staffId: number;
  staffName: string;
  goal: GoalSpec;
  /** For a count, where it stood when the challenge was set, since the challenge asks for that many more. */
  from: number;
  /** The game day it was set, and the day it must be met by. */
  set: number;
  deadline: number;
  /** What meeting it pays the center. */
  reward: number;
}

/** One award at a year-end ceremony: whether it was won, how the center did, and who won it, if it goes to someone. */
export interface AwardResult {
  award: AwardId;
  won: boolean;
  /** How the center did against what it took, in a few words. */
  note: string;
  /** The member of staff it went to, by name. */
  winner?: string;
}

/** A year-end awards ceremony. */
/** A mishap announced ahead: what it is, when it starts and ends, whether it was prepared for, and whether it has begun. */
export interface Mishap {
  kind: MishapId;
  starts: number;
  ends: number;
  prepared: boolean;
  started: boolean;
  /** A Shaman's ward against it: asked for, or performed. It holds, or not, as the mishap starts. */
  ward?: 'asked' | 'done';
}

/** The rival center across the street: when it has a sale on, and what it has done to the center so far. */
export interface Rival {
  /** The day it opened, or null until it does. */
  opened: number | null;
  /** The day its sale ends, or 0 when none is on, and the day the next may start. */
  saleUntil: number;
  nextSale: number;
  /** The day it next tries to hire someone away. */
  nextPoach: number;
  /** Staff it has hired away, and Center of the Year awards it has won. */
  poached: number;
  trophies: number;
  /** Its standing points (0 until it opens), and the points the center has knocked off it so far. */
  points: number;
  knocked: number;
}

export interface Ceremony {
  year: number;
  results: AwardResult[];
}

/** What a guest thought of their visit, written as they left. */
export interface Review {
  name: string;
  /** One to five. */
  stars: number;
  text: string;
  day: number;
  feelings: FeelingId[];
}

/** How visits ended for guests with one condition. */
export interface CaseRecord {
  healed: number;
  failed: number;
  stormed: number;
  sent: number;
  priced: number;
  worse: number;
}

/** An award won, for the trophy cabinet. */
export interface Trophy {
  award: AwardId;
  year: number;
}

export interface GameState {
  version: number;
  /** The center this game is set in. */
  center: CenterId;
  nextId: number;
  money: number;
  reputation: number;
  /** Elapsed game days (fractional). */
  day: number;
  speed: number;
  open: boolean;
  rooms: Room[];
  /** How new rooms of each kind are decorated, as chosen with "every room like this"; standard where unset. */
  roomDecor?: Partial<Record<RoomType, RoomDecor>>;
  items: Item[];
  staff: Staff[];
  guests: Guest[];
  litter: Litter[];
  candidates: Candidate[];
  ledger: Ledger;
  lastLedger: Ledger;
  history: number[];
  stats: Stats;
  /** This month so far. */
  tally: Tally;
  /** The last twelve finished months, oldest first. */
  months: MonthRecord[];
  stars: number;
  spawnT: number;
  announceT: number;
  loan: number;
  /** Multiplier on every fee, 0.5 to 2. */
  priceLevel: number;
  /** An emergency waiting for the player to accept or decline. */
  offer: Emergency | null;
  emergency: Emergency | null;
  /** Game day the next emergency offer may appear. */
  nextEmergency: number;
  /** A stress outbreak on offer, the one in progress, and the day the next may be offered. */
  outbreakOffer: Outbreak | null;
  outbreak: Outbreak | null;
  nextOutbreak: number;
  /** How the center is run: how sure a diagnosis must be, who goes first, and when staff take breaks. */
  policy: Policy;
  /** Optional disciplines switched off for this game (absent means on). */
  options: Partial<Record<Offering, boolean>>;
  /** Everything unlocked from the start, whatever the stars: a sandbox setting. */
  unlockAll: boolean;
  /** The latest reviews, oldest first. */
  reviews: Review[];
  /** How visits ended, condition by condition. */
  casebook: Partial<Record<ConditionId, CaseRecord>>;
  /** Each discipline's following, 0 to 100: guests come for it more as it grows with the guests it heals. */
  following: Partial<Record<Discipline, number>>;
  /** Each technique's own price against standard, on top of the overall level; absent is standard. */
  prices: Partial<Record<Priced, number>>;
  /** Class-goers on their way, booked for upcoming Qi Gong classes. */
  arrivals: Arrival[];
  /** Marketing campaigns running. */
  campaigns: Campaign[];
  /** A house call on offer, if any, and the game day the next may be offered. */
  callOffer: HouseCall | null;
  nextCall: number;
  /** The game day the next job applicant turns up. */
  nextApplicant: number;
  /** The challenge a member of staff has set, if any, and the day the next may be set. */
  challenge: Challenge | null;
  nextChallenge: number;
  /** Whether staff set challenges at all: a sandbox setting. */
  challengesOn: boolean;
  /** Whether stress outbreaks are offered, and whether the weather outside makes it hot or cold: sandbox settings. */
  outbreaksOn: boolean;
  weatherOn: boolean;
  /** VIPs and the health inspector: whoever is here now, whoever has written ahead, how the last visit went, the days
   * the next of each may write, and whether they call at all (a sandbox setting). */
  visitors: Visitor[];
  visitNotice: VisitNotice | null;
  visitReport: VisitReport | null;
  nextVip: number;
  nextInspection: number;
  visitsOn: boolean;
  /** The highest grade of standing the center has reached, from 0: it never goes back down. */
  grade: number;
  /** The franchise across the street. */
  rival: Rival;
  /** Whether there is a rival at all: a sandbox setting. */
  rivalOn: boolean;
  /** The mishap announced or under way, if any, the day the next may be announced, and whether they come at all (a
   * sandbox setting). */
  mishap: Mishap | null;
  nextMishap: number;
  mishapsOn: boolean;
  /** The last year-end awards ceremony, and every award won. */
  ceremony: Ceremony | null;
  trophies: Trophy[];
  /** Campaign achievements earned already, in this game or an earlier one, so none is awarded twice. */
  achieved: AchievementId[];
  /**
   * Payday has come and the bank cannot cover the wages: the game waits while the player decides whether to borrow
   * `loan` to cover them or pay them into the red, or, with `loan` 0, hears that the bank will lend no more and the
   * wages go into the red. Null when no payday is waiting.
   */
  payrollDue: { wages: number; loan: number } | null;
  /**
   * The bank is calling the overdraft in: at the last payday the center was in the red and losing money, and unless
   * one of the two is put right by `until` it is bankrupt. Null while the bank is content.
   */
  insolvency: { until: number } | null;
  /** The day the bank went below zero, or null while it is not. */
  redSince: number | null;
  /** The last month, counted from 0, in which payday was warned of ahead of time, so it is once a month. */
  paydayWarned?: number;
  /** The most guests the player lets in at once, below what the building allows, or null for no limit of their own. */
  intakeCap: number | null;
  /** The center is bankrupt and the game is lost. */
  bankrupt: boolean;
  /** Whether an unpaid payday can end the game: a sandbox setting. Off, the bank just goes into the red. */
  bankruptcyOn: boolean;
  /** A command has been used in the cheat console, so this game earns no achievements or campaign stars. */
  cheated: boolean;
  seenTips: string[];
  /** Magic mushrooms are on sale under the Shop Counter, while there is a Shaman to supply them. */
  mushrooms: boolean;
  /** They were put away when the health inspector wrote ahead, to come back out once the inspection is over. */
  mushroomsStashed: boolean;
  /** The land bought next to the building, in the order it was bought. */
  land: Land[];
  /** Guests who come back every few weeks, whether here now or due. */
  regulars: Regular[];
  /** How hard the game is, setting by setting: a sandbox setting. One left out is as usual. */
  difficulty: Difficulty;
  /** Where the game's random numbers have got to, so a loaded game draws the ones it would have drawn anyway. */
  rng: number;
  /** The disciplines someone has been treated in today, whose followings do not fade tonight. */
  practised: Discipline[];
  /** Seconds of game time until the next round of once-a-second checks. */
  slowT: number;
  /**
   * How pleasant, noisy and warm each tile was at the last once-a-second check, which everyone goes by until the next.
   * Null before the first check.
   */
  surroundings: Surroundings | null;
}

/** A grid of figures, one for each tile, row by row, as the bytes of 32-bit floats in base64. */
export type PackedGrid = string;

/** How pleasant, noisy and warm each tile is, as the once-a-second checks last worked them out. */
export interface Surroundings {
  attract: PackedGrid;
  noise: PackedGrid;
  warmth: PackedGrid;
}
