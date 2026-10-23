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
  ROOM_ORDER,
  ROOMS,
  type RoomType,
  RUNAWAY_SPEED,
  SANDBOX_PLOT,
  UPGRADE_LEVELS,
} from '../core/data';
import { footprintOf } from '../core/footprint';
import { HAIR, randomLook } from '../core/people';
import { newSeed, stream } from '../core/random';
import type { BubbleId, Char, Guest, Look, Room, VisitorKind } from '../core/state/types';
import { must } from '../core/util';
import { accessPose, itemCenter } from '../core/world';
import type { Act } from '../render/acts';
import { wallMaterial } from '../render/decor-paint';
import { applyGag, applyGuestGag } from '../render/gags/apply';
import { gagFrame } from '../render/gags/beats';
import { GAGS } from '../render/gags/scripts';
import type { GagStage } from '../render/gags/types';
import { NOISE_CUE, usedNoise } from '../render/item-cues';
import { animateItemParts, type ItemCondition } from '../render/items';
import { fenceRuns } from '../render/land';
import { buildBeach } from '../render/models/beach';
import { buildCharacter, type CharRig, cureRig } from '../render/models/character';
import { type Expression, showEyes } from '../render/models/character-detail';
import { buildLamps, buildOffices, buildStreetTrees } from '../render/models/downtown';
import { buildSite } from '../render/models/fence';
import { buildForSaleBoard } from '../render/models/for-sale';
import { buildItem } from '../render/models/items';
import { buildOrchard } from '../render/models/orchard';
import { mat, partsOf } from '../render/models/parts';
import { buildPines } from '../render/models/pine';
import { upgradePlate } from '../render/models/plate';
import { buildPuddle } from '../render/models/puddle';
import { LAMP_STATES, type LampState, pulseLamps, setLamp } from '../render/models/sign-plaque';
import { buildStorefront } from '../render/models/storefront';
import { buildForest } from '../render/models/tree';
import {
  actMoment,
  CURE,
  type Door,
  type IdleAct,
  idleMoment,
  type Mood,
  PATIENCE_SIGNS,
  poseChar,
  treadmill,
} from '../render/pose';
import { BLUEPRINT, buildRoom } from '../render/rooms';
import { H_TALL, WALL_T } from '../render/shared';
import { SHOP_TURN } from '../render/storefront';
import { nearSides } from '../render/turn';
import { CLIMBS, climbSpecimen } from './climb';
import { button, choice, type Control, type Option, range, toggle } from './controls';
import { demoGuest, demoStaff, demoVisitor, LAB_LOOK } from './people';
import { walkSpecimen } from './walk';

/** A model as built for the lab, with what moves it each frame and the settings that change it. */
export interface Model {
  root: THREE.Object3D;
  /** Parts that hang in the world rather than move with the model, such as a trail of smoke left behind. */
  loose?: THREE.Object3D[];
  /** Move the model's parts for a moment in time. */
  animate: (t: number, dt: number) => void;
  controls: Control[];
}

export type Group =
  'Items' | 'Machines' | 'Guests' | 'Staff' | 'Visitors' | 'Seated' | 'Moods' | 'Acts' | 'Lying' | 'Rooms' | 'Scenery';

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
  const st: ItemCondition & { session: string; heating: boolean; chugging: boolean; level: number } = {
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
    chugging: false,
    level: 0,
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
      if (parts.exhaust) controls.push(toggle('Carrying the center', st, 'chugging'));
      if (parts.cups) {
        st.trophies = Math.min(st.trophies, parts.cups.length);
        controls.push(range('Trophies', st, 'trophies', 0, parts.cups.length));
      }
      // the plate showing how far it has been upgraded, put on afresh when the level changes, as the game does
      let plate: { level: number; group: THREE.Group | null } = { level: 0, group: null };
      if (def.upgrade) controls.push(range('Upgrade level', st, 'level', 0, UPGRADE_LEVELS));
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
          st.running = st.heating || st.chugging ? 1 : 0;
          animateItemParts(root, st, t);
          if (st.level !== plate.level) {
            if (plate.group) root.remove(plate.group);
            plate = { level: st.level, group: upgradePlate(type, st.level) };
            if (plate.group) root.add(plate.group);
          }
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
  ['bubble-impatient', 'Fed up'],
  ['bubble-hurt', 'Getting worse'],
  ['bubble-restroom', 'Needs the toilet'],
  ['bubble-thirsty', 'Thirsty'],
  ['bubble-break', 'On a break'],
  ['bubble-training', 'Training'],
  ['bubble-exhausted', 'Worn out'],
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

/** What a guest can be doing at an item, and what the lab calls each. */
const GUEST_ACTS: readonly Option[] = [
  ['drink', 'Having a drink'],
  ['eat', 'Having a snack'],
  ['play', 'Playing a game'],
  ['shop', 'Shopping'],
];

/** What a member of staff can be doing at an item, and what the lab calls each. */
const STAFF_ACTS: readonly Option[] = [
  ['checkin', 'Checking someone in'],
  ['litter', 'Picking up litter'],
  ['water', 'Watering a plant'],
  ['repair', 'Mending something'],
  ['drink', 'Having a drink'],
];

/** How a person on show is posed, kept between rebuilds. */
interface PersonState {
  look: Look;
  pose: Pose;
  bubble: BubbleId | '';
  /** What they are doing at an item, standing, if anything. */
  act: Act | '';
}

/** The settings every person has: their pose, a speech bubble, what they are doing, and a new look. */
function personControls(st: PersonState, home = LAB_LOOK, acts: readonly Option[] = []): Control[] {
  // someone set apart by their hair keeps it whatever else changes
  const keep = home === LAB_LOOK ? {} : { hairStyle: home.hairStyle, hair: home.hair };
  return [
    choice('Pose', st, 'pose', POSES),
    choice('Bubble', st, 'bubble', BUBBLES),
    ...(acts.length ? [choice('Doing', st, 'act', [['', 'Nothing'], ...acts])] : []),
    button('Shuffle as a woman', () => (st.look = { ...randomLook(looks, 'female'), ...keep }), true),
    button('Shuffle as a man', () => (st.look = { ...randomLook(looks, 'male'), ...keep }), true),
    button('Reset look', () => (st.look = { ...home }), true),
  ];
}

/** How fast someone walks in the lab, in meters a second, as a guest does in the game. */
const WALK_PACE = 2.1;

/** The lab's time when each person was last walked on the spot. */
const walkedAt = new WeakMap<CharRig, number>();

/**
 * Walk someone on the spot at a pace, by the time gone since they were last walked: nobody in the lab goes anywhere,
 * and the stride follows the ground covered. Held still, the lab's time stands still, and so do they.
 */
function walkOnTheSpot(rig: CharRig, t: number, pace: number) {
  treadmill(rig, t - (walkedAt.get(rig) ?? t), pace);
  walkedAt.set(rig, t);
}

/** Pose a person for this frame from the lab's settings. */
function posePerson(rig: CharRig, c: Char, st: PersonState, t: number, dt: number, style: Modality | null = null) {
  c.pose = st.pose;
  c.bubble = st.bubble;
  c.bubbleT = st.bubble ? 1 : 0;
  if (c.pose === 'walk') walkOnTheSpot(rig, t, WALK_PACE);
  poseChar(rig, c, t, dt, { style, door: LAB_DOOR, act: st.act || undefined });
}

/** Set a guest waiting with their patience showing a mood, or being seen to and content. */
function setMood(c: Guest, mood: Mood) {
  c.state = mood === 'content' ? 'served' : 'waiting';
  c.patience = patienceFor(mood);
}

/** A guest showing a condition's symptom, or cured of it, and waiting with their patience running out. */
function guestSpecimen(def: ConditionDef): Specimen {
  const st: PersonState & { healed: boolean; stressed: boolean; mood: string; poorly: boolean; shut: boolean } = {
    look: { ...LAB_LOOK },
    pose: 'stand',
    bubble: '',
    act: '',
    healed: false,
    stressed: false,
    mood: 'content',
    poorly: false,
    shut: false,
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
          ...personControls(st, LAB_LOOK, GUEST_ACTS),
          choice('Waiting', st, 'mood', MOODS),
          toggle('In poor condition', st, 'poorly'),
          toggle('Healed', st, 'healed', true),
          // healed as the game heals them, so the symptom goes in a puff; Healed builds them afresh, already well
          button('Cure now', () => (c.outcome = 'healed')),
          toggle('Stressed', st, 'stressed'),
          toggle('Eyes shut', st, 'shut'),
        ],
        /** Pose the guest. */
        animate(t, dt) {
          c.stressed = st.stressed;
          c.health = st.poorly ? POOR_CONDITION - 10 : 100;
          setMood(c, st.mood as Mood);
          posePerson(rig, c, st, t, dt);
          if (st.shut) showEyes(rig.face, true);
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

/** Every hair style, facial hair, build and pair of glasses, and white shoes, each on a receptionist, to picture each. */
const LOOKS: readonly (readonly [key: string, label: string, look: Partial<Look>])[] = [
  ['long', 'long hair', { hairStyle: HAIR.long }],
  ['bob', 'a bob', { hairStyle: HAIR.bob, hair: 0x8a5a2b }],
  ['ponytail', 'a ponytail', { hairStyle: HAIR.ponytail, skin: 0xb97a55, hair: 0x2b1d16 }],
  ['curls', 'big curls', { hairStyle: HAIR.curls, skin: 0x6b4229, hair: 0x2b1d16 }],
  ['short', 'short hair', { sex: 'male', hairStyle: HAIR.short }],
  ['bald', 'bald', { sex: 'male', hairStyle: HAIR.bald, skin: 0xd9a078 }],
  ['moustache', 'a moustache', { sex: 'male', hairStyle: HAIR.short, beard: 1, hair: 0x8c8c8c }],
  ['beard', 'a beard', { sex: 'male', hairStyle: HAIR.curls, beard: 2, skin: 0x8d5a3b, hair: 0x2b1d16 }],
  ['quiff', 'a quiff', { sex: 'male', hairStyle: HAIR.quiff, hair: 0x2b1d16 }],
  ['topknot', 'a top knot', { sex: 'male', hairStyle: HAIR.topknot, skin: 0xd9a078 }],
  ['slight', 'a slight build', { build: 0 }],
  ['stocky', 'a stocky build', { sex: 'male', hairStyle: HAIR.short, build: 2, skin: 0xb97a55, hair: 0x2b1d16 }],
  ['glasses-round', 'round glasses', { glasses: 1 }],
  ['glasses-square', 'square glasses', { sex: 'male', hairStyle: HAIR.short, glasses: 2, hair: 0x8a5a2b }],
  ['shoes', 'white shoes', { shoes: 3, hairStyle: HAIR.ponytail, hair: 0xd9a441 }],
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
        animate: (t, dt) => poseChar(rig, c, t, dt, { style: null }),
      };
    },
  };
}

/** Every item someone lies on that is not a machine, whose gag lays them down its own way. */
export const BEDS: readonly ItemType[] = (Object.keys(ITEMS) as ItemType[]).filter(
  (type) => !ITEMS[type].machine && ITEMS[type].access.some((a) => a.pose === 'lie'),
);

/** The treatment a practitioner gives at each table in the lab, working on the guest lying on it. */
const BED_WORK: Partial<Record<ItemType, Modality>> = {
  massage_table: 'swedish',
  acu_table: 'needling',
  reiki_table: 'usui',
};

/**
 * A guest lying on an item as the game lays them there: face down on a massage or acupuncture table, with the
 * practitioner working on them, or on their back, resting or being treated.
 */
function lyingSpecimen(type: ItemType): Specimen {
  const def = ITEMS[type];
  const style = BED_WORK[type] ?? null;
  const role = def.station?.staff;
  const spot = def.access.findIndex((a) => a.pose === 'lie');
  const post = def.access.findIndex((a) => a.role === 'staff');
  return {
    id: `lying:${type}`,
    group: 'Lying',
    name: `${def.name}, a guest lying on it`,
    footprint: [def.w, def.h],
    /** Build the item with the guest on it, and whoever works on them. */
    build() {
      const placed = { type, x: 0, y: 0, rot: 0 };
      const [cx, cy] = itemCenter(placed);
      const root = new THREE.Group();
      root.add(buildItem(type, {}));
      /** Put someone at an access spot of the item, posed as it says. */
      const place = (c: Char, i: number) => {
        const at = accessPose(placed, i);
        Object.assign(c, { x: at.x - cx, y: at.y - cy, facing: at.face, pose: at.pose, h: at.h });
        return c;
      };
      const guest = buildCharacter(LAB_LOOK);
      const g = place(demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id), spot);
      // a guest on a Lounger is resting there, after a treatment
      if (def.access[spot]?.role === 'recover') g.state = 'resting';
      const lie = def.access[spot]?.lie;
      root.add(guest.group);
      let staff: { rig: CharRig; c: Char } | null = null;
      if (style && role && post >= 0) {
        const rig = buildCharacter(LAB_LOOK, role);
        staff = { rig, c: place({ ...demoStaff(LAB_LOOK, role), id: 2, busy: true }, post) };
        root.add(rig.group);
      }
      return {
        root,
        controls: [],
        /** Lay them down, and have whoever works on them at it. */
        animate(t, dt) {
          poseChar(guest, g, t, dt, { style: null, lie });
          if (staff) poseChar(staff.rig, staff.c, t, dt, { style });
        },
      };
    },
  };
}

/** The ailment a machine's guest is shown with: one its own technique cures. */
function machineCondition(type: ItemType): ConditionDef {
  const performs = ITEMS[type].machine?.performs;
  const own = CONDITIONS.find((c) => MODALITIES[c.modality].machine === type);
  return own ?? CONDITIONS.find((c) => performs?.includes(c.modality)) ?? must(CONDITIONS[0], 'a condition');
}

/**
 * A machine playing its gag, with a guest inside it, and a slider to move through the session: so each beat, the
 * fake failure, the cure and a breakdown can be looked at one at a time.
 */
function machineSpecimen(type: ItemType): Specimen {
  const def = ITEMS[type];
  const script = must(GAGS[type], `the gag of ${type}`);
  const condition = machineCondition(type);
  const st = {
    stage: 'running' as string,
    progress: 50,
    play: true,
    healed: true,
    hiccup: false,
    smoking: false,
    down: false,
    guest: def.station !== undefined,
  };
  return {
    id: `machine:${type}`,
    group: 'Machines',
    name: def.name,
    footprint: [def.w, def.h],
    /** Build the machine, with a guest at its place inside if a guest is treated on it. */
    build() {
      const placed = { type, x: 0, y: 0, rot: 0 };
      const [cx, cy] = itemCenter(placed);
      const root = new THREE.Group();
      const model = buildItem(type, {});
      root.add(model);
      const seat = def.access.findIndex((a) => a.role === 'guest');
      let guest: { rig: CharRig; c: Guest } | null = null;
      if (st.guest && seat >= 0) {
        const at = accessPose(placed, seat);
        const rig = buildCharacter(LAB_LOOK, undefined, condition.visual);
        const c = demoGuest(LAB_LOOK, condition.id);
        Object.assign(c, { x: at.x - cx, y: at.y - cy, facing: at.face, pose: at.pose, h: at.h });
        root.add(rig.group);
        guest = { rig, c };
      }
      const stages: Option[] = [
        ['idle', 'Empty'],
        ['approach', 'Guest on the way in'],
        ['running', 'Session'],
        ['outro', 'Just finished'],
      ];
      const item: ItemCondition = {
        id: 1,
        type,
        water: 100,
        dirt: 0,
        wear: 0,
        scanning: false,
        inUse: false,
        running: 0,
        trophies: 0,
      };
      return {
        root,
        controls: [
          choice('Stage', st, 'stage', stages),
          range('Progress', st, 'progress'),
          toggle('Play through', st, 'play'),
          toggle('Worked', st, 'healed'),
          toggle('Fake failure', st, 'hiccup'),
          toggle('Smoking', st, 'smoking'),
          toggle('Down', st, 'down'),
          toggle('Guest inside', st, 'guest', true),
        ],
        /** Play the gag at the point in the session picked, or round and round. */
        animate(t, dt) {
          // round and round from halfway, so a still picture catches the gag in full swing
          if (st.play && st.stage === 'running') st.progress = ((0.5 + t / 8) % 1) * 100;
          const stage = st.stage as GagStage;
          const since = stage === 'outro' ? t % (script.outro + 1) : 0;
          const frame = gagFrame(script, {
            stage,
            progress: st.progress / 100,
            since,
            healed: st.healed,
            hiccup: st.hiccup,
            t,
            smoking: st.smoking,
            down: st.down,
          });
          animateItemParts(model, { ...item, wear: st.down ? 100 : 0, inUse: stage === 'running' }, t);
          applyGag(model, frame, t);
          if (!guest) return;
          guest.c.outcome = stage === 'outro' && st.healed ? 'healed' : '';
          poseChar(guest.rig, guest.c, t, dt, { style: null });
          // the guest is only inside while there is a session, or just after it
          guest.rig.group.visible = stage === 'running' || stage === 'outro';
          // squashed and stretched from their usual size each frame, as in the game, not from the last frame's size
          guest.rig.group.scale.setScalar(1);
          if (guest.rig.group.visible) applyGuestGag(guest.rig, stage === 'running' ? frame.guest : {}, 0);
        },
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
    act: '',
    busy: false,
    style: '',
    smudging: false,
    idle: '',
  };
  const discipline = ROLES[role].discipline;
  const styles = MODALITY_ORDER.filter((m) => discipline && MODALITIES[m].discipline === discipline);
  const controls: Control[] = [
    ...personControls(st, home, STAFF_ACTS),
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
      const animate = (t: number, dt: number) => poseChar(rig, c, t, dt, { style: null, door: LAB_DOOR });
      return { root, controls: [], animate };
    },
  };
}

/** A guest with a hen on their head, caught the moment they are healed, as it shrinks away in a puff of sparkles. */
function curedSpecimen(): Specimen {
  const condition = must(
    CONDITIONS.find((d) => d.visual === 'chicken'),
    'a condition with a hen',
  );
  return {
    id: 'mood:cured',
    group: 'Moods',
    name: 'Healed, the symptom going in a puff',
    footprint: [1, 1],
    /** Build the guest, healed. */
    build() {
      const rig = buildCharacter(LAB_LOOK, undefined, condition.visual);
      const c = { ...demoGuest(LAB_LOOK, condition.id), outcome: 'healed' as const };
      /** Hold them partway through the cure, two fifths of the way. */
      const animate = (t: number, dt: number) => {
        cureRig(rig, t - CURE * 0.4);
        rig.curedAt = t - CURE * 0.4;
        poseChar(rig, c, t, dt, { style: null });
      };
      return { root: rig.group, controls: [], animate };
    },
  };
}

/** A guest on a really bad trip, running on the spot with their arms waving over their head. */
function runawaySpecimen(): Specimen {
  return {
    id: 'mood:runaway',
    group: 'Moods',
    name: 'On a really bad trip, running round',
    footprint: [1, 1],
    /** Build the guest, running. */
    build() {
      const rig = buildCharacter(LAB_LOOK);
      const c = demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id);
      Object.assign(c, { state: 'running', pose: 'walk', outcome: 'failed', bubble: 'bubble-stressed', bubbleT: 1e9 });
      /** Pose them, running on the spot as fast as a runner goes. */
      const animate = (t: number, dt: number) => {
        walkOnTheSpot(rig, t, RUNAWAY_SPEED);
        poseChar(rig, c, t, dt, { style: null });
      };
      return { root: rig.group, controls: [], animate };
    },
  };
}

/** A Caretaker mopping up the flood water a storm left in a restroom, over a puddle of it. */
function moppingSpecimen(): Specimen {
  return {
    id: 'mood:mopping',
    group: 'Moods',
    name: 'Caretaker mopping up flood water',
    footprint: [1, 1],
    /** Build the Caretaker, mop in hand, and the water in front of them. */
    build() {
      const rig = buildCharacter(LAB_LOOK, 'caretaker');
      const c = demoStaff(LAB_LOOK, 'caretaker');
      Object.assign(c, { state: 'doingJob', job: { kind: 'litter', id: 1 } });
      const root = new THREE.Group();
      root.add(rig.group);
      const water = buildPuddle(1, true);
      water.position.z = 0.6;
      root.add(water);
      /** Pose them, mopping. */
      const animate = (t: number, dt: number) => poseChar(rig, c, t, dt, { style: null, mopping: true });
      return { root, controls: [], animate };
    },
  };
}

/** The faces a guest makes, other than at ease, and what the lab calls each: each expression, and the eyes shut. */
const FACES: readonly (readonly [Exclude<Expression, 'neutral'> | 'shut', string])[] = [
  ['delighted', 'Delighted, healed'],
  ['unhappy', 'Unhappy, running out of patience'],
  ['wince', 'Wincing, in poor condition'],
  ['scared', 'Frightened, in an outbreak or on a bad trip'],
  ['shut', 'Eyes shut, resting'],
];

/** Make a guest feel the way that shows on their face as an expression. */
function feel(c: Guest, e: Expression | 'shut') {
  if (e === 'delighted') c.outcome = 'healed';
  else if (e === 'unhappy') c.patience = PATIENCE_SIGNS.impatient - 5;
  else if (e === 'wince') c.health = POOR_CONDITION - 10;
  else if (e === 'scared') c.stressed = true;
}

/** A plain guest making a face, or with their eyes shut. */
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
      /** Pose them, with their eyes shut if that is the face. */
      const animate = (t: number, dt: number) => {
        poseChar(rig, c, t, dt, { style: null });
        if (key === 'shut') showEyes(rig.face, true);
      };
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
          poseChar(rig, c, t, dt, { style: null });
        },
      };
    },
  };
}

/** Every act, and what the lab calls it. */
const ACTS: readonly (readonly [Act, string])[] = [
  ['checkin', 'A receptionist checking a guest in'],
  ['drink', 'A guest having a drink'],
  ['eat', 'A guest having a snack'],
  ['play', 'A guest playing a game'],
  ['shop', 'A guest shopping'],
  ['litter', 'A Caretaker picking up litter'],
  ['water', 'A Caretaker watering a plant'],
  ['repair', 'A Caretaker mending something'],
];

/** Who does an act in the lab: a receptionist checking in, a Caretaker on a chore, or else a guest. */
const actor = (act: Act): Role | undefined =>
  act === 'checkin'
    ? 'receptionist'
    : act === 'litter' || act === 'water' || act === 'repair'
      ? 'caretaker'
      : undefined;

/**
 * Someone doing an act, caught at the height of it: a receptionist at a reception desk with a guest at it, or a
 * Caretaker or a guest on their own.
 */
function actSpecimen(act: Act, label: string): Specimen {
  const role = actor(act);
  const desk = act === 'checkin';
  return {
    id: `act:${act}`,
    group: 'Acts',
    name: label,
    footprint: desk ? [ITEMS.reception_desk.w, ITEMS.reception_desk.h] : [1, 1],
    /** Build them, and the desk and the guest at it for checking in. */
    build() {
      const rig = buildCharacter(LAB_LOOK, role);
      const c: Char = role
        ? { ...demoStaff(LAB_LOOK, role), busy: true }
        : demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id);
      const root = new THREE.Group();
      root.add(rig.group);
      let guest: { rig: CharRig; c: Guest } | null = null;
      if (desk) {
        const placed = { type: 'reception_desk' as const, x: 0, y: 0, rot: 0 };
        const [cx, cy] = itemCenter(placed);
        /** Stand someone at an access spot of the desk. */
        const stand = (who: Char, i: number) => {
          const at = accessPose(placed, i);
          Object.assign(who, { x: at.x - cx, y: at.y - cy, facing: at.face, pose: at.pose, h: at.h });
        };
        stand(
          c,
          ITEMS.reception_desk.access.findIndex((a) => a.role === 'staff'),
        );
        const g = demoGuest(LAB_LOOK, must(CONDITIONS[0], 'a condition').id);
        // the guest has a different face to the receptionist, so the two are told apart
        g.id = 2;
        stand(
          g,
          ITEMS.reception_desk.access.findIndex((a) => a.role === 'guest'),
        );
        guest = { rig: buildCharacter({ ...LAB_LOOK, hairStyle: HAIR.short, sex: 'male', top: 0xe9c46a }), c: g };
        root.add(buildItem('reception_desk', {}), guest.rig.group);
      }
      const at = actMoment(act, c.id);
      return {
        root,
        controls: [],
        /** Keep them at the height of the act. */
        animate(t, dt) {
          poseChar(rig, c, t + at, dt, { style: null, act });
          if (guest) poseChar(guest.rig, guest.c, t, dt, { style: null });
        },
      };
    },
  };
}

/** A visitor dressed for the part: a VIP in a dark suit, or the inspector with a clipboard. */
function visitorSpecimen(visit: VisitorKind): Specimen {
  const st: PersonState = { look: { ...LAB_LOOK }, pose: 'stand', bubble: '', act: '' };
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

/** What each state of a room's lamp means, as the lab lists them. */
const LAMP_LABELS: Readonly<Record<LampState, string>> = {
  working: 'Working (green)',
  idle: 'Nobody to work it (amber)',
  broken: 'Something broken (red)',
  unfinished: 'Unfinished (grey)',
};

/** The building a room in the lab stands in: the sandbox's, with the room well inside it. */
const LAB_BUILDING = footprintOf(SANDBOX_PLOT);

/**
 * A room's doorway and sign, on a room three tiles by two: its door in the north wall, which stands tall at the first
 * turn of the camera, or in the south wall, which is cut low. Any type of room, with its lamp in any state; an
 * unfinished room is a blueprint.
 */
function doorSpecimen(): Specimen {
  const st = { type: 'massage' as string, lamp: 'working' as string, low: false };
  return {
    id: 'room:door',
    group: 'Rooms',
    name: 'A doorway and its sign',
    footprint: [3, 2],
    /** Build the room as set, again whenever a setting it is built with changes. */
    build() {
      const root = new THREE.Group();
      let built = '';
      let sign: ReturnType<typeof buildRoom>['sign'] = null;
      /** Build the room afresh for the settings. */
      const make = () => {
        const type = st.type as RoomType;
        const done = st.lamp !== 'unfinished';
        const room: Room = {
          id: 1,
          type,
          x: 10,
          y: 10,
          w: 3,
          h: 2,
          door: st.low ? { x: 11, y: 11, dx: 0, dy: 1 } : { x: 11, y: 10, dx: 0, dy: -1 },
          windows: [],
          done,
          priority: false,
          vibes: 0,
          claimedBy: 0,
        };
        const trim = mat(ROOMS[type].trim, 0.6);
        const blue = BLUEPRINT;
        const materials = done
          ? { wall: wallMaterial('standard'), trim, glass: trim, pane: trim, frame: mat(0xfbfaf6, 0.5), shell: trim }
          : { wall: blue, trim: blue, glass: blue, pane: blue, frame: blue, shell: blue };
        const drawn = buildRoom(room, LAB_BUILDING, nearSides(0), materials);
        drawn.group.position.set(-11.5, 0, -11);
        root.clear();
        root.add(drawn.group);
        sign = drawn.sign;
      };
      /** The settings the room was built with, to build it again when they change. */
      const key = () => `${st.type}|${st.lamp === 'unfinished'}|${st.low}`;
      built = key();
      make();
      return {
        root,
        controls: [
          choice(
            'Room',
            st,
            'type',
            ROOM_ORDER.map((t): Option => [t, ROOMS[t].name]),
          ),
          choice(
            'Lamp',
            st,
            'lamp',
            LAMP_STATES.map((l): Option => [l, LAMP_LABELS[l]]),
          ),
          toggle('Door in a wall cut low', st, 'low'),
        ],
        /** Build the room again if it has been changed, and light and pulse its lamp. */
        animate(t) {
          if (key() !== built) {
            built = key();
            make();
          }
          if (sign) setLamp(sign, st.lamp as LampState);
          pulseLamps(t);
        },
      };
    },
  };
}

/** Scenery that is drawn as a batch, shown with a few of each so the variety shows. */
const SCENERY: Specimen[] = [
  {
    id: 'scenery:puddles',
    group: 'Scenery',
    name: 'Puddles: kombucha, and a flooded restroom',
    footprint: [3, 1],
    /** A puddle of kombucha, and flood water from a storm beside it. */
    build: () => {
      const root = new THREE.Group();
      const kombucha = buildPuddle(1);
      kombucha.position.x = -0.8;
      const flood = buildPuddle(2, true);
      flood.position.x = 0.8;
      root.add(kombucha, flood);
      return { root, animate: still, controls: [] };
    },
  },
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
    id: 'scenery:downtown',
    group: 'Scenery',
    name: 'Downtown: an office block, a street tree and a lamp',
    footprint: [6, 4],
    /** A low office block at the back, with a street tree in its planter and a lamp post along the kerb in front. */
    build: () => {
      const root = new THREE.Group();
      root.add(
        buildOffices([{ x: -0.6, z: -0.7, w: 4, d: 2.4, floors: 2, seed: 2 }]),
        buildStreetTrees([{ x: 1.9, z: 1.3, seed: 1 }]),
        buildLamps([{ x: -2.2, z: 1.5 }]),
      );
      return { root, animate: still, controls: [] };
    },
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
  ...(Object.keys(GAGS) as ItemType[]).map(machineSpecimen),
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
  runawaySpecimen(),
  moppingSpecimen(),
  curedSpecimen(),
  ...ACTS.map(([act, label]) => actSpecimen(act, label)),
  ...BEDS.map(lyingSpecimen),
  ...CLIMBS.map(climbSpecimen),
  walkSpecimen(),
  doorSpecimen(),
  ...SCENERY,
];

/** A member of staff to stand beside a model, to show how big it is. */
export function scalePerson(): Model {
  const rig = buildCharacter(LAB_LOOK, 'receptionist');
  const c = demoStaff(LAB_LOOK, 'receptionist');
  /** Stand them at ease. */
  const animate = (t: number, dt: number) => poseChar(rig, c, t, dt, { style: null });
  return { root: rig.group, animate, controls: [] };
}
