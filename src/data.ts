// Static game data: map layout, rooms, items, staff roles, conditions, flavour text.

export const GAME_TITLE = 'Pressure Point Institute';
/** The title broken up for the places that stack it: the lawn sign and the title screen. */
export const TITLE_LINES = ['Pressure', 'Point', 'Institute'] as const;

// ---- Map -------------------------------------------------------------------
export const W = 32;
export const H = 24;
/** Building interior bounds (inclusive). */
export const BX0 = 3;
export const BX1 = 27;
export const BY0 = 3;
export const BY1 = 17;
export const ENT_X = [14, 15];
export const ENT_IN_Y = BY1;
export const ENT_OUT_Y = BY1 + 1;
export const SIDEWALK_Y = 20;
export const ROAD_Y = [21, 22];

// ---- Time ------------------------------------------------------------------
export const DAY_SECONDS = 6;
export const DAYS_PER_MONTH = 30;
export const START_MONEY = 30000;

// ---- Rooms -----------------------------------------------------------------
export type RoomType = 'consult' | 'massage' | 'staffroom' | 'restroom' | 'training';
export type Role = 'receptionist' | 'consultant' | 'therapist' | 'caretaker';
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
  | 'study_desk';

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
}

export const ROOMS: Record<RoomType, RoomDef> = {
  consult: {
    type: 'consult',
    name: 'Consultation Room',
    icon: '🩺',
    desc: 'Where a Wellness Consultant works out what on earth is wrong with people.',
    cost: 4000,
    minShort: 3,
    minLong: 3,
    required: ['consult_desk', 'cabinet'],
    staff: 'consultant',
    floor: ['#8fb8d8', '#84aed0'],
    trim: 0x3f7fb5,
  },
  massage: {
    type: 'massage',
    name: 'Massage Suite',
    icon: '💆',
    desc: 'Knots are untied, slumps are unslumped. Needs a Massage Therapist.',
    cost: 7000,
    minShort: 3,
    minLong: 3,
    required: ['massage_table', 'oil_trolley'],
    staff: 'therapist',
    floor: ['#d9b48a', '#cfa87c'],
    trim: 0x9a6fc9,
  },
  staffroom: {
    type: 'staffroom',
    name: 'Staff Room',
    icon: '☕',
    desc: 'Tired staff members recover here. Without one they get slow, then grumpy.',
    cost: 3000,
    minShort: 3,
    minLong: 3,
    required: ['sofa'],
    floor: ['#eab07a', '#e3a56c'],
    trim: 0xe0803a,
  },
  restroom: {
    type: 'restroom',
    name: 'Restroom',
    icon: '🚻',
    desc: 'All that herbal tea has to go somewhere.',
    cost: 2500,
    minShort: 2,
    minLong: 3,
    required: ['toilet', 'sink'],
    floor: ['#bfe6d8', '#a9dccb'],
    trim: 0x3aa58a,
  },
  training: {
    type: 'training',
    name: 'Training Room',
    icon: '🎓',
    desc: 'Staff members study here to learn new massage modalities or sharpen their skills.',
    cost: 4500,
    minShort: 3,
    minLong: 3,
    required: ['whiteboard', 'study_desk'],
    floor: ['#c3d9a6', '#b7cf98'],
    trim: 0x5f9440,
  },
};
export const ROOM_ORDER: RoomType[] = ['consult', 'massage', 'staffroom', 'restroom', 'training'];

// ---- Items -----------------------------------------------------------------
export type AccessRole = 'staff' | 'guest' | 'seat' | 'rest' | 'toilet' | 'drink' | 'eat' | 'study';
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
  station?: { staff: Role; goal: 'reception' | 'consult' | 'treat'; seconds: number };
  inMenu?: boolean;
  /** Stars needed before it can be bought. */
  unlock?: number;
}

export const ITEMS: Record<ItemType, ItemDef> = {
  reception_desk: {
    type: 'reception_desk',
    name: 'Reception Desk',
    icon: '🛎️',
    desc: 'Guests check in here first. Needs a Receptionist.',
    cost: 1200,
    w: 3,
    h: 1,
    where: 'corridor',
    access: [
      { role: 'staff', x: 1, y: -1, px: 1.5, py: -0.35, face: [0, 1], pose: 'stand' },
      { role: 'guest', x: 1, y: 1, px: 1.5, py: 1.4, face: [0, -1], pose: 'stand' },
    ],
    station: { staff: 'receptionist', goal: 'reception', seconds: 3.5 },
    inMenu: true,
  },
  consult_desk: {
    type: 'consult_desk',
    name: 'Consultation Desk',
    icon: '🩺',
    desc: 'A desk, two chairs, and a computer that mostly plays whale song.',
    cost: 0,
    w: 2,
    h: 1,
    where: 'consult',
    access: [
      { role: 'staff', x: 0, y: -1, px: 0.5, py: -0.38, face: [0, 1], pose: 'sit' },
      { role: 'guest', x: 0, y: 1, px: 0.5, py: 1.38, face: [0, -1], pose: 'sit' },
    ],
    station: { staff: 'consultant', goal: 'consult', seconds: 6 },
  },
  cabinet: {
    type: 'cabinet',
    name: 'Chart Cabinet',
    icon: '🗄️',
    desc: 'Full of charts. Nobody has checked which side is up.',
    cost: 0,
    w: 1,
    h: 1,
    where: 'consult',
    access: [],
  },
  massage_table: {
    type: 'massage_table',
    name: 'Massage Table',
    icon: '💆',
    desc: 'Face hole included at no extra charge.',
    cost: 0,
    w: 1,
    h: 2,
    where: 'massage',
    access: [
      { role: 'staff', x: -1, y: 1, px: -0.28, py: 1.0, face: [1, 0], pose: 'stand' },
      { role: 'guest', x: 1, y: 1, px: 0.5, py: 1.0, face: [0, -1], pose: 'lie', h: 0.6 },
    ],
    station: { staff: 'therapist', goal: 'treat', seconds: 10 },
  },
  oil_trolley: {
    type: 'oil_trolley',
    name: 'Oil Cart',
    icon: '🧴',
    desc: 'Lavender, eucalyptus, and one unlabeled bottle everyone avoids.',
    cost: 0,
    w: 1,
    h: 1,
    where: 'massage',
    access: [],
  },
  sofa: {
    type: 'sofa',
    name: 'Squishy Couch',
    icon: '🛋️',
    desc: 'Staff members recharge here. Seats two.',
    cost: 600,
    w: 2,
    h: 1,
    where: 'staffroom',
    access: [
      { role: 'rest', x: 0, y: 1, px: 0.5, py: 0.55, face: [0, 1], pose: 'sit' },
      { role: 'rest', x: 1, y: 1, px: 1.5, py: 0.55, face: [0, 1], pose: 'sit' },
    ],
    inMenu: true,
  },
  toilet: {
    type: 'toilet',
    name: 'Toilet Stall',
    icon: '🚽',
    desc: 'One guest at a time, please.',
    cost: 500,
    w: 1,
    h: 1,
    where: 'restroom',
    access: [{ role: 'toilet', x: 0, y: 1, px: 0.5, py: 0.5, face: [0, 1], pose: 'sit' }],
    inMenu: true,
  },
  sink: {
    type: 'sink',
    name: 'Sink',
    icon: '🚰',
    desc: 'Mostly for show.',
    cost: 0,
    w: 1,
    h: 1,
    where: 'restroom',
    access: [],
  },
  bench: {
    type: 'bench',
    name: 'Bench',
    icon: '🪑',
    desc: 'Seated guests stay patient for longer. Seats two.',
    cost: 150,
    w: 2,
    h: 1,
    where: 'corridor',
    access: [
      { role: 'seat', x: 0, y: 1, px: 0.5, py: 0.55, face: [0, 1], pose: 'sit' },
      { role: 'seat', x: 1, y: 1, px: 1.5, py: 0.55, face: [0, 1], pose: 'sit' },
    ],
    inMenu: true,
  },
  plant: {
    type: 'plant',
    name: 'Potted Plant',
    icon: '🪴',
    desc: 'Improves the ambience. Needs watering by a Janitor.',
    cost: 120,
    w: 1,
    h: 1,
    where: 'any',
    access: [],
    inMenu: true,
  },
  tea_station: {
    type: 'tea_station',
    name: 'Herbal Tea Station',
    icon: '🍵',
    desc: 'Quenches thirst and earns a little money per cup.',
    cost: 800,
    w: 1,
    h: 1,
    where: 'corridor',
    access: [{ role: 'drink', x: 0, y: 1, px: 0.5, py: 1.3, face: [0, -1], pose: 'stand' }],
    inMenu: true,
  },
  snack_machine: {
    type: 'snack_machine',
    name: 'Granola Dispenser',
    icon: '🥜',
    desc: 'Feeds hungry guests for a fee. Wrappers end up on the floor.',
    cost: 1000,
    w: 1,
    h: 1,
    where: 'corridor',
    access: [{ role: 'eat', x: 0, y: 1, px: 0.5, py: 1.3, face: [0, -1], pose: 'stand' }],
    inMenu: true,
  },
  bin: {
    type: 'bin',
    name: 'Trash Can',
    icon: '🗑️',
    desc: 'Guests near a trash can are far less likely to litter.',
    cost: 60,
    w: 1,
    h: 1,
    where: 'any',
    access: [],
    inMenu: true,
  },
  fountain: {
    type: 'fountain',
    name: 'Zen Fountain',
    icon: '⛲',
    desc: 'A soothing trickle. Big ambience boost.',
    cost: 900,
    w: 1,
    h: 1,
    where: 'corridor',
    access: [],
    inMenu: true,
  },
  stone_warmer: {
    type: 'stone_warmer',
    name: 'Stone Warmer',
    icon: '🪨',
    desc: 'Heats basalt stones for Hot Stone massage. A Janitor keeps it hot.',
    cost: 900,
    w: 1,
    h: 1,
    where: 'massage',
    access: [],
    inMenu: true,
    unlock: 2,
  },
  stretch_rack: {
    type: 'stretch_rack',
    name: 'Stretch Rack',
    icon: '🤸',
    desc: 'Mats, bands and rollers. Needed for Sports massage.',
    cost: 600,
    w: 1,
    h: 1,
    where: 'massage',
    access: [],
    inMenu: true,
    unlock: 1,
  },
  whiteboard: {
    type: 'whiteboard',
    name: 'Whiteboard',
    icon: '🧑‍🏫',
    desc: 'Covered in diagrams of shoulders with arrows pointing at them.',
    cost: 0,
    w: 2,
    h: 1,
    where: 'training',
    access: [],
  },
  study_desk: {
    type: 'study_desk',
    name: 'Study Desk',
    icon: '📚',
    desc: 'One member of staff can train here at a time. Add more to train several at once.',
    cost: 400,
    w: 1,
    h: 1,
    where: 'training',
    access: [{ role: 'study', x: 0, y: 1, px: 0.5, py: 1.32, face: [0, -1], pose: 'sit' }],
    inMenu: true,
  },
};
export const ITEM_MENU: ItemType[] = [
  'reception_desk',
  'bench',
  'plant',
  'tea_station',
  'snack_machine',
  'bin',
  'fountain',
  'sofa',
  'toilet',
  'study_desk',
  'stretch_rack',
  'stone_warmer',
];

// ---- Staff -----------------------------------------------------------------
export interface RoleDef {
  role: Role;
  name: string;
  icon: string;
  desc: string;
  baseSalary: number;
  uniform: number;
  accent: number;
}
export const ROLES: Record<Role, RoleDef> = {
  receptionist: {
    role: 'receptionist',
    name: 'Receptionist',
    icon: '🛎️',
    desc: 'Checks guests in at a Reception Desk.',
    baseSalary: 800,
    uniform: 0x2fa8a0,
    accent: 0xffffff,
  },
  consultant: {
    role: 'consultant',
    name: 'Wellness Consultant',
    icon: '🩺',
    desc: 'Diagnoses guests in a Consultation Room. Skill means fewer repeat visits.',
    baseSalary: 1700,
    uniform: 0xf4f1ea,
    accent: 0x3f7fb5,
  },
  therapist: {
    role: 'therapist',
    name: 'Massage Therapist',
    icon: '💆',
    desc: 'Treats guests in a Massage Suite. Each one knows certain modalities; train them to add more.',
    baseSalary: 1400,
    uniform: 0xa784d6,
    accent: 0xf4f1ea,
  },
  caretaker: {
    role: 'caretaker',
    name: 'Janitor',
    icon: '🧹',
    desc: 'Clears litter and waters the plants.',
    baseSalary: 600,
    uniform: 0x7d8f45,
    accent: 0xe8c65a,
  },
};
export const ROLE_ORDER: Role[] = ['receptionist', 'consultant', 'therapist', 'caretaker'];

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  speed?: number; // service speed multiplier
  stamina?: number; // energy drain multiplier (lower is better)
  pay?: number; // salary multiplier
  walk?: number; // walk speed multiplier
}
export const TRAITS: TraitDef[] = [
  { id: 'brisk', name: 'Brisk', desc: 'Works 20% faster.', speed: 1.2, pay: 1.1 },
  { id: 'tireless', name: 'Tireless', desc: 'Tires 35% more slowly.', stamina: 0.65, pay: 1.1 },
  { id: 'chatty', name: 'Chatterbox', desc: 'Works 15% slower. Has opinions about crystals.', speed: 0.85, pay: 0.92 },
  { id: 'sleepy', name: 'Sleepyhead', desc: 'Tires 35% faster.', stamina: 1.35, pay: 0.9 },
  { id: 'speedy', name: 'Power Walker', desc: 'Gets around 30% faster.', walk: 1.3, pay: 1.05 },
  { id: 'dawdler', name: 'Dawdler', desc: 'Has never hurried in their life.', walk: 0.8, pay: 0.92 },
  { id: 'bargain', name: 'Undervalued', desc: 'Asks for 15% less pay. Do not tell them.', pay: 0.85 },
];
export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

// ---- Massage modalities -----------------------------------------------------
export type Modality = 'swedish' | 'deep' | 'sports' | 'stone' | 'cranio';
export interface ModalityDef {
  id: Modality;
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
export const MODALITIES: Record<Modality, ModalityDef> = {
  swedish: {
    id: 'swedish',
    name: 'Swedish',
    icon: '🌿',
    desc: 'Long, flowing strokes. Quick, cheap and reliable. Every therapist knows it.',
    star: 0,
    seconds: 9,
    strain: 1,
    difficulty: 0,
    trainCost: 0,
    trainDays: 0,
  },
  deep: {
    id: 'deep',
    name: 'Deep Tissue',
    icon: '💪',
    desc: 'Elbows, knuckles and determination. Wears the therapist out fast.',
    star: 1,
    seconds: 11,
    strain: 1.9,
    difficulty: 0.05,
    trainCost: 1500,
    trainDays: 6,
  },
  sports: {
    id: 'sports',
    name: 'Sports',
    icon: '🤸',
    desc: 'Stretching, pulling and the occasional alarming click. A long session that is hard to get right.',
    star: 1,
    equipment: 'stretch_rack',
    seconds: 15,
    strain: 1.4,
    difficulty: 0.14,
    trainCost: 1800,
    trainDays: 6,
  },
  stone: {
    id: 'stone',
    name: 'Hot Stone',
    icon: '🪨',
    desc: 'Warm basalt stones along the spine. Lucrative, as long as someone keeps the stones hot.',
    star: 2,
    equipment: 'stone_warmer',
    seconds: 12,
    strain: 0.8,
    difficulty: 0.04,
    trainCost: 2200,
    trainDays: 7,
  },
  cranio: {
    id: 'cranio',
    name: 'Cranio-sacral',
    icon: '👐',
    desc: 'Barely touching the head, very slowly. Slow and expensive, and it takes a skilled pair of hands.',
    star: 2,
    seconds: 16,
    strain: 0.6,
    difficulty: 0.22,
    trainCost: 2800,
    trainDays: 9,
  },
};
export const MODALITY_ORDER: Modality[] = ['swedish', 'deep', 'sports', 'stone', 'cranio'];
/** Stone warmers lose this much heat per Hot Stone session and are useless below it. */
export const STONE_USE = 25;
/** Chance of success is multiplied by this when the modality cannot be delivered properly. */
export const BOTCH_FACTOR = 0.35;

// ---- Conditions ------------------------------------------------------------
export type Visual = 'knot' | 'slump' | 'steam' | 'stiff' | 'neck' | 'band' | 'crick' | 'flex' | 'frost' | 'dizzy';
export interface ConditionDef {
  id: string;
  name: string;
  desc: string;
  treatment: string;
  modality: Modality;
  fee: number;
  visual: Visual;
}
export const CONDITIONS: ConditionDef[] = [
  {
    id: 'slump',
    name: 'Desk Slump',
    desc: 'The spine has taken on the shape of a budget office chair.',
    treatment: 'Swedish Straightening',
    modality: 'swedish',
    fee: 900,
    visual: 'slump',
  },
  {
    id: 'band',
    name: 'Tension Headband',
    desc: 'A band of pure tension around the skull, now visible to the naked eye.',
    treatment: 'Swedish Unwinding',
    modality: 'swedish',
    fee: 850,
    visual: 'band',
  },
  {
    id: 'knotted',
    name: 'Knotted Up',
    desc: 'Years of shrugging things off have tied the shoulders in an actual knot.',
    treatment: 'Deep Tissue Untangling',
    modality: 'deep',
    fee: 1100,
    visual: 'knot',
  },
  {
    id: 'crick',
    name: 'Crick of the Neck',
    desc: 'Slept funny once. Has been looking at everything sideways since.',
    treatment: 'Deep Tissue Decricking',
    modality: 'deep',
    fee: 1150,
    visual: 'crick',
  },
  {
    id: 'stiff',
    name: 'Stiff Upper Everything',
    desc: 'Started at the lip. Has since reached the ankles.',
    treatment: 'Sports Loosening',
    modality: 'sports',
    fee: 1350,
    visual: 'stiff',
  },
  {
    id: 'flex',
    name: 'Gym Lock',
    desc: 'One bicep curl too many. The arms have not come down since.',
    treatment: 'Sports Unflexing',
    modality: 'sports',
    fee: 1400,
    visual: 'flex',
  },
  {
    id: 'steam',
    name: 'Stress Head',
    desc: 'Pressure builds between the ears. Whistles when a deadline is near.',
    treatment: 'Hot Stone De-steaming',
    modality: 'stone',
    fee: 1600,
    visual: 'steam',
  },
  {
    id: 'frost',
    name: 'Cold Shoulder',
    desc: 'Given to so many people that it has frozen solid.',
    treatment: 'Hot Stone Defrosting',
    modality: 'stone',
    fee: 1650,
    visual: 'frost',
  },
  {
    id: 'neck',
    name: 'Text Neck',
    desc: 'Head locked at the precise angle of a phone that is no longer there.',
    treatment: 'Cranio-sacral Unscrolling',
    modality: 'cranio',
    fee: 1900,
    visual: 'neck',
  },
  {
    id: 'dizzy',
    name: 'Scrambled Noggin',
    desc: 'Thoughts orbit the head instead of staying inside it.',
    treatment: 'Cranio-sacral Unscrambling',
    modality: 'cranio',
    fee: 2000,
    visual: 'dizzy',
  },
];
export const CONDITION_BY_ID: Record<string, ConditionDef> = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c]),
);
export const CONSULT_FEE = 200;
export const DIAGNOSIS_TARGET = 0.75;

// ---- Objectives ------------------------------------------------------------
export interface StarGoal {
  healed: number;
  reputation: number;
  balance: number;
}
export const STAR_GOALS: StarGoal[] = [
  { healed: 8, reputation: 40, balance: 0 },
  { healed: 30, reputation: 60, balance: 50000 },
  { healed: 80, reputation: 80, balance: 120000 },
];

// ---- Flavour ---------------------------------------------------------------
export const FIRST_NAMES = [
  'Ada', 'Barnaby', 'Cleo', 'Dmitri', 'Edie', 'Fergus', 'Greta', 'Hamish', 'Ines', 'Jasper',
  'Kiki', 'Lionel', 'Mabel', 'Nico', 'Odette', 'Percy', 'Queenie', 'Rufus', 'Saskia', 'Tobias',
  'Uma', 'Vernon', 'Wilma', 'Xander', 'Yolanda', 'Zeb', 'Priya', 'Kenji', 'Amara', 'Mateo',
  'Noor', 'Soren', 'Tamsin', 'Idris', 'Beatrix', 'Cosmo',
];
export const LAST_NAMES = [
  'Kneadham', 'Rubsworth', 'Stretchley', 'Oilfield', 'Thumbwell', 'Knuckleby', 'Palmer-Pressley',
  'Soothington', 'Limberlake', 'Achewood', 'Tenderson', 'Crickmore', 'Spinewell', 'Loosely',
  'Relaxworth', 'Supple', 'Kinkaid', 'Twinge', 'Balmforth', 'Unwind', 'Shoulders', 'Calmley',
  'Flexmoor', 'Easeby', 'Musselwhite', 'Pummell', 'Glide', 'Hotstone',
];

export const ANNOUNCEMENTS = [
  'Guests are reminded that the knots are not contagious.',
  'Would the owner of a red aura please move it from the fire exit.',
  'Please do not tip the therapists. They fall over.',
  'Staff members are reminded that whale song is not a valid doctor’s note.',
  'Guests are asked not to hum along with the fountain.',
  'The herbal tea is herbal. That is all we are prepared to say.',
  'Please keep your chakras aligned and your belongings with you.',
  'Guests leaving face-shaped marks on the towels will be charged.',
  'A reminder that relaxation is mandatory.',
  'The lost and found now holds one flip-flop and a sense of urgency.',
  'Please breathe in. Further instructions will follow.',
  'Guests are reminded that the face hole is not a snack hatch.',
];
