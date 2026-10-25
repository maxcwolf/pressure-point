// The shapes of the game's content: what a room, an item, a role, a modality and a condition are.

import type { IconId } from './icon-ids';
import type { Plot, PlotDef } from './map';
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
  | 'lodge'
  | 'staffroom'
  | 'restroom'
  | 'training'
  | 'kneader'
  | 'pinpress'
  | 'aurawash'
  | 'alphorn'
  | 'cider'
  | 'rebirth';

/** Whether someone is a woman or a man: their hair and first name follow it. */
export type Sex = 'female' | 'male';

/** How a heater or air conditioner is set to run: as the weather calls for, off, or at a set power. */
export type ThermostatSetting = 'auto' | 'off' | 'low' | 'medium' | 'high';

export type Role =
  | 'receptionist'
  | 'consultant'
  | 'therapist'
  | 'acupuncturist'
  | 'practitioner'
  | 'healer'
  | 'instructor'
  | 'shaman'
  | 'caretaker';

/** A family of treatments with its own room, staff and equipment. */
export type Discipline = 'massage' | 'acupuncture' | 'reiki' | 'sound' | 'shaman';

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
  | 'soundproof_panel'
  | 'wind_chimes'
  | 'fortune_teller'
  | 'kombucha_tap'
  | 'staff_fridge'
  | 'generator'
  | 'motivational_poster'
  | 'landscape_painting'
  | 'wall_clock'
  | 'chakra_chart'
  | 'meridian_poster'
  | 'television'
  | 'tapestry'
  | 'prayer_flags'
  | 'living_wall'
  | 'wall_fountain'
  | 'certificate'
  | 'lounger'
  | 'instructor_mat'
  | 'practice_spot'
  | 'ceremony_mat'
  | 'ember_bowl'
  | 'rattle'
  | 'sweat_lodge'
  | 'mushroom_altar'
  | 'brew_pot'
  | 'kneadmaster'
  | 'pin_press'
  | 'aura_wash'
  | 'great_alphorn'
  | 'cider_press'
  | 'wheel_of_rebirth'
  | 'stone_kiln'
  | 'octopus'
  | 'geode'
  | 'big_gong'
  | 'fog_machine';

export interface RoomDef {
  type: RoomType;
  name: string;
  icon: IconId;
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
  /** The only centers it can be built in, for a center's signature room. Absent means anywhere. */
  only?: readonly CenterId[];
  /** What the speakers say when the first one is finished, once a game. */
  opening?: string;
}

export type AccessRole =
  'staff' | 'guest' | 'exit' | 'seat' | 'rest' | 'recover' | 'toilet' | 'drink' | 'eat' | 'play' | 'study';

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
  /**
   * How they lie, when the pose is `lie`: face down on a table with the face turned aside (`prone`), or on their back
   * (`back`). When not given, face down with the arms out, as a machine lays them for its gag.
   */
  lie?: 'prone' | 'back';
}

export interface ItemDef {
  type: ItemType;
  name: string;
  icon: IconId;
  desc: string;
  cost: number;
  w: number;
  h: number;
  access: AccessDef[];
  /**
   * Where it may be placed: in a corridor, anywhere indoors, in a kind of room, or outdoors on the center's own grounds,
   * off the paths and the street.
   */
  where: 'corridor' | 'any' | 'outdoors' | RoomType;
  /** Other kinds of room it may go in too, for an item whose `where` is a room. */
  alsoIn?: readonly RoomType[];
  /**
   * It hangs on a wall rather than standing on the floor. Its tiles are the floor in front of it, which it faces, so
   * it belongs to the room or corridor there; it blocks nothing, and is hung on the inside of a room's walls or the
   * building's outer wall. It runs `w` tiles along the wall.
   */
  mount?: 'wall';
  /**
   * Stations have a staff position and a line of guests. A group station has no staff position of its own: it is
   * worked from the lead station in its room, whose member of staff serves every group station there at once. A
   * station with no `staff` runs itself, and serves its line whenever it is working.
   */
  station?: {
    staff?: Role;
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
  /**
   * How many tiles its decor reaches, if not `DECOR_RADIUS`: a few for something small like a plant or a poster, a
   * whole stretch for a centerpiece like a fountain.
   */
  reach?: number;
  /** People can walk over it, and furniture can stand on it. */
  walkable?: boolean;
  /** Wear added each time it is used. At 100 it breaks until a Caretaker repairs it. */
  wear?: number;
  /** Wear added each day it stands, for something that wears whether or not anyone uses it, like a generator. */
  dailyWear?: number;
  /** What a day carrying the center through a mishap costs in fuel, for something that runs on it, like a generator. */
  dailyCost?: number;
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
  /**
   * How many tiles its warmth or cool reaches, if not `HEAT_RADIUS`, for something made to heat or cool a room: it
   * fades gently over the first few tiles too (`HEAT_EASE`).
   */
  heatReach?: number;
  /**
   * It has a thermostat, set on each one (`ThermostatSetting`): on Auto a heater warms its spot no further than just
   * right, and only while it is cool indoors, an air conditioner the other way round, and either is off while the
   * weather is nice; or it is set to run low, medium or high whatever the weather, or switched off.
   */
  thermostat?: boolean;
  /** A table with linens on it, soiled a little with each session until a Caretaker changes them. */
  linens?: boolean;
  /** It has a front and a back, so a marker shows which way it will face while it is being placed. */
  front?: boolean;
  /**
   * What it faces: while it is held, it turns to face the nearest such item in the room under the cursor; R turns it by
   * hand instead.
   */
  faces?: ItemType;
  /**
   * Treatment equipment that can be upgraded, up to `UPGRADE_LEVELS`, by a Caretaker with the Mechanics course: what
   * the upgrades are priced against, each level a share of it (`UPGRADE_PRICE`).
   */
  upgrade?: number;
  /** A treatment machine: what it does, and what it takes to run. */
  machine?: MachineDef;
  /** What it costs to run each month, paid with the wages, for equipment that runs itself but is no treatment machine. */
  upkeep?: number;
}

/**
 * What a treatment machine does and costs to run. A signature machine is the one required item of its room, and the
 * only place its own techniques are done; a machine for a technique done on tables too takes a table's place for it.
 */
export interface MachineDef {
  /** The techniques it does, all of its station's discipline. */
  performs: readonly Modality[];
  /** Session length, times this. */
  seconds?: number;
  /** Added to the chance of a session working. */
  success?: number;
  /** How hard a session is on staff energy, times this. */
  strain?: number;
  /** What its power and parts cost each month, paid with the wages. */
  upkeep: number;
  /** Noise it makes only while someone is inside, heard outside its room. */
  runNoise?: number;
  /** Warmth it gives off only while someone is inside. */
  runHeat?: number;
  /**
   * It smokes once worn past `from`, and then after each session may overload: out of action until a Caretaker sees
   * to it, with a bill for parts, and a mess of its own, in a few words for the toast. For a machine with a flame or a
   * motor, `fire` is the share of its overloads that set it on fire instead.
   */
  overload?: { from: number; chance: number; bill: number; mess: string; fire?: number };
  /** A room next door it works better beside: faster, or likelier to work. */
  beside?: { room: RoomType; seconds?: number; success?: number };
  /** It helps every session in its room, rather than taking guests itself: sessions take this times as long. */
  boosts?: { seconds: number };
  /**
   * Noise it shakes through the walls into every room next door while a session plays in its own: as loud as this
   * along the shared wall, fading across the room.
   */
  rattle?: number;
  /** Guests who leave it healed go away happier for something it gives them, a feeling of their own. */
  gift?: FeelingId;
  /** Trips in its room count the set and setting as perfect, whatever the room is like. */
  setting?: boolean;
}

export interface RoleDef {
  role: Role;
  name: string;
  icon: IconId;
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
  /** Whether it costs you, in slower work, faster tiring, litter or put-off guests: shown red, where the rest show green. */
  bad?: boolean;
}

/** A course any member of staff (or any in some roles) can take, beyond the treatments of their discipline. */
export type GeneralId = 'bedside' | 'motivation' | 'stamina' | 'service' | 'maintenance' | 'smudging' | 'mechanics';

export interface GeneralDef {
  id: GeneralId;
  name: string;
  icon: IconId;
  desc: string;
  cost: number;
  days: number;
  /** The roles it is for; absent means every role. */
  roles?: readonly Role[];
}

/** Something a member of staff can be kept to or kept from: a kind of station, or a kind of Caretaker's job. */
export type Duty = 'reception' | 'shop' | 'consult' | 'litter' | 'clean' | 'repair' | 'plants' | 'stones';

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
  | 'overtone'
  | 'reading'
  | 'extraction'
  | 'sweat'
  | 'mushroom'
  | 'ayahuasca'
  | 'quest'
  | 'kneading'
  | 'impression'
  | 'aurawash'
  | 'alphorn'
  | 'pressing'
  | 'rebirth';

export interface ModalityDef {
  id: Modality;
  discipline: Discipline;
  name: string;
  icon: IconId;
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
  /** A psychedelic ceremony: the room's set and setting count double, and a failure is a bad trip. */
  trip?: boolean;
  /** Done only on this machine, in its own room: never on a table, and never on a house call. */
  machine?: ItemType;
}

export interface DisciplineDef {
  id: Discipline;
  name: string;
  icon: IconId;
  desc: string;
  role: Role;
  room: RoomType;
  /** The modality everyone in the role starts with. */
  base: Modality;
  /** How often guests come for it against massage, before its following and its rooms count: niche ones less. */
  popularity: number;
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
  | 'glass'
  | 'chicken'
  | 'goat'
  | 'brent'
  | 'compass'
  | 'toxic'
  | 'leash'
  | 'cactus'
  | 'bighead'
  | 'chairshape'
  | 'bags'
  | 'bluescreen'
  | 'beachhead'
  | 'salt'
  | 'seaweed'
  | 'echo'
  | 'snowcap'
  | 'grapes'
  | 'rotten'
  | 'oldsoul'
  | 'ruff';

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
  | 'monotone'
  | 'chicken'
  | 'goat'
  | 'brent'
  | 'toxicex'
  | 'spiritanimal'
  | 'parched'
  | 'midlife'
  | 'ego'
  | 'lost'
  | 'chairshaped'
  | 'mallback'
  | 'bluescreen'
  | 'outofoffice'
  | 'salted'
  | 'washedup'
  | 'echo'
  | 'snowedin'
  | 'sourgrapes'
  | 'badapple'
  | 'oldsoul'
  | 'pastlife';

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
  /**
   * Something in the spine or the joints that a Consultant can tell is there but cannot pin down: only a posture scan
   * makes the diagnosis sure, and without one the treatment is a best guess.
   */
  structural?: boolean;
}

export type AchievementId =
  | 'called-in'
  | 'century'
  | 'talk-of-the-town'
  | 'nest-egg'
  | 'showpiece'
  | 'one-big-family'
  | 'pins-and-needles'
  | 'good-vibrations'
  | 'price-is-right'
  | 'busted'
  | 'under-the-counter';

/** A one-off feat in the campaign, worth some karma the first time it is done in any center. */
export interface AchievementDef {
  id: AchievementId;
  name: string;
  icon: IconId;
  /** What it takes, in a few words. */
  desc: string;
  /** Done when this objective is met. */
  goal: GoalSpec;
  karma: number;
  /** Shown only as a locked mystery card until it is earned. */
  hidden?: boolean;
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
  icon: IconId;
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
  | 'rebirth-ride'
  | 'fortune'
  | 'lucky'
  | 'puddle'
  | 'wet-feet'
  | 'no-restroom'
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
  | 'out-in-weather'
  | 'rested'
  | 'woozy'
  | 'class'
  | 'no-class'
  | 'good-trip'
  | 'bad-trip'
  | 'freaked'
  | 'ran-out'
  | 'cider'
  | 'blaze';
/** A part of the center's reputation. */
export type ReputationPart = 'results' | 'experience' | 'value' | 'staff';
export interface FeelingDef {
  id: FeelingId;
  icon: IconId;
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
  icon: IconId;
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
  /** Heal at least this share of the guests treated or sent home in a month (with at least a few of them). */
  | { kind: 'cureRate'; percent: number }
  /** Heal at least this many guests in a month, with the guests who left that month waiting this long or less on average. */
  | { kind: 'monthHeals'; count: number; days: number }
  /** See emergencies through to the end successfully. */
  | { kind: 'emergencies'; count: number }
  /** Have a finished room of this type at this prestige or better. */
  | { kind: 'prestige'; room: RoomType; level: number }
  /** Go this many days without anyone quitting. */
  | { kind: 'noQuits'; days: number }
  /** Reach this grade of standing, counting from 0 for the first. */
  | { kind: 'grade'; grade: number }
  /** Heal at least this many guests in a month in which nobody was put off by the prices. */
  | { kind: 'fairMonth'; count: number }
  /** Have the health inspector find the mushrooms under the counter this many times. */
  | { kind: 'busted'; count: number }
  /** Take this much from mushroom sales. */
  | { kind: 'mushroomSales'; amount: number };

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
  /** How wide its lot is, in tiles, where it is wider than the usual LOT_W. */
  width?: number;
  startMoney: number;
  /** The objectives for each star in turn. */
  goals: readonly StarGoal[];
  /** The optional disciplines on offer here, each still opened by its room's star. Massage is always on offer. */
  disciplines: readonly Discipline[];
  /** Whether Qi Gong classes are on offer here, still opened by the studio's star. */
  qigong: boolean;
  /** How much more (or less) often guests arrive with a condition here than elsewhere. Unlisted ones count once. */
  conditions?: Partial<Record<ConditionId, number>>;
  /** Rush hours: arrivals come in waves every few days, and guests are less patient while they last. */
  rush?: RushHours;
  /** Seasons: busier summers and quieter winters. */
  seasons?: Seasons;
  /** How much more often than usual guests arrive here, all year round. */
  arrivals?: number;
  /** How much faster than usual equipment wears out here. */
  wear?: number;
  /** House calls: how much more often than usual they are offered here, and who here asks for them. */
  calls?: { often: number; clients: readonly string[] };
  /** Snowed-in spells in winter, when nobody can get up the road. */
  snow?: Snowfall;
  /** What surrounds the building: a park, the seaside, snowy mountains, apple orchards or a downtown office park. */
  scenery?: 'park' | 'seaside' | 'mountain' | 'orchard' | 'downtown';
  /** Whether the lot is on a high street: its road and pavements run on past the lot, with hedges and lamp posts. */
  highStreet?: boolean;
  /** The plots of land it sells next to the building, in the order they come up for sale. */
  plots: readonly PlotDef[];
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
