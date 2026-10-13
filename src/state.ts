// Game state. Everything here is plain JSON so saving is a stringify away.
import {
  CAMEO_CHANCE,
  CAMEO_NAMES,
  type Discipline,
  DISCIPLINES,
  FIRST_NAMES,
  type ItemType,
  LAST_NAMES,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  type Pose,
  type Role,
  ROLE_ORDER,
  ROLES,
  type RoomType,
  START_MONEY,
  traitOf,
  TRAITS,
} from './data';
import { at } from './util';

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
export const sameSpot = (a: WallSpot, b: WallSpot) => a.x === b.x && a.y === b.y && a.dx === b.dx && a.dy === b.dy;

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
export const emptyLedger = (): Ledger => ({
  consult: 0,
  treatment: 0,
  vending: 0,
  salaries: 0,
  building: 0,
  training: 0,
  interest: 0,
  bonus: 0,
});

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

export const SAVE_VERSION = 3;

// ---- Random helpers --------------------------------------------------------
let seed = (Math.random() * 2 ** 32) >>> 0;
/** Reseed the game's random numbers. Tests use this to get repeatable runs. */
export function setSeed(n: number) {
  seed = n >>> 0;
}
/** Mulberry32: a small seedable generator, uniform in [0, 1). */
export function random(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rnd = (a = 1, b?: number) => (b === undefined ? random() * a : a + random() * (b - a));
export const irnd = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => at(arr, Math.floor(random() * arr.length));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const SKINS = [0xf6d2b8, 0xeebf9e, 0xd9a078, 0xb97a55, 0x8d5a3b, 0x6b4229, 0xf9dfc9];
const HAIRS = [0x2b1d16, 0x4a2f1d, 0x8a5a2b, 0xd9a441, 0xb5422e, 0x8c8c8c, 0xe9e3d3, 0x6a4fb0, 0x2f7f7a];
const TOPS = [
  0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x4d7ea8, 0xb56576, 0x8ab17d, 0x6d597a, 0xef8fa2, 0x5fa8d3, 0xf2f2f2,
];
const BOTTOMS = [0x3d405b, 0x5c4b3a, 0x2f4858, 0x6b705c, 0x7f5539, 0x4a4e69, 0x8d99ae];

export function randomLook(): Look {
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: irnd(0, 4),
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    scale: rnd(0.92, 1.08),
  };
}
export const randomName = () =>
  random() < CAMEO_CHANCE ? pick(CAMEO_NAMES) : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

export function makeCandidate(s: GameState, role: Role): Candidate {
  const skill = clamp(Math.round(rnd(0.6, 3.4 + s.stars * 0.6)), 1, 5);
  const traits: string[] = [];
  if (random() < 0.65) traits.push(pick(TRAITS).id);
  // practitioners all know their discipline's basic modality; a few arrive trained in something more
  const quals: Modality[] = [];
  const discipline = ROLES[role].discipline;
  if (discipline) {
    for (const m of MODALITY_ORDER) {
      const def = MODALITIES[m];
      if (def.discipline !== discipline) continue;
      if (m === DISCIPLINES[discipline].base || (def.star <= s.stars && random() < 0.28)) quals.push(m);
    }
  }
  const look = randomLook();
  look.top = ROLES[role].uniform;
  const salary = fairSalary(role, skill, traits, quals);
  return { id: s.nextId++, name: randomName(), role, skill, salary, traits, quals, look };
}

/** Each extra qualification is worth this much more pay. */
export const QUAL_PAY = 0.1;

/** The going rate for someone with this role, skill, quirks and training. */
export function fairSalary(role: Role, skill: number, traits: string[], quals: Modality[]): number {
  let pay = ROLES[role].baseSalary * (0.75 + skill * 0.25);
  for (const t of traits) pay *= traitOf(t).pay ?? 1;
  if (ROLES[role].discipline) pay *= 1 + QUAL_PAY * Math.max(0, quals.length - 1);
  return Math.round(pay / 10) * 10;
}

export function refillCandidates(s: GameState, replaceAll = false) {
  if (replaceAll) s.candidates = [];
  for (const role of ROLE_ORDER) {
    while (s.candidates.filter((c) => c.role === role).length < 3) s.candidates.push(makeCandidate(s, role));
  }
}

export function newGame(): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    nextId: 1,
    money: START_MONEY,
    reputation: 30,
    day: 0,
    speed: 1,
    open: false,
    rooms: [],
    items: [],
    staff: [],
    guests: [],
    litter: [],
    candidates: [],
    ledger: emptyLedger(),
    lastLedger: emptyLedger(),
    history: [],
    stats: { healed: 0, failed: 0, stormed: 0, arrived: 0 },
    stars: 0,
    spawnT: 4,
    announceT: 25,
    seenTips: [],
    loan: 0,
    priceLevel: 1,
    offer: null,
    emergency: null,
    nextEmergency: 75,
    options: {},
  };
  refillCandidates(s);
  return s;
}

const baseQuals = (role: Role): Modality[] => {
  const d = ROLES[role].discipline;
  return d ? [DISCIPLINES[d].base] : [];
};

/** Whether a discipline is switched on for this game. Massage always is. */
export function disciplineOn(s: GameState, d: Discipline): boolean {
  return !DISCIPLINES[d].optional || s.options[d] !== false;
}

/** A record written before some of its fields existed, so those fields may be missing. */
type Before<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type OldLedger = Before<Ledger, 'training' | 'interest' | 'bonus'>;

/** A save as an earlier version may have written it. */
type OldSave = Before<
  Omit<GameState, 'staff' | 'candidates' | 'items' | 'rooms' | 'guests' | 'ledger' | 'lastLedger'>,
  'announceT' | 'loan' | 'priceLevel' | 'offer' | 'emergency' | 'nextEmergency' | 'options'
> & {
  staff: Before<Staff, 'quals' | 'training' | 'strain' | 'morale' | 'raiseAsked' | 'unhappyT'>[];
  candidates: Before<Candidate, 'quals'>[];
  items: Before<Item, 'wear'>[];
  rooms: Before<Room, 'windows'>[];
  guests: Before<Guest, 'emergency'>[];
  ledger: OldLedger;
  lastLedger: OldLedger;
};

/** Bring a save from any earlier version up to date by filling in what it lacks. */
export function upgradeSave(save: GameState) {
  const s: OldSave = save;
  for (const st of s.staff) {
    // before massage modalities, everyone on the payroll knew Swedish and nothing else
    st.quals ??= baseQuals(st.role);
    st.training ??= null;
    st.strain ??= 1;
    st.morale ??= 75;
    st.raiseAsked ??= false;
    st.unhappyT ??= 0;
  }
  for (const c of s.candidates) c.quals ??= baseQuals(c.role);
  for (const it of s.items) it.wear ??= 0;
  for (const r of s.rooms) r.windows ??= [];
  for (const g of s.guests) g.emergency ??= false;
  for (const l of [s.ledger, s.lastLedger]) {
    l.training ??= 0;
    l.interest ??= 0;
    l.bonus ??= 0;
  }
  s.announceT ??= 25;
  s.loan ??= 0;
  s.priceLevel ??= 1;
  s.offer ??= null;
  s.emergency ??= null;
  s.nextEmergency ??= s.day + 60;
  s.options ??= {};
  s.version = SAVE_VERSION;
}
