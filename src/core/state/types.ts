// The shape of a game in progress. Everything here is plain JSON, so saving is a stringify away.

import type {
  AchievementId,
  AwardId,
  CenterId,
  ConditionId,
  Discipline,
  GoalSpec,
  ItemType,
  Modality,
  Pose,
  Role,
  RoomType,
  TraitId,
} from '../data';

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
  /** Staff fill its stations, and janitors see to it, before anywhere else. */
  priority: boolean;
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
  // plants
  water: number;
  /** 0 is new, 100 is broken. */
  wear: number;
  /** 0 is spotless, 100 is filthy. */
  dirt: number;
  /** Janitor currently heading over to deal with it. */
  claimedBy: number;
}

export interface Look {
  skin: number;
  hair: number;
  hairStyle: number;
  top: number;
  bottom: number;
  scale: number;
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
  bubble: string;
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
  | 'leaving';

export interface Staff extends CharBase {
  kind: 'staff';
  role: Role;
  skill: number;
  salary: number;
  traits: TraitId[];
  energy: number;
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
}

/** A chore for a Janitor: the litter or item to see to. */
export interface Job {
  kind: 'litter' | 'water' | 'repair' | 'clean';
  id: number;
}

/** Something staff can study: a modality, or a general step up in skill. */
export type CourseId = Modality | 'skill';

/** A course in progress. The fee is kept so it can be refunded if the course is cut short. */
export interface Enrollment {
  course: CourseId;
  progress: number;
  seconds: number;
  cost: number;
}

/** The step of a visit a guest is on. */
export type GuestGoal = 'reception' | 'consult' | 'assess' | 'treat' | 'leave';
/** Something a guest breaks off waiting to see to. */
export type Need = 'drink' | 'eat' | 'toilet' | 'play';
/** How a guest's visit ended. */
export type Outcome = 'healed' | 'failed' | 'stormed' | 'sent';

export type GuestState = 'enter' | 'toWait' | 'waiting' | 'called' | 'served' | 'toNeed' | 'need' | 'leaving';

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
  diagnosis: number;
  consults: number;
  outcome: Outcome | '';
  spent: number;
  hasWrapper: boolean;
  waited: number;
  /** Arrived as part of an emergency. */
  emergency: boolean;
  /** Put in their line by the player, so they stay in it rather than look for a shorter one. */
  placed: boolean;
}

export type Char = Staff | Guest;

/** A point on a route. `pose` is 1 for the final step off the grid into a seat, onto a table and so on. */
export type Waypoint = [x: number, y: number, pose: number];

/** Where someone is headed: the tile, then the pose point beyond it and whether there is one. */
export type Destination = [tx: number, ty: number, px: number, py: number, hasPose: number];

export interface Litter {
  id: number;
  x: number;
  y: number;
  claimedBy: number;
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
  /** Emergency rewards. */
  bonus: number;
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
  arrived: number;
  /** Guests healed, by the discipline that healed them. */
  healedBy: Partial<Record<Discipline, number>>;
  /** Emergencies seen through successfully. */
  emergencies: number;
  /** The game day someone last quit, or -1 if nobody ever has. */
  lastQuit: number;
}

/** A month's count of guests: how many came, how each visit ended, and how long they waited. */
export interface Tally {
  arrived: number;
  healed: number;
  failed: number;
  stormed: number;
  priced: number;
  sent: number;
  /** Seconds spent waiting, summed over the guests who left this month, and how many they were. */
  waitTotal: number;
  waitCount: number;
  /** Guests healed, by the discipline that healed them. */
  healedBy: Partial<Record<Discipline, number>>;
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
export interface Ceremony {
  year: number;
  results: AwardResult[];
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
  /** How the center is run: how sure a diagnosis must be, who goes first, and when staff take breaks. */
  policy: Policy;
  /** Optional disciplines switched off for this game (absent means on). */
  options: Partial<Record<Discipline, boolean>>;
  /** Everything unlocked from the start, whatever the stars: a sandbox setting. */
  unlockAll: boolean;
  /** The challenge a member of staff has set, if any, and the day the next may be set. */
  challenge: Challenge | null;
  nextChallenge: number;
  /** Whether staff set challenges at all: a sandbox setting. */
  challengesOn: boolean;
  /** The last year-end awards ceremony, and every award won. */
  ceremony: Ceremony | null;
  trophies: Trophy[];
  /** Campaign achievements earned already, in this game or an earlier one, so none is awarded twice. */
  achieved: AchievementId[];
  seenTips: string[];
}
