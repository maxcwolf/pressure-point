// Game state. Everything here is plain JSON so saving is a stringify away.
import {
  FIRST_NAMES,
  LAST_NAMES,
  ROLES,
  ROLE_ORDER,
  START_MONEY,
  TRAITS,
  TRAIT_BY_ID,
  type ItemType,
  type Pose,
  type Role,
  type RoomType,
} from './data';

export interface Room {
  id: number;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Inside tile of the door plus the outward direction. */
  door: { x: number; y: number; dx: number; dy: number };
  /** True once every required item has been placed. */
  done: boolean;
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
  /** Caretaker currently heading over to deal with it. */
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
  path: number[][] | null;
  dest: number[] | null;
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
  | 'leaving';

export interface Staff extends CharBase {
  kind: 'staff';
  role: Role;
  skill: number;
  salary: number;
  traits: string[];
  energy: number;
  state: StaffState;
  /** Station item this member of staff is assigned to. */
  post: number;
  job: { kind: 'litter' | 'water'; id: number } | null;
  served: number;
}

export type GuestState =
  | 'enter'
  | 'toWait'
  | 'waiting'
  | 'called'
  | 'served'
  | 'toNeed'
  | 'need'
  | 'leaving';

export interface Guest extends CharBase {
  kind: 'guest';
  condition: string;
  goal: 'reception' | 'consult' | 'treat' | 'leave';
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
}

export type Char = Staff | Guest;

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
  look: Look;
}

export interface Ledger {
  consult: number;
  treatment: number;
  vending: number;
  salaries: number;
  building: number;
}
export const emptyLedger = (): Ledger => ({ consult: 0, treatment: 0, vending: 0, salaries: 0, building: 0 });

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
  tannoyT: number;
  seenTips: string[];
}

export const SAVE_VERSION = 1;
const SAVE_KEY = 'pressure-point-save-v1';

// ---- Random helpers --------------------------------------------------------
export const rnd = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const irnd = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const SKINS = [0xf6d2b8, 0xeebf9e, 0xd9a078, 0xb97a55, 0x8d5a3b, 0x6b4229, 0xf9dfc9];
const HAIRS = [0x2b1d16, 0x4a2f1d, 0x8a5a2b, 0xd9a441, 0xb5422e, 0x8c8c8c, 0xe9e3d3, 0x6a4fb0, 0x2f7f7a];
const TOPS = [0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x4d7ea8, 0xb56576, 0x8ab17d, 0x6d597a, 0xef8fa2, 0x5fa8d3, 0xf2f2f2];
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
export const randomName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

export function makeCandidate(s: GameState, role: Role): Candidate {
  const skill = clamp(Math.round(rnd(0.6, 3.4 + s.stars * 0.6)), 1, 5);
  const traits: string[] = [];
  if (Math.random() < 0.65) traits.push(pick(TRAITS).id);
  let pay = ROLES[role].baseSalary * (0.75 + skill * 0.25);
  for (const t of traits) pay *= TRAIT_BY_ID[t].pay ?? 1;
  const look = randomLook();
  look.top = ROLES[role].uniform;
  return { id: s.nextId++, name: randomName(), role, skill, salary: Math.round(pay / 10) * 10, traits, look };
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
    tannoyT: 25,
    seenTips: [],
  };
  refillCandidates(s);
  return s;
}

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // storage full or unavailable: the game carries on unsaved
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION || !Array.isArray(s.rooms)) return null;
    return s;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
