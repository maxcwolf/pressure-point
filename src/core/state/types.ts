// The shape of a game in progress. Everything here is plain JSON, so saving is a stringify away.

import { type Discipline, type ItemType, type Modality, type Pose, type Role, type RoomType } from '../data';

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
  traits: string[];
  energy: number;
  state: StaffState;
  /** Station item this staff member is assigned to. */
  post: number;
  job: { kind: 'litter' | 'water' | 'repair'; id: number } | null;
  served: number;
  /** Modalities of their discipline this member of staff is qualified in. */
  quals: Modality[];
  /** Course in progress: a modality id, or 'skill'. */
  training: { course: string; progress: number; seconds: number; cost: number } | null;
  /** Energy-drain multiplier of the session in progress. */
  strain: number;
  /** 0 to 100. Low morale means slow work, then a demand for a raise, then a resignation. */
  morale: number;
  raiseAsked: boolean;
  /** Seconds spent miserable; they quit when it runs too long. */
  unhappyT: number;
}

export type GuestState = 'enter' | 'toWait' | 'waiting' | 'called' | 'served' | 'toNeed' | 'need' | 'leaving';

export interface Guest extends CharBase {
  kind: 'guest';
  condition: string;
  goal: 'reception' | 'consult' | 'assess' | 'treat' | 'leave';
  state: GuestState;
  station: number;
  needKind: '' | 'drink' | 'eat' | 'toilet';
  thirst: number;
  hunger: number;
  bladder: number;
  patience: number;
  diagnosis: number;
  consults: number;
  outcome: '' | 'healed' | 'failed' | 'stormed';
  spent: number;
  hasWrapper: boolean;
  waited: number;
  /** Arrived as part of an emergency. */
  emergency: boolean;
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
  traits: string[];
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
  condition: string;
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

export interface GameState {
  version: number;
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
  stats: { healed: number; failed: number; stormed: number; arrived: number };
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
  /** Optional disciplines switched off for this game (absent means on). */
  options: Partial<Record<Discipline, boolean>>;
  seenTips: string[];
}
