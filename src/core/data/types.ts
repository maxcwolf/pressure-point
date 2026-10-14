// The shapes of the game's content: what a room, an item, a role, a modality and a condition are.

export type RoomType = 'consult' | 'assess' | 'massage' | 'acupuncture' | 'staffroom' | 'restroom' | 'training';

export type Role = 'receptionist' | 'consultant' | 'therapist' | 'acupuncturist' | 'caretaker';

/** A family of treatments with its own room, staff and equipment. */
export type Discipline = 'massage' | 'acupuncture';

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

export type Modality = 'swedish' | 'deep' | 'sports' | 'stone' | 'cranio' | 'needling' | 'cupping' | 'moxa' | 'electro';

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
  | 'wires';

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
  | 'wires';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  desc: string;
  treatment: string;
  modality: Modality;
  fee: number;
  visual: Visual;
}

export interface StarGoal {
  healed: number;
  reputation: number;
  balance: number;
}
