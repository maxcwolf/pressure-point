// Everything the model lab can show: every item, a guest with each condition, each role of staff, and the scenery.

import * as THREE from 'three';

import {
  AMANDA,
  type CenterId,
  CENTERS,
  type ConditionDef,
  CONDITIONS,
  HAMPER_SIZE,
  ITEMS,
  type ItemType,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  POOR_CONDITION,
  type Pose,
  type Role,
  ROLE_ORDER,
  ROLES,
} from '../core/data';
import { HAIR, randomLook } from '../core/people';
import { newSeed, stream } from '../core/random';
import type { Char, Guest, Look, VisitorKind } from '../core/state/types';
import { must } from '../core/util';
import { accessPose, itemCenter } from '../core/world';
import { NOISE_CUE, usedNoise } from '../render/item-cues';
import { animateItemParts, type ItemCondition } from '../render/items';
import { fenceRuns } from '../render/land';
import { buildBeach } from '../render/models/beach';
import { buildCharacter, type CharRig } from '../render/models/character';
import type { Expression } from '../render/models/character-detail';
import { buildSite } from '../render/models/fence';
import { buildForSaleBoard } from '../render/models/for-sale';
import { buildItem } from '../render/models/items';
import { buildOrchard } from '../render/models/orchard';
import { partsOf } from '../render/models/parts';
import { buildPines } from '../render/models/pine';
import { buildStorefront } from '../render/models/storefront';
import { buildForest } from '../render/models/tree';
import { type Door, type IdleAct, idleMoment, type Mood, PATIENCE_SIGNS, poseChar } from '../render/pose';
import { H_TALL, WALL_T } from '../render/shared';
import { SHOP_TURN } from '../render/storefront';
import { button, choice, type Control, type Option, range, toggle } from './controls';
import { demoGuest, demoStaff, demoVisitor, LAB_LOOK } from './people';

/** A model as built for the lab, with what moves it each frame and the settings that change it. */
export interface Model {
  root: THREE.Object3D;
  /** Parts that hang in the world rather than move with the model, such as a trail of smoke left behind. */
  loose?: THREE.Object3D[];
  /** Move the model's parts for a moment in time. */
  animate: (t: number, dt: number) => void;
  controls: Control[];
}

export type Group = 'Items' | 'Guests' | 'Staff' | 'Visitors' | 'Seated' | 'Moods' | 'Scenery';

/** Something the lab can show. */
export interface Specimen {
  /** Its address in the lab's URL, such as `item:bench`. */
  id: string;
  group: Group;
  name: string;
  /** The tiles it covers, across and deep. */
  footprint: readonly [w: number, h: number];
  /** Make the model, with the settings it was last left at. */
  build: () => Model;
}

/** Nothing moves. */
const still = () => undefined;

/** Where the shuffled looks come from: the lab has no game to draw from. */
const looks = stream(newSeed());

/** A stretch of a room's wall, one tile deep, for something hung on a wall to be seen on. */
function wallBehind(model: THREE.Group, w: number): THREE.Group {
  const holder = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(w, H_TALL, WALL_T),
    new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.9 }),
  );
  // the wall stands along the back of its tile, as a room's does, and the model hangs on its face
  wall.position.set(0, H_TALL / 2, -0.5 + WALL_T / 2);
  wall.receiveShadow = true;
  model.position.z = -0.5 + WALL_T;
  holder.add(wall, model);
  return holder;
}

/**
 * An item, with sliders and switches for whichever moving parts its model has. A painting can be of any center's
 * view, and something hung on a wall is shown on one.
 */
function itemSpecimen(type: ItemType, center?: CenterId): Specimen {
  const def = ITEMS[type];
  // a full trophy cabinet to begin with, so every cup is in the picture
  const st: ItemCondition & { session: string; heating: boolean } = {
    id: 1,
    type,
    water: 100,
    dirt: 0,
    wear: 0,
    scanning: false,
    inUse: false,
    running: 0,
    trophies: 99,
    session: '',
    heating: false,
  };
  return {
    id: center ? `item:${type}:${center}` : `item:${type}`,
    group: 'Items',
    name: center ? `${def.name} (${CENTERS[center].name})` : def.name,
    footprint: [def.w, def.h],
    /** Build the item, with controls for the parts of it that move. */
    build() {
      const root = buildItem(type, { center });
      const parts = partsOf(root);
      const props = parts.session;
      const controls: Control[] = [];
      if (parts.leaf) controls.push(range('Water', st, 'water'));
      if (parts.glow) controls.push(range('Heat', st, 'water'));
      if (parts.linens) controls.push(range('Soiled linens', st, 'dirt'));
      if (parts.heap) {
        st.water = Math.min(st.water, HAMPER_SIZE / 2);
        controls.push(range('Linens in it', st, 'water', 0, HAMPER_SIZE));
      }
      if (parts.grime) controls.push(range('Dirt', st, 'dirt'));
      if (parts.ring) controls.push(toggle('Scanning', st, 'scanning'));
      if (def.wear) controls.push(range('Wear', st, 'wear'));
      if (usedNoise(type) >= NOISE_CUE) controls.push(toggle('A guest using it', st, 'inUse'));
      if (def.heat) controls.push(toggle(def.heat > 0 ? 'Heating' : 'Cooling', st, 'heating'));
      if (parts.cups) {
        st.trophies = Math.min(st.trophies, parts.cups.length);
        controls.push(range('Trophies', st, 'trophies', 0, parts.cups.length));
      }
      if (props) {
        const names = MODALITIES as Partial<Record<string, { name: string }>>;
        const options = Object.keys(props).map((k): Option => [k, names[k]?.name ?? k]);
        controls.push(choice('Session props', st, 'session', [['', 'None'], ...options]));
      }
      return {
        root: def.mount === 'wall' ? wallBehind(root, def.w) : root,
        controls,
        /** Move the item's parts as the game does, and lay out the props for the session picked. */
        animate(t) {
          st.running = st.heating ? 1 : 0;
          animateItemParts(root, st, t);
          if (props) for (const [key, prop] of Object.entries(props)) prop.visible = key === st.session;
        },
      };
    },
  };
}

const POSES: readonly Option[] = [
  ['stand', 'Standing'],
  ['walk', 'Walking'],
  ['sit', 'Sitting'],
  ['lie', 'Lying down'],
];

/** The speech bubbles people show, to check how they sit over a head. */
const BUBBLES: readonly Option[] = [
  ['', 'None'],
  ['💢', '💢 Fed up'],
  ['🤕', '🤕 Getting worse'],
  ['🚻', '🚻 Needs the toilet'],
  ['🍵', '🍵 Thirsty'],
  ['💤', '💤 On a break'],
  ['📚', '📚 Training'],
  ['😴', '😴 Worn out'],
];

/** How a waiting guest's patience can show, from content to fed up. */
const MOODS: readonly (readonly [Mood, string])[] = [
  ['content', 'Content'],
  ['restless', 'Restless'],
  ['impatient', 'Impatient'],
  ['fedUp', 'Fed up'],
];

/** A guest's patience a little way into a mood, or full for a content one. */
const patienceFor = (mood: Mood) => (mood === 'content' ? 100 : PATIENCE_SIGNS[mood] - 5);

/** What a member of staff with nothing to do can be doing to pass the time. */
const IDLE_ACTS: readonly (readonly [IdleAct, string])[] = [
  ['stretch', 'Stretching'],
  ['look', 'Looking round'],
  ['watch', 'Checking the time'],
];

/** Where the lab's front door is, off to one side of the stage, for a fed-up guest to turn toward. */
const LAB_DOOR: Door = { x: 4, y: 1 };

/** How a person on show is posed, kept between rebuilds. */
interface PersonState {
  look: Look;
  pose: Pose;
  bubble: string;
}

/** The settings every person has: their pose, a speech bubble and a new look. */
function personControls(st: PersonState, home = LAB_LOOK): Control[] {
  // someone set apart by their hair keeps it whatever else changes
  const keep = home === LAB_LOOK ? {} : { hairStyle: home.hairStyle, hair: home.hair };
  return [
    choice('Pose', st, 'pose', POSES),
    choice('Bubble', st, 'bubble', BUBBLES),
    button('Shuffle as a woman', () => (st.look = { ...randomLook(looks, 'female'), ...keep }), true),
    button('Shuffle as a man', () => (st.look = { ...randomLook(looks, 'male'), ...keep }), true),
    button('Reset look', () => (st.look = { ...home }), true),
  ];
}

/** Pose a person for this frame from the lab's settings. */
function posePerson(rig: CharRig, c: Char, st: PersonState, t: number, dt: number, style: Modality | null = null) {
  c.pose = st.pose;
  c.bubble = st.bubble;
  c.bubbleT = st.bubble ? 1 : 0;
  poseChar(rig, c, t, dt, style, LAB_DOOR);
}

/** Set a guest waiting with their patience showing a mood, or being seen to and content. */
function setMood(c: Guest, mood: Mood) {
  c.state = mood === 'content' ? 'served' : 'waiting';
  c.patience = patienceFor(mood);
}

/** A guest showing a condition's symptom, or cured of it, and waiting with their patience running out. */
function guestSpecimen(def: ConditionDef): Specimen {
  const st: PersonState & { healed: boolean; stressed: boolean; mood: string; poorly: boolean } = {
    look: { ...LAB_LOOK },
    pose: 'stand',
    bubble: '',
    healed: false,
    stressed: false,
    mood: 'content',
    poorly: false,
  };
  return {
    id: `guest:${def.id}`,
    group: 'Guests',
    name: def.name,
    footprint: [1, 1],
    /** Build the guest with their symptom showing, or cured. */
    build() {
      const rig = buildCharacter(st.look, undefined, def.visual);
      const c = demoGuest(st.look, def.id);
      // a cure cannot be undone on a model, so a guest is built afresh to bring the symptom back
      c.outcome = st.healed ? 'healed' : '';
      return {
        root: rig.group,
        controls: [
          ...personControls(st),
          choice('Waiting', st, 'mood', MOODS),
          toggle('In poor condition', st, 'poorly'),
          toggle('Healed', st, 'healed', true),
          toggle('Stressed', st, 'stressed'),
        ],
        /** Pose the guest. */
        animate(t, dt) {
          c.stressed = st.stressed;
          c.health = st.poorly ? POOR_CONDITION - 10 : 100;
          setMood(c, st.mood as Mood);
          posePerson(rig, c, st, t, dt);
        },
      };
    },
  };
}

/** Someone on the staff who is not one of the crowd, with the look that sets them apart. */
interface Named {
  id: string;
  name: string;
  look: Look;
}

/** Every hair style and facial hair, each on a receptionist, so a picture of each is kept. */
const LOOKS: readonly (readonly [key: string, label: string, look: Partial<Look>])[] = [
  ['long', 'long hair', { hairStyle: HAIR.long }],
  ['bob', 'a bob', { hairStyle: HAIR.bob, hair: 0x8a5a2b }],
  ['ponytail', 'a ponytail', { hairStyle: HAIR.ponytail, skin: 0xb97a55, hair: 0x2b1d16 }],
  ['curls', 'big curls', { hairStyle: HAIR.curls, skin: 0x6b4229, hair: 0x2b1d16 }],
  ['short', 'short hair', { sex: 'male', hairStyle: HAIR.short }],
  ['bald', 'bald', { sex: 'male', hairStyle: HAIR.bald, skin: 0xd9a078 }],
  ['moustache', 'a moustache', { sex: 'male', hairStyle: HAIR.short, beard: 1, hair: 0x8c8c8c }],
  ['beard', 'a beard', { sex: 'male', hairStyle: HAIR.curls, beard: 2, skin: 0x8d5a3b, hair: 0x2b1d16 }],
];

/** Which member of staff sits at each item they work at. */
const SEATED_STAFF: Partial<Record<ItemType, Role>> = {
  consult_desk: 'consultant',
  singing_bowls: 'healer',
  ceremony_mat: 'shaman',
};

/** Every place someone sits, by item and by who sits there, once each: the first such seat of each item. */
export const SEATS: readonly (readonly [ItemType, number])[] = (Object.keys(ITEMS) as ItemType[]).flatMap((type) =>
  ITEMS[type].access.flatMap((a, i, all) =>
    a.pose === 'sit' && all.findIndex((b) => b.pose === 'sit' && b.role === a.role) === i ? [[type, i] as const] : [],
  ),
);

/** An item with someone sitting at one of its seats, placed and posed as the game places and poses them, to see that
 * they sit on it rather than in it: a member of staff at a seat they work at, or else a guest. */
function seatedSpecimen(type: ItemType, i: number): Specimen {
  const def = ITEMS[type];
  const spot = must(def.access[i], `seat ${i} of ${type}`);
  const staff = spot.role === 'staff' || spot.role === 'study';
  const role = SEATED_STAFF[type] ?? 'therapist';
  return {
    id: `seated:${type}:${spot.role}`,
    group: 'Seated',
    name: `${def.name}, ${staff ? 'staff' : 'a guest'} seated`,
    footprint: [def.w, def.h],
    /** Build the item with the person on it. */
    build() {
      const placed = { type, x: 0, y: 0, rot: 0 };
      const [cx, cy] = itemCenter(placed);
      const at = accessPose(placed, i);
      const rig = buildCharacter(LAB_LOOK, staff ? role : undefined);
      const c: Char = staff ? demoStaff(LAB_LOOK, role) : demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id);
      Object.assign(c, { x: at.x - cx, y: at.y - cy, facing: at.face, pose: at.pose, h: at.h });
      const root = new THREE.Group();
      root.add(buildItem(type, {}), rig.group);
      return {
        root,
        controls: [],
        /** Seat them. */
        animate: (t, dt) => poseChar(rig, c, t, dt, null),
      };
    },
  };
}

/** A member of staff in their uniform, working on any treatment their role gives. */
function staffSpecimen(role: Role, named?: Named): Specimen {
  const home = named?.look ?? LAB_LOOK;
  const st: PersonState & { busy: boolean; style: string; smudging: boolean; idle: string } = {
    look: { ...home },
    pose: 'stand',
    bubble: '',
    busy: false,
    style: '',
    smudging: false,
    idle: '',
  };
  const discipline = ROLES[role].discipline;
  const styles = MODALITY_ORDER.filter((m) => discipline && MODALITIES[m].discipline === discipline);
  const controls: Control[] = [
    ...personControls(st, home),
    toggle('Working', st, 'busy'),
    choice('With nothing to do', st, 'idle', [['', 'As in the game'], ...IDLE_ACTS]),
  ];
  if (styles.length) {
    const options = styles.map((m): Option => [m, MODALITIES[m].name]);
    controls.push(choice('Treatment', st, 'style', [['', 'General'], ...options]));
  }
  return {
    id: `staff:${named?.id ?? role}`,
    group: 'Staff',
    name: named?.name ?? ROLES[role].name,
    footprint: [1, 1],
    /** Build them in their uniform. */
    build() {
      const rig = buildCharacter(st.look, role);
      const c = demoStaff(st.look, role);
      return {
        root: rig.group,
        loose: rig.smoke ? [rig.smoke] : [],
        // only those who clear bad vibes carry sage
        controls: rig.sage ? [...controls, toggle('Smudging', st, 'smudging')] : controls,
        /** Pose them, at work on the treatment picked if they are working, or wafting sage. */
        animate(t, dt) {
          c.busy = st.busy;
          c.state = st.smudging ? 'doingJob' : 'atPost';
          c.job = st.smudging ? { kind: 'smudge', id: 0 } : null;
          // in the game, someone with nothing to do starts passing the time after a while; here, at once if asked
          if (st.idle) rig.idleSince = t - idleMoment(c.id, st.idle as IdleAct);
          posePerson(rig, c, st, t, dt, st.busy && st.style ? (st.style as Modality) : null);
        },
      };
    },
  };
}

/** A plain guest, waiting with their patience showing a mood: standing, or sitting on a bench as they would. */
function moodSpecimen(mood: Mood, label: string, seated: boolean): Specimen {
  const key = mood === 'fedUp' ? 'fed-up' : mood;
  return {
    id: `mood:${key}${seated ? '-seated' : ''}`,
    group: 'Moods',
    name: seated ? `${label}, seated` : label,
    footprint: seated ? [ITEMS.bench.w, ITEMS.bench.h] : [1, 1],
    /** Build the guest, and the bench they sit on. */
    build() {
      const rig = buildCharacter(LAB_LOOK);
      const c = demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id);
      setMood(c, mood);
      const root = new THREE.Group();
      root.add(rig.group);
      if (seated) {
        const placed = { type: 'bench' as const, x: 0, y: 0, rot: 0 };
        const [cx, cy] = itemCenter(placed);
        const at = accessPose(
          placed,
          ITEMS.bench.access.findIndex((a) => a.pose === 'sit'),
        );
        Object.assign(c, { x: at.x - cx, y: at.y - cy, facing: at.face, pose: at.pose, h: at.h });
        root.add(buildItem('bench', {}));
      }
      /** Pose them, turning toward the lab's door if fed up. */
      const animate = (t: number, dt: number) => poseChar(rig, c, t, dt, null, LAB_DOOR);
      return { root, controls: [], animate };
    },
  };
}

/** The faces a guest makes, other than at ease, and what the lab calls each. */
const FACES: readonly (readonly [Exclude<Expression, 'neutral'>, string])[] = [
  ['delighted', 'Delighted, healed'],
  ['unhappy', 'Unhappy, running out of patience'],
  ['wince', 'Wincing, in poor condition'],
];

/** Make a guest feel the way that shows on their face as an expression. */
function feel(c: Guest, e: Expression) {
  if (e === 'delighted') c.outcome = 'healed';
  else if (e === 'unhappy') c.patience = PATIENCE_SIGNS.impatient - 5;
  else if (e === 'wince') c.health = POOR_CONDITION - 10;
}

/** A plain guest making a face. */
function faceSpecimen([key, name]: (typeof FACES)[number]): Specimen {
  return {
    id: `face:${key}`,
    group: 'Moods',
    name,
    footprint: [1, 1],
    /** Build the guest, feeling as they do. */
    build() {
      const rig = buildCharacter(LAB_LOOK);
      const c = demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id);
      feel(c, key);
      /** Pose them. */
      const animate = (t: number, dt: number) => poseChar(rig, c, t, dt, null);
      return { root: rig.group, controls: [], animate };
    },
  };
}

/** A receptionist with nothing to do, passing the time. */
function idleSpecimen(act: IdleAct, label: string): Specimen {
  return {
    id: `idle:${act}`,
    group: 'Moods',
    name: `Nothing to do, ${label.toLowerCase()}`,
    footprint: [1, 1],
    /** Build them, idle for long enough to be in the middle of the act. */
    build() {
      const rig = buildCharacter(LAB_LOOK, 'receptionist');
      const c = demoStaff(LAB_LOOK, 'receptionist');
      return {
        root: rig.group,
        controls: [],
        /** Keep them in the middle of the act. */
        animate(t, dt) {
          rig.idleSince = t - idleMoment(c.id, act);
          poseChar(rig, c, t, dt, null);
        },
      };
    },
  };
}

/** A visitor dressed for the part: a VIP in a dark suit, or the inspector with a clipboard. */
function visitorSpecimen(visit: VisitorKind): Specimen {
  const st: PersonState = { look: { ...LAB_LOOK }, pose: 'stand', bubble: '' };
  return {
    id: `visitor:${visit}`,
    group: 'Visitors',
    name: visit === 'vip' ? 'VIP' : 'Health inspector',
    footprint: [1, 1],
    /** Build them in their outfit. */
    build() {
      const rig = buildCharacter(st.look, undefined, undefined, visit);
      const c = demoVisitor(st.look, visit);
      return {
        root: rig.group,
        controls: personControls(st),
        /** Pose them. */
        animate(t, dt) {
          posePerson(rig, c, st, t, dt);
        },
      };
    },
  };
}

/** Scenery that is drawn as a batch, shown with a few of each so the variety shows. */
const SCENERY: Specimen[] = [
  {
    id: 'scenery:trees',
    group: 'Scenery',
    name: 'Trees',
    footprint: [4, 1],
    /** Three trees, one of each color. */
    build: () => ({
      root: buildForest([0, 1, 2].map((seed) => ({ x: (seed - 1) * 1.4, z: 0, seed }))),
      animate: still,
      controls: [],
    }),
  },
  {
    id: 'scenery:pines',
    group: 'Scenery',
    name: 'Pines in the snow',
    footprint: [4, 1],
    /** Pines of every height and color. */
    build: () => ({
      root: buildPines([0, 1, 2, 3].map((seed) => ({ x: (seed - 1.5) * 1.3, z: 0, seed }))),
      animate: still,
      controls: [],
    }),
  },
  {
    id: 'scenery:orchard',
    group: 'Scenery',
    name: 'Apple trees',
    footprint: [4, 1],
    /** Apple trees of every size. */
    build: () => ({
      root: buildOrchard([0, 1, 2].map((seed) => ({ x: (seed - 1) * 1.5, z: 0, seed }))),
      animate: still,
      controls: [],
    }),
  },
  {
    id: 'scenery:storefront',
    group: 'Scenery',
    name: 'The rival storefront',
    footprint: [3, 6],
    /** The rival's shop, with its sale banner out, turned as it stands in the game. */
    build: () => {
      const shop = buildStorefront();
      shop.sale.visible = true;
      shop.root.rotation.y = SHOP_TURN;
      return { root: shop.root, animate: still, controls: [] };
    },
  },
  {
    id: 'scenery:for-sale',
    group: 'Scenery',
    name: 'For Sale boards',
    footprint: [4, 1],
    /** A board for a plot for sale, and one for a plot that comes up for sale at the second star. */
    build: () => {
      const root = new THREE.Group();
      ['FOR SALE', '★ 2'].forEach((text, i) => {
        const board = buildForSaleBoard(text);
        board.position.x = (i - 0.5) * 2;
        root.add(board);
      });
      return { root, animate: still, controls: [] };
    },
  },
  {
    id: 'scenery:site',
    group: 'Scenery',
    name: 'A building site',
    footprint: [4, 3],
    /** A plot the builders are at, in the shape of an L, fenced off with its board saying SOLD. */
    build: () => {
      const rects = [
        { x0: -2, x1: 1, y0: -1, y1: -1 },
        { x0: -2, x1: -1, y0: 0, y1: 1 },
      ];
      const root = buildSite(
        fenceRuns({ rects }, () => false),
        rects,
      );
      const board = buildForSaleBoard('SOLD');
      board.position.set(-1, 0, 0.5);
      root.add(board);
      return { root, animate: still, controls: [] };
    },
  },
  {
    id: 'scenery:beach',
    group: 'Scenery',
    name: 'Beach huts and dune grass',
    footprint: [7, 2],
    /** A hut of every color, with a row of grass in front. */
    build: () => ({
      root: buildBeach(
        [0, 1, 2, 3, 4].map((seed) => ({ x: (seed - 2) * 1.3, z: -0.4, seed })),
        [0, 1, 2, 3, 4, 5].map((seed) => ({ x: (seed - 2.5) * 1.1, z: 0.6, seed })),
      ),
      animate: still,
      controls: [],
    }),
  },
];

/** Every specimen, grouped in the order the lab lists them. */
export const CATALOG: readonly Specimen[] = [
  ...[
    ...(Object.keys(ITEMS) as ItemType[]).map((type) => itemSpecimen(type)),
    // each center's painting has its own view
    ...(Object.keys(CENTERS) as CenterId[])
      .filter((c) => c !== 'sandbox')
      .map((c) => itemSpecimen('landscape_painting', c)),
  ].sort((a, b) => a.name.localeCompare(b.name)),
  ...CONDITIONS.map(guestSpecimen),
  ...ROLE_ORDER.map((role) => staffSpecimen(role)),
  // the one member of staff with a look all her own
  staffSpecimen('therapist', {
    id: 'amanda',
    name: AMANDA.name,
    look: { ...LAB_LOOK, hairStyle: AMANDA.hairStyle, hair: AMANDA.hair },
  }),
  ...LOOKS.map(([key, label, look]) =>
    staffSpecimen('receptionist', { id: `look-${key}`, name: `With ${label}`, look: { ...LAB_LOOK, ...look } }),
  ),
  ...(['vip', 'inspector'] as const).map(visitorSpecimen),
  ...SEATS.map(([type, i]) => seatedSpecimen(type, i)),
  ...MOODS.filter(([mood]) => mood !== 'content').flatMap(([mood, label]) => [
    moodSpecimen(mood, label, false),
    moodSpecimen(mood, label, true),
  ]),
  ...FACES.map(faceSpecimen),
  ...IDLE_ACTS.map(([act, label]) => idleSpecimen(act, label)),
  ...SCENERY,
];

/** A member of staff to stand beside a model, to show how big it is. */
export function scalePerson(): Model {
  const rig = buildCharacter(LAB_LOOK, 'receptionist');
  const c = demoStaff(LAB_LOOK, 'receptionist');
  /** Stand them at ease. */
  const animate = (t: number, dt: number) => poseChar(rig, c, t, dt, null);
  return { root: rig.group, animate, controls: [] };
}
