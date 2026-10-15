// The shapes of the game's content: what a room, an item, a role, a modality and a condition are.

import type { Plot } from './map';
import type { MishapId } from './mishaps';

export type RoomType =
  | 'consult'
  | 'assess'
  | 'massage'
  | 'acupuncture'
  | 'reiki'
  | 'sound'
  | 'recovery'
  | 'qigong'
  | 'staffroom'
  | 'restroom'
  | 'training';

/** Whether someone is a woman or a man: their hair and first name follow it. */
export type Sex = 'female' | 'male';

export type Role =
  | 'receptionist'
  | 'consultant'
  | 'therapist'
  | 'acupuncturist'
  | 'practitioner'
  | 'healer'
  | 'instructor'
  | 'caretaker';

/** A family of treatments with its own room, staff and equipment. */
export type Discipline = 'massage' | 'acupuncture' | 'reiki' | 'sound';

/** Something Settings can switch off: an optional discipline, or the Qi Gong classes. */
export type Offering = Discipline | 'qigong';

/** Something with a price of its own in the Money menu: a treatment, or a place in a Qi Gong class. */
export type Priced = Modality | 'qigong';

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
  | 'sound_mat'
  | 'gong'
  | 'crystal_bowls'
  | 'water_cooler'
  | 'fire_extinguisher'
  | 'arcade_machine'
  | 'bookcase'
  | 'coffee_machine'
  | 'aquarium'
  | 'pool_table'
  | 'trophy_cabinet'
  | 'bonsai'
  | 'massage_chair'
  | 'koi_pond'
  | 'shop_counter'
  | 'radiator'
  | 'air_conditioner'
  | 'linen_hamper'
  | 'fireplace'
  | 'topiary'
  | 'recliner'
  | 'instructor_mat'
  | 'practice_spot';

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
  /** Something other than a discipline that Settings can switch it off with. */
  offering?: 'qigong';
}

export type AccessRole =
  'staff' | 'guest' | 'seat' | 'rest' | 'recover' | 'toilet' | 'drink' | 'eat' | 'play' | 'study';

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
  /**
   * Stations have a staff position and a line of guests. A group station has no staff position of its own: it is
   * worked from the lead station in its room, whose member of staff serves every group station there at once.
   */
  station?: {
    staff: Role;
    goal: 'reception' | 'consult' | 'assess' | 'treat' | 'shop' | 'lead' | 'class';
    seconds: number;
    discipline?: Discipline;
    group?: boolean;
  };
  inMenu?: boolean;
  /** Stars needed before it can be bought. */
  unlock?: number;
  /**
   * Karma that unlocks it for good, in every game: before its star if it has one, or at all if it does not.
   * An item with karma and no star is only ever unlocked with karma.
   */
  karma?: number;
  /** How much nicer it makes its surroundings, and the room it is in. */
  decor?: number;
  /** People can walk over it, and furniture can stand on it. */
  walkable?: boolean;
  /** Wear added each time it is used. At 100 it breaks until a Caretaker repairs it. */
  wear?: number;
  /** Grime added each time it is used, until a Caretaker cleans it. */
  dirt?: number;
  /** What a guest pays each time they use it, for drinks, snacks and games. */
  sale?: number;
  /** How fast a guest sitting in it loses patience, against standing. Seats default to 0.6. */
  seatDrain?: number;
  /** How much noise it makes, carrying like decor does; below zero, it soothes the noise around it. */
  noise?: number;
  /** How much noise it makes while a group session plays in its room, heard only outside the room. */
  sessionNoise?: number;
  /** Degrees it warms (or, below zero, cools) the air around it. */
  heat?: number;
  /** A table with linens on it, soiled a little with each session until a Caretaker changes them. */
  linens?: boolean;
  /** It has a front and a back, so a marker shows which way it will face while it is being placed. */
  front?: boolean;
  /**
   * Treatment equipment that can be upgraded, up to `UPGRADE_LEVELS`, by a Caretaker with the Mechanics course: what
   * the upgrades are priced against, each level a share of it (`UPGRADE_PRICE`).
   */
  upgrade?: number;
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
  /** The room a role with no discipline works in, if only one: they can be hired once it can be built. */
  room?: RoomType;
}

/** A quirk a member of staff can have. */
export type TraitId =
  | 'brisk'
  | 'tireless'
  | 'chatty'
  | 'sleepy'
  | 'speedy'
  | 'dawdler'
  | 'bargain'
  | 'litterbug'
  | 'grump'
  | 'sunny'
  | 'quick'
  | 'green';

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  speed?: number; // service speed multiplier
  stamina?: number; // energy drain multiplier (lower is better)
  pay?: number; // salary multiplier
  walk?: number; // walk speed multiplier
  /** Course speed multiplier. */
  learn?: number;
  /** Something they do that can be seen: drop litter, put guests off, cheer colleagues, or water plants in passing. */
  habit?: 'litter' | 'grump' | 'cheer' | 'water';
}

/** A course any member of staff (or any in some roles) can take, beyond the treatments of their discipline. */
export type GeneralId = 'bedside' | 'motivation' | 'stamina' | 'service' | 'maintenance' | 'smudging' | 'mechanics';

export interface GeneralDef {
  id: GeneralId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  days: number;
  /** The roles it is for; absent means every role. */
  roles?: readonly Role[];
}

/** Something a member of staff can be kept to or kept from: a kind of station, or a kind of Caretaker's job. */
export type Duty = 'reception' | 'shop' | 'consult' | 'assess' | 'litter' | 'clean' | 'repair' | 'plants' | 'stones';

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
  | 'chakra'
  | 'distance'
  | 'forks'
  | 'gong'
  | 'crystalbowls'
  | 'overtone';

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
  /** Leaves a guest needing a lie-down in a Recovery Lounge afterwards, or it works less often. */
  rest?: boolean;
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
  | 'sunburn'
  | 'icicles'
  | 'cast'
  | 'thermometer'
  | 'apple'
  | 'mallet'
  | 'blossom'
  | 'worm'
  | 'glass';

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
  | 'lobstered'
  | 'frozen'
  | 'wipeout'
  | 'cabin'
  | 'windfall'
  | 'croquet'
  | 'blossom'
  | 'outofbody'
  | 'farout'
  | 'earworm'
  | 'badvibrations'
  | 'glasshalf'
  | 'monotone';

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
  /** How much faster than usual it worsens while they wait. Absent means the usual rate. */
  worsens?: number;
}

export type AchievementId =
  | 'called-in'
  | 'century'
  | 'talk-of-the-town'
  | 'nest-egg'
  | 'showpiece'
  | 'one-big-family'
  | 'pins-and-needles'
  | 'good-vibrations';

/** A one-off feat in the campaign, worth some karma the first time it is done in any center. */
export interface AchievementDef {
  id: AchievementId;
  name: string;
  icon: string;
  /** What it takes, in a few words. */
  desc: string;
  /** Done when this objective is met. */
  goal: GoalSpec;
  karma: number;
}

export type AwardId =
  | 'healing-hands'
  | 'busiest'
  | 'no-waiting'
  | 'fair-prices'
  | 'healthy-books'
  | 'happy-team'
  | 'healer-of-the-year'
  | 'caretaker-of-the-year'
  | 'center-of-the-year';
/** One of the awards handed out at the end of each year. */
export interface AwardDef {
  id: AwardId;
  name: string;
  icon: string;
  /** What it is for, in a few words. */
  desc: string;
  /** What winning it pays the center. */
  prize: number;
}
/** Something a guest feels about their visit. */
export type FeelingId =
  | 'healed'
  | 'not-healed'
  | 'sent-home'
  | 'no-kit'
  | 'unqualified'
  | 'grump'
  | 'kind'
  | 'long-wait'
  | 'quick'
  | 'thirsty'
  | 'hungry'
  | 'bursting'
  | 'filthy-toilet'
  | 'litter'
  | 'pleasant'
  | 'comfy'
  | 'refreshed'
  | 'played'
  | 'fine-room'
  | 'underwhelmed'
  | 'pricey'
  | 'bargain'
  | 'worse'
  | 'bad-vibes'
  | 'calmed'
  | 'noisy'
  | 'peaceful'
  | 'stale-linens'
  | 'too-cold'
  | 'too-hot'
  | 'rested'
  | 'woozy'
  | 'class'
  | 'no-class';
/** A part of the center's reputation. */
export type ReputationPart = 'results' | 'experience' | 'value' | 'staff';
export interface FeelingDef {
  id: FeelingId;
  icon: string;
  /** What it was, as their inspector lists it. */
  text: string;
  good: boolean;
  /** The part of the center's reputation it speaks to. */
  part: ReputationPart;
  /** What they might write about it in a review. */
  lines: readonly string[];
}
/** A kind of marketing campaign. */
export type CampaignKind = 'word' | 'condition' | 'recruit';
export interface CampaignDef {
  kind: CampaignKind;
  name: string;
  icon: string;
  desc: string;
  /** What it costs for each month it runs. */
  perMonth: number;
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
  | { kind: 'noQuits'; days: number }
  /** Reach this grade of standing, counting from 0 for the first. */
  | { kind: 'grade'; grade: number };

/** The objectives for one star: all must be met at once. */
export type StarGoal = readonly GoalSpec[];

export type CenterId = 'sandbox' | 'willow' | 'exchange' | 'boardwalk' | 'highpines' | 'orchard';

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
  /** Rush hours: arrivals come in waves every few days, and guests are less patient while they last. */
  rush?: RushHours;
  /** Seasons: busier summers and quieter winters. */
  seasons?: Seasons;
  /** How much faster than usual equipment wears out here. */
  wear?: number;
  /** House calls: how much more often than usual they are offered here, and who here asks for them. */
  calls?: { often: number; clients: readonly string[] };
  /** Snowed-in spells in winter, when nobody can get up the road. */
  snow?: Snowfall;
  /** What surrounds the building: a park, the seaside, snowy mountains or apple orchards. */
  scenery?: 'park' | 'seaside' | 'mountain' | 'orchard';
  /** Treatments, rooms and items open from the start as though this many stars were already earned. */
  unlockedFrom?: number;
  /** Picky guests: how much more they pay for a treatment, and how many more stars of prestige they expect of its room. */
  picky?: { fee: number; expects: number };
  /** How much more often than usual the health inspector calls. */
  inspections?: number;
  /** The mishap of its own that comes now and then, if any. */
  mishap?: MishapId;
  /** The weather outside through the year. */
  climate: Climate;
}

/** The weather outside, in degrees Fahrenheit: the year's average, and how far above it summer goes and below it winter. */
export interface Climate {
  average: number;
  swing: number;
}

/** How often a winter's spell of a few days is snowed in, from 0 to 1, and how many days a spell lasts. */
export interface Snowfall {
  chance: number;
  days: number;
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
