// The shapes of the game's content: what a room, an item, a role, a modality and a condition are.

import type { Plot } from './map';

export type RoomType =
  'consult' | 'assess' | 'massage' | 'acupuncture' | 'reiki' | 'staffroom' | 'restroom' | 'training';

export type Role = 'receptionist' | 'consultant' | 'therapist' | 'acupuncturist' | 'practitioner' | 'caretaker';

/** A family of treatments with its own room, staff and equipment. */
export type Discipline = 'massage' | 'acupuncture' | 'reiki';

export type ItemType =
  | 'reception_desk'
  | 'consult_desk'
  | 'cabinet'
  | 'massage_table'
  | 'oil_trolley'
  | 'sofa'
  | 'toilet'
  | 'sink'
  | 'bench'
  | 'plant'
  | 'tea_station'
  | 'snack_machine'
  | 'bin'
  | 'fountain'
  | 'stone_warmer'
  | 'stretch_rack'
  | 'whiteboard'
  | 'study_desk'
  | 'posture_scanner'
  | 'salt_lamp'
  | 'diffuser'
  | 'statue'
  | 'rug'
  | 'magazine_rack'
  | 'acu_table'
  | 'needle_cabinet'
  | 'cupping_cart'
  | 'moxa_burner'
  | 'stim_unit'
  | 'reiki_table'
  | 'reiki_altar'
  | 'crystal_grid'
  | 'singing_bowls'
  | 'water_cooler'
  | 'fire_extinguisher'
  | 'arcade_machine'
  | 'bookcase'
  | 'coffee_machine'
  | 'aquarium'
  | 'pool_table'
  | 'trophy_cabinet';

export interface RoomDef {
  type: RoomType;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  /** Shorter side must be >= minShort, longer side >= minLong. */
  minShort: number;
  minLong: number;
  required: ItemType[];
  staff?: Role;
  floor: [string, string];
  trim: number;
  /** Treatment rooms belong to a discipline, which Settings can switch off. */
  discipline?: Discipline;
  /** Stars needed before it can be built. */
  unlock?: number;
}

export type AccessRole = 'staff' | 'guest' | 'seat' | 'rest' | 'toilet' | 'drink' | 'eat' | 'play' | 'study';

export type Pose = 'stand' | 'walk' | 'sit' | 'lie';

/**
 * A spot where a character uses an item. Coordinates are in the item's local
 * frame at rotation 0: tile (x,y) is where they path to, (px,py) is the
 * continuous position they settle at, `face` the direction they look.
 */
export interface AccessDef {
  role: AccessRole;
  x: number;
  y: number;
  px: number;
  py: number;
  face: [number, number];
  pose: Pose;
  h?: number;
}

export interface ItemDef {
  type: ItemType;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  w: number;
  h: number;
  access: AccessDef[];
  /** Where it may be placed. */
  where: 'corridor' | 'any' | RoomType;
  /** Stations have a staff position and a line of guests. */
  station?: {
    staff: Role;
    goal: 'reception' | 'consult' | 'assess' | 'treat';
    seconds: number;
    discipline?: Discipline;
  };
  inMenu?: boolean;
  /** Stars needed before it can be bought. */
  unlock?: number;
  /** How much nicer it makes its surroundings, and the room it is in. */
  decor?: number;
  /** People can walk over it, and furniture can stand on it. */
  walkable?: boolean;
  /** Wear added each time it is used. At 100 it breaks until a Janitor repairs it. */
  wear?: number;
  /** Grime added each time it is used, until a Janitor cleans it. */
  dirt?: number;
  /** What a guest pays each time they use it, for drinks, snacks and games. */
  sale?: number;
}

export interface RoleDef {
  role: Role;
  name: string;
  icon: string;
  desc: string;
  baseSalary: number;
  uniform: number;
  accent: number;
  /** The discipline this role practices, if any. They hold qualifications in its modalities. */
  discipline?: Discipline;
}

/** A quirk a member of staff can have. */
export type TraitId = 'brisk' | 'tireless' | 'chatty' | 'sleepy' | 'speedy' | 'dawdler' | 'bargain';

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  speed?: number; // service speed multiplier
  stamina?: number; // energy drain multiplier (lower is better)
  pay?: number; // salary multiplier
  walk?: number; // walk speed multiplier
}

export type Modality =
  | 'swedish'
  | 'deep'
  | 'sports'
  | 'stone'
  | 'cranio'
  | 'needling'
  | 'cupping'
  | 'moxa'
  | 'electro'
  | 'usui'
  | 'crystal'
  | 'sound'
  | 'chakra';

export interface ModalityDef {
  id: Modality;
  discipline: Discipline;
  name: string;
  icon: string;
  desc: string;
  /** Stars needed before guests turn up wanting it. */
  star: number;
  /** Item that must be in the same Massage Suite as the table. */
  equipment?: ItemType;
  /** Length of a session at normal speed. */
  seconds: number;
  /** How hard a session is on the therapist's energy (1 = normal). */
  strain: number;
  /** Subtracted from the chance of success, so harder modalities need more skill. */
  difficulty: number;
  trainCost: number;
  trainDays: number;
}

export interface DisciplineDef {
  id: Discipline;
  name: string;
  icon: string;
  desc: string;
  role: Role;
  room: RoomType;
  /** The modality everyone in the role starts with. */
  base: Modality;
  /** Optional disciplines can be switched off in Settings. */
  optional: boolean;
}

export type Visual =
  | 'knot'
  | 'slump'
  | 'steam'
  | 'stiff'
  | 'neck'
  | 'band'
  | 'crick'
  | 'flex'
  | 'frost'
  | 'dizzy'
  | 'cloud'
  | 'jitter'
  | 'aura'
  | 'cork'
  | 'coldfeet'
  | 'blanket'
  | 'battery'
  | 'wires'
  | 'pale'
  | 'static'
  | 'shards'
  | 'bulb'
  | 'notes'
  | 'gears'
  | 'chakra'
  | 'tilt'
  | 'sway'
  | 'gull'
  | 'sunburn';

/** What a guest can arrive suffering from. */
export type ConditionId =
  | 'slump'
  | 'band'
  | 'knotted'
  | 'crick'
  | 'stiff'
  | 'flex'
  | 'steam'
  | 'frost'
  | 'neck'
  | 'dizzy'
  | 'qi'
  | 'pins'
  | 'vibes'
  | 'bottled'
  | 'coldfeet'
  | 'blanket'
  | 'battery'
  | 'wires'
  | 'drained'
  | 'static'
  | 'scattered'
  | 'dim'
  | 'tune'
  | 'noisy'
  | 'blocked'
  | 'tilted'
  | 'sealegs'
  | 'gull'
  | 'lobstered';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  desc: string;
  treatment: string;
  modality: Modality;
  fee: number;
  visual: Visual;
  /** The only centers guests turn up with it in, for a local ailment. Absent means anywhere. */
  only?: readonly CenterId[];
}

/** One objective toward a star. */
export type GoalSpec =
  /** Heal this many guests in all, or with one discipline. */
  | { kind: 'healed'; count: number; discipline?: Discipline }
  | { kind: 'reputation'; percent: number }
  | { kind: 'balance'; amount: number }
  /** Heal at least this share of the guests treated in a month (with at least a few treated). */
  | { kind: 'cureRate'; percent: number }
  /** Keep the average wait in a month under this many days. */
  | { kind: 'wait'; days: number }
  /** See emergencies through to the end successfully. */
  | { kind: 'emergencies'; count: number }
  /** Have a finished room of this type at this prestige or better. */
  | { kind: 'prestige'; room: RoomType; level: number }
  /** Go this many days without anyone quitting. */
  | { kind: 'noQuits'; days: number };

/** The objectives for one star: all must be met at once. */
export type StarGoal = readonly GoalSpec[];

export type CenterId = 'sandbox' | 'willow' | 'exchange' | 'saltmarsh';

/** A center to run: the sandbox, or one of the campaign's. */
export interface CenterDef {
  id: CenterId;
  name: string;
  /** Where it is, in a few words, and a line or two about it. */
  place: string;
  blurb: string;
  plot: Plot;
  startMoney: number;
  /** The objectives for each star in turn. */
  goals: readonly StarGoal[];
  /** The optional disciplines on offer here, each still opened by its room's star. Massage is always on offer. */
  disciplines: readonly Discipline[];
  /** How much more (or less) often guests arrive with a condition here than elsewhere. Unlisted ones count once. */
  conditions?: Partial<Record<ConditionId, number>>;
  /** Rush hours: arrivals bunch up at the start and end of each day, and guests are less patient. */
  rush?: RushHours;
  /** Seasons: busier summers and quieter winters. */
  seasons?: Seasons;
  /** How much faster than usual equipment wears out here. */
  wear?: number;
  /** What surrounds the building: a park, or the seaside. */
  scenery?: 'park' | 'seaside';
}

/** How much more often guests arrive in summer, and how much less in winter. */
export interface Seasons {
  summer: number;
  winter: number;
}

/** How busy rush hours are: arrivals during them and between them, and how much faster patience runs out. */
export interface RushHours {
  peak: number;
  lull: number;
  impatience: number;
}
