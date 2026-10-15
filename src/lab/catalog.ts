// Everything the model lab can show: every item, a guest with each condition, each role of staff, and the scenery.

import type * as THREE from 'three';

import {
  type ConditionDef,
  CONDITIONS,
  HAMPER_SIZE,
  ITEMS,
  type ItemType,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  type Pose,
  type Role,
  ROLE_ORDER,
  ROLES,
} from '../core/data';
import { randomLook } from '../core/people';
import type { Char, Look } from '../core/state/types';
import { animateItemParts, type ItemCondition } from '../render/items';
import { buildBeach } from '../render/models/beach';
import { buildCharacter, type CharRig } from '../render/models/character';
import { buildItem } from '../render/models/items';
import { partsOf } from '../render/models/parts';
import { buildForest } from '../render/models/tree';
import { poseChar } from '../render/pose';
import { button, choice, type Control, type Option, range, toggle } from './controls';
import { demoGuest, demoStaff, LAB_LOOK } from './people';

/** A model as built for the lab, with what moves it each frame and the settings that change it. */
export interface Model {
  root: THREE.Object3D;
  /** Parts that hang in the world rather than move with the model, such as a trail of smoke left behind. */
  loose?: THREE.Object3D[];
  /** Move the model's parts for a moment in time. */
  animate: (t: number, dt: number) => void;
  controls: Control[];
}

export type Group = 'Items' | 'Guests' | 'Staff' | 'Scenery';

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

/** An item, with sliders and switches for whichever moving parts its model has. */
function itemSpecimen(type: ItemType): Specimen {
  const def = ITEMS[type];
  // a full trophy cabinet to begin with, so every cup is in the picture
  const st: ItemCondition & { session: string } = {
    id: 1,
    water: 100,
    dirt: 0,
    scanning: false,
    broken: false,
    trophies: 99,
    session: '',
  };
  return {
    id: `item:${type}`,
    group: 'Items',
    name: def.name,
    footprint: [def.w, def.h],
    /** Build the item, with controls for the parts of it that move. */
    build() {
      const root = buildItem(type);
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
      if (parts.ring) controls.push(toggle('Scanning', st, 'scanning'), toggle('Broken', st, 'broken'));
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
        root,
        controls,
        /** Move the item's parts as the game does, and lay out the props for the session picked. */
        animate(t) {
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

/** How a person on show is posed, kept between rebuilds. */
interface PersonState {
  look: Look;
  pose: Pose;
  bubble: string;
}

/** The settings every person has: their pose, a speech bubble and a new look. */
function personControls(st: PersonState): Control[] {
  return [
    choice('Pose', st, 'pose', POSES),
    choice('Bubble', st, 'bubble', BUBBLES),
    button('Shuffle look', () => (st.look = randomLook()), true),
    button('Reset look', () => (st.look = { ...LAB_LOOK }), true),
  ];
}

/** Pose a person for this frame from the lab's settings. */
function posePerson(rig: CharRig, c: Char, st: PersonState, t: number, dt: number, style: Modality | null = null) {
  c.pose = st.pose;
  c.bubble = st.bubble;
  c.bubbleT = st.bubble ? 1 : 0;
  poseChar(rig, c, t, dt, style);
}

/** A guest showing a condition's symptom, or cured of it. */
function guestSpecimen(def: ConditionDef): Specimen {
  const st: PersonState & { healed: boolean; stressed: boolean } = {
    look: { ...LAB_LOOK },
    pose: 'stand',
    bubble: '',
    healed: false,
    stressed: false,
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
        controls: [...personControls(st), toggle('Healed', st, 'healed', true), toggle('Stressed', st, 'stressed')],
        /** Pose the guest. */
        animate(t, dt) {
          c.stressed = st.stressed;
          posePerson(rig, c, st, t, dt);
        },
      };
    },
  };
}

/** A member of staff in their uniform, working on any treatment their role gives. */
function staffSpecimen(role: Role): Specimen {
  const st: PersonState & { busy: boolean; style: string; smudging: boolean } = {
    look: { ...LAB_LOOK },
    pose: 'stand',
    bubble: '',
    busy: false,
    style: '',
    smudging: false,
  };
  const discipline = ROLES[role].discipline;
  const styles = MODALITY_ORDER.filter((m) => discipline && MODALITIES[m].discipline === discipline);
  const controls: Control[] = [...personControls(st), toggle('Working', st, 'busy')];
  if (styles.length) {
    const options = styles.map((m): Option => [m, MODALITIES[m].name]);
    controls.push(choice('Treatment', st, 'style', [['', 'General'], ...options]));
  }
  return {
    id: `staff:${role}`,
    group: 'Staff',
    name: ROLES[role].name,
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
          posePerson(rig, c, st, t, dt, st.busy && st.style ? (st.style as Modality) : null);
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
  ...(Object.keys(ITEMS) as ItemType[]).map(itemSpecimen).sort((a, b) => a.name.localeCompare(b.name)),
  ...CONDITIONS.map(guestSpecimen),
  ...ROLE_ORDER.map(staffSpecimen),
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
