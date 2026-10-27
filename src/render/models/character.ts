// The little clay people: guests and staff, and what their symptoms look like.
import * as THREE from 'three';

import { type Role, ROLES, type Visual } from '../../core/data';
import { SHOES } from '../../core/people';
import type { Look, VisitorKind } from '../../core/state/types';
import { BUBBLE_SIZE } from '../bubbles';
import { owned } from '../disposal';
import { type Motion, newMotion } from '../motion';
import { BUBBLE_PX, readable } from '../readable';
import type { Burst } from './burst';
import { bodySymptom } from './character-bodies';
import {
  detailArm,
  detailBib,
  detailCap,
  detailCoat,
  detailHead,
  detailLeg,
  detailMedallion,
  detailPoncho,
  detailShawl,
  detailShirtFront,
  detailTorso,
  detailTurnout,
  ELBOW,
  type Face,
  GLASSES_OUT,
  KNEE,
} from './character-detail';
import { headSymptom } from './character-heads';
import { machineSymptom } from './character-machines';
import { transformSymptom } from './character-transform';
import type { HeldKind } from './held';
import { buildMop } from './mop';
import {
  bowl,
  cached,
  capsule,
  CHROME,
  cyl,
  ico,
  joined,
  mat,
  type Piece,
  put,
  rbox,
  sph,
  torus,
  trimShadows,
} from './parts';
import { buildSage, buildSmoke } from './sage';

export interface CharRig {
  group: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  headMesh: THREE.Mesh;
  pick: THREE.Mesh;
  bubble: THREE.Sprite;
  knot?: THREE.Mesh;
  steam?: THREE.Group;
  band?: THREE.Mesh;
  orbit?: THREE.Group;
  /** Drops of water falling off a wet blanket, each from where it starts. */
  drips?: THREE.Group;
  /** Something that hovers over the head and bobs gently, and how high it hovers. */
  bob?: THREE.Object3D;
  bobAt: number;
  /** A material whose glow pulses. */
  blink?: THREE.MeshStandardMaterial;
  /** Everything that only exists to show the symptom, hidden once healed. */
  props: THREE.Object3D[];
  /** A bundle of sage in the right hand, for those who clear bad vibes, its glowing tip, and the smoke it gives off. */
  sage?: THREE.Object3D;
  sageTip?: THREE.Object3D;
  smoke?: THREE.Group;
  /** A mop held out in front, for a Caretaker mopping up flood water. */
  mop?: THREE.Object3D;
  /** What they hold in their right hand while doing something, each made the first time it is held. */
  held?: Partial<Record<HeldKind, THREE.Object3D>>;
  /** The water shooting from a firefighter's hose, made the first time they hose out a fire. */
  jet?: THREE.Group;
  /** The shins and forearms, hinged at the knees and elbows. */
  joints: Joints;
  /** The mouth and brows, which change shape with how they feel. */
  face: Face;
  /** Their glasses, if they wear them, taken off while a symptom or a visit has them in sunglasses. */
  glasses?: THREE.Mesh;
  /** When they last found themselves with nothing to do, in the scene's seconds, or NaN while they have something. */
  idleSince: number;
  /** How far they have walked, in meters, which their stride is counted from, so their feet plant at any speed. */
  walked: number;
  /** Where they are shown, which differs for a moment from where the sim has them as they climb on or off a table. */
  motion: Motion;
  /** Where they were last frame, and which way they faced, or NaN before their first. */
  lastX: number;
  lastY: number;
  lastFacing: number;
  visual: Visual | undefined;
  /** Whether their symptom has gone for good, once healed. */
  cured: boolean;
  /** When they were healed, in the scene's seconds, or NaN before: their symptom goes in a puff for a moment after. */
  curedAt: number;
  /** How each symptom prop was built to stand, noted as the cure begins, to shrink it from and put it back as it was. */
  rest?: { scale: THREE.Vector3; y: number }[];
  /** A puff of sparkles round them as the symptom goes, made the first time it is needed. */
  burst?: Burst;
  /** How much bigger than usual the symptom makes the head, across and up, to go down with the cure. */
  swell?: [number, number];
  /** What puts back the parts and colors a symptom stands in for, done halfway through the cure. */
  restore?: (() => void)[];
  /** Symptom props kept at least so many pixels across from afar, as bubbles are, under the `grow` prototype. */
  grow?: THREE.Object3D[];
  /** Pale soles turned up, shown while they lie face down, made the first time they do. */
  soles?: THREE.Mesh[];
  scale: number;
  /** How much wider and deeper than average their build makes them, which their head is spared. */
  wide: number;
  bubbleKey: string;
}

/** The shins and forearms of a person, hinged at the knees and elbows. */
export interface Joints {
  shinL: THREE.Group;
  shinR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
}

const pickMat = new THREE.MeshBasicMaterial({ visible: false });

/** How much wider and deeper each build is than average: slight, average and stocky. */
const BUILD_WIDTH = [0.9, 1, 1.13];

/** How far back on the head the Caretaker wears their cap, in radians, the brim tipped up off the face. */
export const CAP_TIP = -0.38;

/** How much bigger than life the hen is drawn, the game's signature, to be seen from its usual distance. */
const HEN_SIZE = 1.7;

/**
 * A ram's horn on one side of the head: rooted on top, curling back, down round the ear and forward again, thick at the
 * root, thin at the tip, and ridged along its length.
 */
function ramHorn(side: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const a = Math.PI / 2 + u * 1.75 * Math.PI;
    const r = 0.13 * (1 - 0.55 * u);
    const out = 0.13 + 0.11 * Math.min(1, u * 3);
    points.push(new THREE.Vector3(side * out, 0.07 + r * Math.sin(a), -0.03 + r * Math.cos(a)));
  }
  const path = new THREE.CatmullRomCurve3(points);
  const along = 48;
  const round = 10;
  const tube = new THREE.TubeGeometry(path, along, 0.055, round, false);
  const at = tube.getAttribute('position');
  const v = new THREE.Vector3();
  for (let k = 0; k < at.count; k++) {
    const u = Math.floor(k / (round + 1)) / along;
    const middle = path.getPointAt(u);
    const thick = (1 - 0.72 * u) * (1 + 0.07 * Math.sin(u * 44));
    v.fromBufferAttribute(at, k).sub(middle).multiplyScalar(thick).add(middle);
    at.setXYZ(k, v.x, v.y, v.z);
  }
  tube.computeVertexNormals();
  return tube;
}

/** What a visitor wears: a VIP's dark suit, the inspector's trench coat, or a firefighter's navy turnout gear. */
const VISITOR_CLOTHES: Readonly<Record<VisitorKind, { top: number; bottom: number }>> = {
  vip: { top: 0x2b2f3a, bottom: 0x23262e },
  inspector: { top: 0xb59a6a, bottom: 0x4a4a52 },
  firefighter: { top: 0x2c3f6e, bottom: 0x23262e },
};

/** A firefighter's yellow, on their helmet and the reflective bands on their coat, cuffs and trousers. */
const HI_VIS = 0xf2c418;

/** The black of a firefighter's boots, and of a VIP's dark glasses. */
const BLACK = 0x1d1f24;

/**
 * A firefighter's helmet: a deep dome over the head with a wide brim all round, longest at the back to keep the water
 * off the neck, and a comb along the top from front to back.
 */
const helmet = () =>
  joined('firefighter helmet', [
    [bowl(0.255, 0.2, 0.025, 24), 0, 0.27, 0, Math.PI, 0, 0],
    [cyl(0.34, 0.34, 0.022, 28), 0, 0.075, -0.06],
    [rbox(0.05, 0.06, 0.34, 0.02), 0, 0.285, -0.01],
  ]);

/** The shield on the front of a firefighter's helmet: rounded across the top and coming to a point below. */
const helmetShield = () =>
  cached('helmet shield', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.068);
    s.quadraticCurveTo(0.066, -0.036, 0.062, 0.025);
    s.quadraticCurveTo(0.06, 0.064, 0, 0.064);
    s.quadraticCurveTo(-0.06, 0.064, -0.062, 0.025);
    s.quadraticCurveTo(-0.066, -0.036, 0, -0.068);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.01,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geo.translate(0, 0, -0.005);
    return geo;
  });

/** Build a person: a uniformed member of staff, a guest showing their symptom, or a visitor dressed for the part. */
export function buildCharacter(look: Look, role?: Role, visual?: Visual, visitor?: VisitorKind): CharRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  // a build widens the body and everything on it, but not the head, so hats, glasses and props on it still fit
  const wide = BUILD_WIDTH[look.build] ?? 1;
  body.scale.set(look.scale * wide, look.scale, look.scale * wide);
  group.add(body);
  const skin = mat(look.skin, 0.65);
  const clothes = visitor && VISITOR_CLOTHES[visitor];
  const topColor = role ? ROLES[role].uniform : (clothes?.top ?? look.top);
  const top = mat(topColor, 0.7);
  const bottom = mat(role === 'caretaker' ? 0x5c6b33 : (clothes?.bottom ?? look.bottom), 0.8);
  const accent = role ? mat(ROLES[role].accent, 0.6) : top;

  // a firefighter's boots are black whatever shoes they would wear
  const shoes = mat(visitor === 'firefighter' ? BLACK : (SHOES[look.shoes] ?? 0x3a302b), 0.5);
  const { leg: legL, shin: shinL } = detailLeg(body, -0.095, bottom, shoes);
  const { leg: legR, shin: shinR } = detailLeg(body, 0.095, bottom, shoes);

  // torso group pivots at the hips so slumps and leans bend in the right place
  const torso = new THREE.Group();
  torso.position.set(0, 0.42, 0);
  body.add(torso);
  detailTorso(torso, top, bottom);
  // a long white coat
  if (role === 'consultant') detailCoat(torso, top);
  if (role === 'acupuncturist') put(torso, rbox(0.09, 0.1, 0.03, 0.01), accent, -0.08, 0.26, 0.15);
  if (role === 'receptionist' || role === 'acupuncturist') {
    const scarf = put(torso, torus(0.11, 0.035), accent, 0, 0.42, 0);
    scarf.rotation.x = Math.PI / 2;
  }
  if (role === 'consultant') put(torso, rbox(0.08, 0.14, 0.03, 0.01), accent, 0.08, 0.26, 0.15);
  // the bib of their overalls
  if (role === 'caretaker') detailBib(torso, accent);
  // a shawl over one shoulder, and a string of beads
  if (role === 'healer') detailShawl(torso, accent, mat(0x8a5a2c, 0.5));
  if (role === 'therapist') {
    // a belt round the waist, shaped to the body, with a pump bottle of massage oil clipped on at the hip
    const belt = put(torso, torus(0.172, 0.022), mat(0x5a3b28, 0.6), 0, 0.1, 0);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1.1, 0.92, 1);
    put(torso, cyl(0.034, 0.034, 0.1, 12), mat(0xd98a2b, 0.25), 0.15, 0.08, 0.135);
    const pump = joined('lotion pump', [
      [cyl(0.012, 0.012, 0.03, 8), 0, 0.015, 0],
      [cyl(0.022, 0.022, 0.016, 10), 0, 0.036, 0],
      [rbox(0.016, 0.012, 0.045, 0.005), 0, 0.04, 0.03],
    ]);
    put(torso, pump, mat(0xf4f1ea, 0.4), 0.15, 0.13, 0.135);
  }
  // a woven poncho over the shoulders
  if (role === 'shaman') detailPoncho(torso, accent, mat(0x8a3b24, 0.85));
  // a gold chain round the neck to a medallion
  if (role === 'practitioner') detailMedallion(torso, mat(0xc9963f, 0.3), accent);

  /** Add an arm hinged at the shoulder, with its forearm and hand hinged at the elbow. */
  const makeArm = (x: number) => {
    const arm = new THREE.Group();
    arm.position.set(x, 0.37, 0);
    torso.add(arm);
    // sleeves rolled up past the elbow for a therapist, ready to work
    return { arm, fore: detailArm(arm, Math.sign(x), top, skin, role === 'therapist') };
  };
  const { arm: armL, fore: foreL } = makeArm(-0.245);
  const { arm: armR, fore: foreR } = makeArm(0.245);
  const joints: Joints = { shinL, shinR, foreL, foreR };
  // what is held in the right hand hangs from the forearm, set as far up as the elbow is down, and what is worn on the
  // lower leg hangs from the shin, as far up as the knee is down
  const holdR = foreR;
  const handUp = ELBOW;
  const kneeUp = KNEE;

  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  head.scale.set(1 / wide, 1, 1 / wide);
  torso.add(head);
  const hair = mat(look.hair, 0.85);
  // a hat needs short hair under it, or a woman's tied back low
  const hatted = role === 'caretaker' || visitor === 'inspector' || visitor === 'firefighter';
  const { headMesh, face, glasses } = detailHead(head, look, skin, hair, hatted);
  // sunglasses go on in place of glasses
  if (glasses) glasses.visible = visitor !== 'vip' && visual !== 'sunburn' && visual !== 'beachhead';
  if (role === 'shaman') {
    // a single feather tucked in behind one ear
    const feather = put(head, rbox(0.05, 0.26, 0.012, 0.01), mat(0xf4f1ea, 0.8), 0.17, 0.16, -0.12);
    feather.rotation.set(-0.4, 0, -0.35);
  }
  if (role === 'caretaker') {
    // pushed back on the head, so from above the brim does not hide the face
    detailCap(head, accent, 'peaked');
    const cap = head.getObjectByName('cap');
    if (cap) cap.rotation.x = CAP_TIP;
  }
  if (visitor === 'vip') {
    // dark glasses, a white shirt and a tie in the V of the jacket, and a gold pin on the lapel
    const shades = mat(BLACK, 0.2);
    for (const x of [-0.075, 0.075]) put(head, rbox(0.1, 0.06, 0.02, 0.01), shades, x, 0.025, 0.2 + GLASSES_OUT);
    put(head, rbox(0.06, 0.012, 0.012, 0.004), shades, 0, 0.04, 0.205 + GLASSES_OUT);
    detailShirtFront(torso, mat(0xf4f1ea, 0.6), shades);
    put(torso, sph(0.025, 8), mat(0xd9a93a, 0.3, 0.3), -0.1, 0.3, 0.13);
  }
  if (visitor === 'firefighter') {
    // a yellow helmet with a silver shield on its front, a turnout coat with reflective bands to match, and boots
    // broader than shoes
    const yellow = mat(HI_VIS, 0.45);
    const silver = mat(CHROME, 0.3);
    put(head, helmet(), yellow).name = 'cap';
    const shield = put(head, helmetShield(), silver, 0, 0.17, 0.235);
    shield.rotation.x = -0.32;
    shield.castShadow = false;
    // the helmet's shadow covers the hair's
    head.traverse((o) => {
      if (o.name === 'hair') o.castShadow = false;
    });
    detailTurnout(torso, joints, yellow, silver);
    for (const shin of [shinL, shinR]) shin.getObjectByName('shoe')?.scale.set(1.1, 1, 1.06);
  }
  if (visitor === 'inspector') {
    // a flat cap, and a clipboard held at the ready
    detailCap(head, mat(0x6b5b45, 0.85), 'flat');
    const board = put(holdR, rbox(0.17, 0.22, 0.02, 0.01), mat(0x8f6a45, 0.7), -0.02, -0.33 + handUp, 0.08);
    board.rotation.x = -0.9;
    put(board, rbox(0.13, 0.16, 0.01, 0.004), mat(0xf7f4ec, 0.6), 0, -0.01, 0.012);
  }

  const rig: CharRig = {
    group,
    body,
    torso,
    legL,
    legR,
    armL,
    armR,
    head,
    headMesh,
    pick: new THREE.Mesh(cyl(0.34, 0.34, 1.4, 8), pickMat),
    bubble: new THREE.Sprite(owned(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))),
    props: [],
    joints,
    face,
    ...(glasses ? { glasses } : {}),
    idleSince: NaN,
    walked: 0,
    motion: newMotion(),
    lastX: NaN,
    lastY: NaN,
    lastFacing: NaN,
    visual,
    cured: false,
    curedAt: NaN,
    scale: look.scale,
    wide,
    bubbleKey: '',
    bobAt: 0,
  };
  rig.pick.position.y = 0.7;
  group.add(rig.pick);
  readable(rig.bubble, BUBBLE_SIZE, BUBBLE_PX);
  rig.bubble.position.y = 1.72;
  rig.bubble.visible = false;
  rig.bubble.renderOrder = 10;
  group.add(rig.bubble);

  if (visual === 'knot') {
    rig.knot = put(
      torso,
      cached('knot', () => new THREE.TorusKnotGeometry(0.1, 0.038, 56, 8)),
      mat(0xd9584a, 0.5),
      0,
      0.46,
      -0.19,
    );
  } else if (visual === 'steam') {
    headMesh.material = mat(0xe8836f, 0.65);
    rig.steam = new THREE.Group();
    for (let i = 0; i < 3; i++)
      put(rig.steam, sph(0.06, 8), mat(0xffffff, 0.9, 0.3), (i - 1) * 0.12, 0, 0).castShadow = false;
    rig.steam.position.y = 0.3;
    head.add(rig.steam);
  } else if (visual === 'band') {
    rig.band = put(head, torus(0.226, 0.038), mat(0xe5484d, 0.4, 0.7), 0, 0.07, 0);
    rig.band.rotation.x = Math.PI / 2;
  } else if (visual === 'flex') {
    for (const arm of [armL, armR]) rig.props.push(put(arm, sph(0.092, 12), top, 0, -0.1, 0.02));
  } else if (visual === 'frost') {
    const ice = mat(0xcdeeff, 0.15, 0.25);
    rig.props.push(put(torso, ico(0.135), ice, 0.21, 0.4, 0));
    const icicle = put(torso, cyl(0.035, 0.001, 0.16, 6), ice, 0.3, 0.26, 0.02);
    rig.props.push(icicle, put(torso, cyl(0.03, 0.001, 0.11, 6), ice, 0.2, 0.25, 0.1));
  } else if (visual === 'dizzy' || visual === 'egg') {
    // stars going round the head, and for a scrambled noggin, the head an egg
    headSymptom(rig, visual);
    rig.orbit = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const star = put(
        rig.orbit,
        cached('dizzystar', () => new THREE.OctahedronGeometry(0.055)),
        mat(0xffd23f, 0.3, 0.8),
        Math.cos(a) * 0.27,
        0,
        Math.sin(a) * 0.27,
      );
      star.castShadow = false;
    }
    rig.orbit.position.y = 0.3;
    head.add(rig.orbit);
  } else if (visual === 'cloud') {
    const cloud = new THREE.Group();
    for (const [x, y, r] of [
      [-0.12, 0, 0.11],
      [0.02, 0.05, 0.14],
      [0.14, 0, 0.1],
    ] as const)
      put(cloud, sph(r, 10), mat(0x7d8894, 0.95), x, y, 0).castShadow = false;
    cloud.position.y = 0.4;
    head.add(cloud);
    rig.bob = cloud;
  } else if (visual === 'aura') {
    rig.orbit = new THREE.Group();
    const ring = put(rig.orbit, torus(0.36, 0.035), mat(0x7a4f9a, 0.5, 0.5), 0, 0, 0);
    ring.rotation.x = Math.PI / 2 + 0.3;
    ring.castShadow = false;
    rig.orbit.position.y = 0.22;
    torso.add(rig.orbit);
  } else if (visual === 'cork') {
    bodySymptom(rig, visual);
  } else if (visual === 'coldfeet') {
    const ice = mat(0xcdeeff, 0.15, 0.25);
    for (const leg of [shinL, shinR])
      rig.props.push(put(leg, rbox(0.21, 0.15, 0.3, 0.03), ice, 0, -0.36 + kneeUp, 0.035));
  } else if (visual === 'blanket') {
    // a sodden wool blanket over the shoulders and down the back, striped and fringed at its hem, sagging, and dripping
    const wool = mat(0x3c6a93, 0.35);
    const stripe = mat(0xd9e4ec, 0.4);
    // the wool in one shape and its stripes and fringe in another, so it costs a part or two to draw
    const sheet: Piece[] = [];
    const trim: Piece[] = [];
    /** A row of fringe tassels along a hem, from one end to the other. */
    const fringe = (x0: number, x1: number, y: number, z: number, n: number) => {
      for (let i = 0; i < n; i++) trim.push([cyl(0.012, 0.008, 0.07, 5), x0 + ((x1 - x0) * i) / (n - 1), y, z]);
    };
    for (const side of [-1, 1]) {
      // over each shoulder, sagging down off it
      sheet.push([rbox(0.36, 0.1, 0.48, 0.045), side * 0.16, 0.44, -0.01, 0, 0, -side * 0.22]);
      // down over the arm to the hip, hanging away from it, and a flap down the front, left open
      sheet.push([rbox(0.07, 0.56, 0.46, 0.03), side * 0.34, 0.13, -0.01, 0, 0, side * 0.1]);
      sheet.push([rbox(0.16, 0.52, 0.05, 0.02), side * 0.22, 0.16, 0.2]);
      trim.push([rbox(0.165, 0.045, 0.055, 0.01), side * 0.22, -0.02, 0.2]);
      fringe(side * 0.15, side * 0.29, -0.13, 0.2, 4);
    }
    sheet.push([rbox(0.68, 0.66, 0.06, 0.03), 0, 0.11, -0.22]);
    // two folds where it sags down the back
    for (const x of [-0.12, 0.14]) sheet.push([rbox(0.04, 0.5, 0.03, 0.012), x, 0.1, -0.24]);
    trim.push([rbox(0.665, 0.045, 0.055, 0.01), 0, -0.04, -0.21], [rbox(0.665, 0.025, 0.055, 0.01), 0, 0.02, -0.21]);
    fringe(-0.3, 0.3, -0.25, -0.21, 9);
    rig.props.push(put(torso, joined('wet blanket', sheet), wool, 0, 0, 0));
    const hem = put(torso, joined('wet blanket trim', trim), stripe, 0, 0, 0);
    hem.castShadow = false;
    rig.props.push(hem);
    rig.drips = new THREE.Group();
    const water = mat(0x8fd3ff, 0.1, 0.35);
    for (const [x, y, z] of [
      [-0.22, -0.18, 0.2],
      [0.26, -0.17, 0.2],
      [-0.25, -0.29, -0.21],
      [0.05, -0.29, -0.21],
      [0.27, -0.29, -0.22],
      [-0.36, -0.16, 0.05],
      [0.36, -0.16, -0.08],
      [-0.08, -0.29, -0.2],
    ] as const) {
      const drop = put(rig.drips, sph(0.03, 8), water, x, y, z);
      drop.scale.y = 1.5;
      drop.castShadow = false;
      drop.userData.y = y;
    }
    torso.add(rig.drips);
    rig.props.push(rig.drips);
  } else if (visual === 'battery') {
    headSymptom(rig, visual);
  } else if (visual === 'wires') {
    const tangle = new THREE.Group();
    const knot = cached('knot', () => new THREE.TorusKnotGeometry(0.1, 0.038, 56, 8));
    put(tangle, knot, mat(0xe5484d, 0.5), 0, 0, 0).scale.setScalar(0.85);
    const second = put(tangle, knot, mat(0x4a9fe0, 0.5), 0, 0, 0);
    second.scale.setScalar(0.85);
    second.rotation.set(1.2, 0.6, 0);
    tangle.position.y = 0.3;
    head.add(tangle);
    rig.knot = tangle as unknown as THREE.Mesh;
  } else if (visual === 'pale') {
    headMesh.material = mat(0xd3cfcb, 0.65);
  } else if (visual === 'static') {
    // hair standing on end, with a spark or two
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const spike = put(head, cyl(0.002, 0.024, 0.14, 5), hair, Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12 - 0.02);
      spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      rig.props.push(spike);
    }
    rig.orbit = new THREE.Group();
    for (const a of [0, Math.PI]) {
      const spark = put(
        rig.orbit,
        cached('spark', () => new THREE.OctahedronGeometry(0.035)),
        mat(0xfff27a, 0.3, 1.2),
      );
      spark.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      spark.castShadow = false;
    }
    rig.orbit.position.y = 0.2;
    head.add(rig.orbit);
  } else if (visual === 'shards') {
    // pieces of them, drifting round
    rig.orbit = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const shard = put(
        rig.orbit,
        ico(0.045),
        mat(i % 2 ? 0xb9a7d9 : 0x9aa4b0, 0.4),
        Math.cos(a) * 0.36,
        0,
        Math.sin(a) * 0.36,
      );
      shard.scale.y = 1.6;
      shard.castShadow = false;
    }
    rig.orbit.position.y = 0.25;
    torso.add(rig.orbit);
  } else if (visual === 'bulb') {
    // a dim light bulb that keeps flickering
    const lamp = new THREE.Group();
    rig.blink = owned(new THREE.MeshStandardMaterial({ color: 0x8f8a6a, emissive: 0xfff0a0, emissiveIntensity: 0.4 }));
    put(lamp, sph(0.075, 14), rig.blink, 0, 0, 0).castShadow = false;
    put(lamp, cyl(0.035, 0.035, 0.06, 10), mat(0x9aa4b0, 0.4), 0, -0.08, 0).castShadow = false;
    lamp.position.y = 0.42;
    head.add(lamp);
    rig.bob = lamp;
  } else if (visual === 'notes') {
    // a few sour notes going round the head
    rig.orbit = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const note = new THREE.Group();
      put(note, sph(0.032, 8), mat(0x2a2422, 0.4), 0, 0, 0).scale.set(1.2, 0.85, 1);
      put(note, cyl(0.007, 0.007, 0.1, 5), mat(0x2a2422, 0.4), 0.032, 0.05, 0);
      note.position.set(Math.cos(a) * 0.3, (i - 1) * 0.04, Math.sin(a) * 0.3);
      rig.orbit.add(note);
    }
    rig.orbit.position.y = 0.25;
    head.add(rig.orbit);
  } else if (visual === 'worm') {
    // a little pink worm going round and round the head, in one ear and out the other
    rig.orbit = new THREE.Group();
    const pink = mat(0xe98fa6, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = i * 0.22;
      const bit = put(
        rig.orbit,
        sph(0.03 - i * 0.003, 8),
        pink,
        Math.cos(a) * 0.27,
        Math.sin(i * 1.3) * 0.02,
        Math.sin(a) * 0.27,
      );
      bit.castShadow = false;
    }
    rig.orbit.position.y = 0.02;
    head.add(rig.orbit);
  } else if (visual === 'glass') {
    // a glass, half empty, hanging over them like a cloud
    const glass = new THREE.Group();
    put(glass, cyl(0.06, 0.05, 0.14, 12), mat(0xe8f1f6, 0.1), 0, 0, 0).castShadow = false;
    put(glass, cyl(0.052, 0.048, 0.06, 12), mat(0x6fb5e0, 0.2), 0, -0.035, 0).castShadow = false;
    glass.position.y = 0.42;
    head.add(glass);
    rig.bob = glass;
  } else if (visual === 'gears') {
    // a cog turning over the head
    rig.orbit = new THREE.Group();
    const steel = mat(0x8c939c, 0.35);
    put(rig.orbit, torus(0.07, 0.025), steel, 0, 0, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tooth = put(rig.orbit, rbox(0.04, 0.03, 0.04, 0.005), steel, Math.cos(a) * 0.105, 0, Math.sin(a) * 0.105);
      tooth.rotation.y = -a;
    }
    rig.orbit.position.y = 0.36;
    head.add(rig.orbit);
  } else if (visual === 'chakra') {
    // seven glowing centers down the front, the third gone dark
    const colors = [0x9b6fd1, 0x5b5fc7, 0x4a9fe0, 0x3bb273, 0xf2c14e, 0xf08a4b, 0xe5484d];
    colors.forEach((color, i) => {
      const blocked = i === 4;
      const dot = put(
        torso,
        sph(0.028, 8),
        mat(blocked ? 0x4a4a4a : color, 0.3, blocked ? 0 : 0.8),
        0,
        0.46 - i * 0.065,
        0.165,
      );
      dot.castShadow = false;
      rig.props.push(dot);
    });
  } else if (visual === 'gull') {
    // a seagull, settled in for the day
    const bird = new THREE.Group();
    const white = mat(0xf7f7f2, 0.6);
    put(bird, sph(0.075, 10), white, 0, 0, 0).scale.set(1.5, 0.85, 1);
    put(bird, sph(0.045, 10), white, 0.1, 0.05, 0);
    put(bird, cyl(0.001, 0.018, 0.06, 6), mat(0xf2a33a, 0.4), 0.15, 0.045, 0).rotation.z = -Math.PI / 2;
    for (const z of [-0.06, 0.06]) put(bird, rbox(0.13, 0.025, 0.06, 0.01), mat(0x6f7884, 0.6), -0.02, 0.035, z);
    put(bird, sph(0.012, 6), mat(0x1d1f24, 0.3), 0.13, 0.065, 0.03);
    bird.scale.setScalar(1.7);
    bird.position.y = 0.3;
    bird.rotation.y = 0.6;
    for (const o of bird.children) o.castShadow = false;
    head.add(bird);
    rig.props.push(bird);
  } else if (visual === 'sunburn') {
    // lobster red, behind a pair of sunglasses
    headMesh.material = mat(0xe8604c, 0.6);
    const shades = mat(0x1d1f24, 0.2);
    for (const x of [-0.075, 0.075])
      rig.props.push(put(head, rbox(0.1, 0.06, 0.02, 0.01), shades, x, 0.025, 0.2 + GLASSES_OUT));
    rig.props.push(put(head, rbox(0.06, 0.012, 0.012, 0.004), shades, 0, 0.04, 0.205 + GLASSES_OUT));
  } else if (visual === 'icicles') {
    // frozen blue, with snow settled on the shoulders and icicles hanging off the chin
    headMesh.material = mat(0xb9d7e8, 0.5);
    for (const x of [-0.17, 0.17]) {
      const drift = put(torso, sph(0.11, 12), mat(0xf4f8fb, 0.6), x, 0.47, 0);
      drift.scale.y = 0.5;
      rig.props.push(drift);
    }
    const ice = mat(0xcdeeff, 0.15, 0.25);
    for (const [x, h] of [
      [-0.07, 0.11],
      [0, 0.15],
      [0.07, 0.1],
    ] as const)
      rig.props.push(put(head, cyl(0.022, 0.001, h, 6), ice, x, -0.17 - h / 2, 0.12));
  } else if (visual === 'cast') {
    // a plaster cast up one leg, signed by the ski school, and a sticking plaster on the forehead
    const plaster = mat(0xf7f4ec, 0.8);
    rig.props.push(put(shinR, rbox(0.15, 0.3, 0.17, 0.05), plaster, 0, -0.22 + kneeUp, 0.01));
    rig.props.push(put(shinR, rbox(0.05, 0.03, 0.005, 0.005), mat(0x4a9fe0, 0.6), 0.02, -0.18 + kneeUp, 0.096));
    const strip = put(head, rbox(0.11, 0.035, 0.02, 0.008), mat(0xe8c39e, 0.7), 0.06, 0.11, 0.18);
    strip.rotation.set(-0.5, 0, 0.5);
    rig.props.push(strip);
  } else if (visual === 'thermometer') {
    // a thermometer in the mouth, and flushed cheeks
    const glass = put(head, cyl(0.011, 0.011, 0.2, 8), mat(0xf4f8fb, 0.2), 0.04, -0.09, 0.27);
    glass.rotation.set(Math.PI / 2 - 0.35, 0, -0.3);
    rig.props.push(glass, put(head, sph(0.016, 8), mat(0xe5484d, 0.4, 0.4), 0.075, -0.06, 0.355));
    for (const x of [-0.12, 0.12]) {
      const cheek = put(head, sph(0.045, 10), mat(0xf08a8a, 0.7), x, -0.04, 0.165);
      cheek.scale.z = 0.4;
      cheek.castShadow = false;
      rig.props.push(cheek);
    }
  } else if (visual === 'apple') {
    // an apple balanced where it landed, with a bump coming up beside it
    rig.props.push(put(head, sph(0.075, 12), mat(0xd9362f, 0.45), 0.02, 0.36, 0));
    rig.props.push(put(head, cyl(0.008, 0.008, 0.05, 6), mat(0x6b4f33, 0.8), 0.02, 0.45, 0));
    const leaf = put(head, sph(0.03, 8), mat(0x5aa34f, 0.7), 0.05, 0.45, 0);
    leaf.scale.set(1.4, 0.4, 0.8);
    const bump = put(head, sph(0.05, 10), mat(0xf0a58e, 0.6), -0.12, 0.2, 0.08);
    for (const o of [leaf, bump]) {
      o.castShadow = false;
      rig.props.push(o);
    }
  } else if (visual === 'mallet') {
    // still holding the croquet mallet
    const wood = mat(0x9b6b3f, 0.6);
    const shaft = put(holdR, cyl(0.016, 0.016, 0.62, 8), wood, 0, -0.42 + handUp, 0.06);
    const block = put(holdR, cyl(0.05, 0.05, 0.2, 10), mat(0x3b6fb3, 0.5), 0, -0.73 + handUp, 0.06);
    block.rotation.z = Math.PI / 2;
    rig.props.push(shaft, block);
  } else if (visual === 'blossom') {
    // petals all over the hair and shoulders, and a nose rubbed red
    const petal = mat(0xf6bfd0, 0.7);
    for (const [x, y, z] of [
      [-0.12, 0.2, 0.06],
      [0.08, 0.23, -0.05],
      [0.15, 0.14, 0.1],
      [-0.04, 0.25, 0.1],
    ] as const) {
      const p = put(head, sph(0.03, 6), petal, x, y, z);
      p.scale.y = 0.35;
      p.castShadow = false;
      rig.props.push(p);
    }
    for (const x of [-0.17, 0.17]) {
      const p = put(torso, sph(0.035, 6), petal, x, 0.5, 0.02);
      p.scale.y = 0.35;
      p.castShadow = false;
      rig.props.push(p);
    }
    const nose = put(head, sph(0.04, 10), mat(0xe5484d, 0.4), 0, -0.01, 0.215);
    nose.castShadow = false;
    rig.props.push(nose);
  } else if (visual === 'chicken') {
    // a hen, settled on top of the head as if it were home
    const hen = new THREE.Group();
    const white = mat(0xf7f4ec, 0.7);
    put(hen, sph(0.09, 12), white, 0, 0, 0).scale.set(1.3, 0.9, 1);
    put(hen, sph(0.055, 10), white, 0.1, 0.08, 0);
    put(hen, rbox(0.03, 0.05, 0.015, 0.006), mat(0xd9362f, 0.5), 0.1, 0.14, 0);
    put(hen, cyl(0.001, 0.016, 0.04, 6), mat(0xf2a33a, 0.4), 0.16, 0.08, 0).rotation.z = -Math.PI / 2;
    put(hen, sph(0.018, 6), mat(0xd9362f, 0.5), 0.14, 0.05, 0);
    put(hen, rbox(0.07, 0.09, 0.08, 0.02), white, -0.12, 0.05, 0).rotation.z = 0.5;
    for (const z of [-0.03, 0.03]) put(hen, sph(0.01, 6), mat(0x1d1f24, 0.3), 0.13, 0.095, z);
    hen.rotation.y = -Math.PI / 2;
    // bigger than life, and raised to sit on the head as big as it is; too small for a shadow worth drawing before,
    // it casts none
    hen.scale.setScalar(HEN_SIZE);
    hen.position.y = 0.22 + 0.05 * HEN_SIZE;
    for (const o of hen.children) o.castShadow = false;
    head.add(hen);
    rig.props.push(hen);
  } else if (visual === 'goat') {
    // a ram's curling horns, one each side, and a little beard to go with them
    const horn = mat(0xcbb48a, 0.7);
    for (const side of [-1, 1])
      rig.props.push(
        put(
          head,
          cached(`ram horn ${side}`, () => ramHorn(side)),
          horn,
          0,
          0,
          0,
        ),
      );
    rig.props.push(put(head, cyl(0.04, 0.001, 0.12, 8), mat(0xf4f1ea, 0.8), 0, -0.24, 0.13));
  } else if (visual === 'brent') {
    // Brent: a small see-through man in a polo shirt and lanyard, hovering at their shoulder with a thumbs up
    const brent = new THREE.Group();
    /** A see-through, faintly glowing material, for a ghost. */
    const ghost = (color: number) =>
      owned(
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.75,
          emissive: color,
          emissiveIntensity: 0.3,
        }),
      );
    put(brent, capsule(0.06, 0.08), ghost(0x7fb3e0), 0, 0, 0);
    put(brent, sph(0.06, 10), ghost(0xf0c8a8), 0, 0.13, 0);
    put(brent, rbox(0.1, 0.02, 0.1, 0.01), ghost(0x6b4a2a), 0, 0.18, 0);
    put(brent, rbox(0.03, 0.05, 0.01, 0.004), ghost(0xffffff), 0, -0.02, 0.06);
    put(brent, capsule(0.02, 0.06), ghost(0x7fb3e0), 0.08, 0.05, 0).rotation.z = 2.4;
    for (const o of brent.children) o.castShadow = false;
    brent.scale.setScalar(1.7);
    brent.position.set(0.38, 0.4, 0);
    torso.add(brent);
    rig.bob = brent;
  } else if (visual === 'toxic') {
    // a faint green haze hanging round them
    rig.orbit = new THREE.Group();
    const haze = owned(
      new THREE.MeshStandardMaterial({
        color: 0x8fd16a,
        transparent: true,
        opacity: 0.45,
        emissive: 0x6fb34a,
        emissiveIntensity: 0.4,
      }),
    );
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      put(rig.orbit, sph(0.09, 8), haze, Math.cos(a) * 0.3, Math.sin(i * 2.1) * 0.08, Math.sin(a) * 0.3).castShadow =
        false;
    }
    rig.orbit.position.y = 0.3;
    torso.add(rig.orbit);
  } else if (visual === 'leash') {
    // an empty leash, held out hopefully, with nothing on the end of it
    const strap = put(holdR, cyl(0.01, 0.01, 0.42, 6), mat(0xd9362f, 0.5), 0, -0.48 + handUp, 0.08);
    strap.rotation.x = 0.35;
    const collar = put(holdR, torus(0.06, 0.012), mat(0xd9362f, 0.5), 0, -0.68 + handUp, 0.16);
    collar.rotation.x = Math.PI / 2;
    rig.props.push(strap, collar);
  } else if (visual === 'cactus') {
    // a little cactus in a pot, balanced on the head, about as dry as they feel
    const pot = new THREE.Group();
    put(pot, cyl(0.06, 0.045, 0.07, 10), mat(0xb5523e, 0.8), 0, 0, 0);
    const green = mat(0x5a9a4f, 0.7);
    put(pot, capsule(0.035, 0.08), green, 0, 0.09, 0);
    put(pot, capsule(0.02, 0.03), green, 0.045, 0.1, 0).rotation.z = -0.9;
    pot.scale.setScalar(1.6);
    pot.position.y = 0.27;
    for (const o of pot.children) o.castShadow = false;
    head.add(pot);
    rig.props.push(pot);
  } else if (visual === 'bighead') {
    // a head swollen to half as big again, and a smug little crown on it
    rig.swell = [1.45, 1.45];
    head.scale.set(1.45 / wide, 1.45, 1.45 / wide);
    rig.props.push(put(head, cyl(0.1, 0.08, 0.07, 6), mat(0xd9a93a, 0.3, 0.2), 0, 0.24, 0));
  } else if (visual === 'compass') {
    // a compass floating over their head, its needle spinning round and never settling
    const compass = new THREE.Group();
    put(compass, cyl(0.11, 0.11, 0.025, 18), mat(0xc9a13a, 0.35, 0.3), 0, 0, 0);
    put(compass, cyl(0.095, 0.095, 0.03, 18), mat(0xf4f1ea, 0.6), 0, 0.002, 0);
    rig.orbit = new THREE.Group();
    put(rig.orbit, rbox(0.15, 0.012, 0.025, 0.004), mat(0xd9362f, 0.5), 0.04, 0, 0);
    put(rig.orbit, rbox(0.08, 0.012, 0.025, 0.004), mat(0x3a3a46, 0.5), -0.04, 0, 0);
    rig.orbit.position.y = 0.025;
    compass.add(rig.orbit);
    for (const o of [...compass.children, ...rig.orbit.children]) o.castShadow = false;
    // bobbing gently, and put away while they lie down
    compass.scale.setScalar(1.5);
    compass.position.y = 0.4;
    head.add(compass);
    rig.bob = compass;
  } else if (visual === 'neck') {
    // a phone held up in front of them, its screen lit, that they cannot look up from
    const phone = new THREE.Group();
    put(phone, rbox(0.13, 0.22, 0.02, 0.015), mat(0x1d1f24, 0.3), 0, 0, 0);
    // lit on both faces, so it glows whichever way it is seen
    const glow = joined('phone screens', [
      [rbox(0.11, 0.19, 0.006, 0.005), 0, 0, 0.012],
      [rbox(0.11, 0.19, 0.006, 0.005), 0, 0, -0.012],
    ]);
    put(phone, glow, mat(0x8fd3ff, 0.3, 1.2), 0, 0, 0);
    // lying on the hand, on the thumb's side, which faces up with the forearm raised, the screen tipped to the face
    phone.position.set(0, -0.32 + handUp, 0.068);
    phone.rotation.x = 0.45;
    phone.name = 'phone';
    holdR.add(phone);
    rig.props.push(phone);
  } else machineSymptom(rig, visual, { head, torso, holdR, foreL, handUp });
  for (const o of [rig.knot, rig.steam, rig.band, rig.orbit, rig.bob]) if (o) rig.props.push(o);
  transformSymptom(rig, visual);
  if (rig.bob) rig.bobAt = rig.bob.position.y;
  if (role === 'practitioner' || role === 'caretaker') {
    const { bundle, tip } = buildSage();
    bundle.position.set(0, -0.31 + handUp, 0.03);
    holdR.add(bundle);
    rig.sage = bundle;
    rig.sageTip = tip;
    rig.smoke = buildSmoke();
  }
  if (role === 'caretaker') {
    // held out in front at the hands, slanting down and forward to the floor
    const mop = buildMop();
    mop.position.set(0, 0.3, 0.21);
    mop.rotation.x = -0.81;
    torso.add(mop);
    rig.mop = mop;
  }
  trimShadows(group, look.scale);
  return rig;
}

/** Begin a healed guest's cure at a moment: their symptom then shrinks away over the next few frames (see `poseChar`). */
export function cureRig(rig: CharRig, t: number) {
  if (!Number.isNaN(rig.curedAt)) return;
  rig.curedAt = t;
  rig.rest = rig.props.map((o) => ({ scale: o.scale.clone(), y: o.position.y }));
}

/**
 * Put a healed guest's symptom away for good, once it has gone: every prop hidden and put back as it was built, so a
 * model built again is right, the head and skin as they were, and glasses back on in place of sunglasses.
 */
export function endCure(rig: CharRig, look: Look) {
  rig.cured = true;
  rig.props.forEach((o, i) => {
    o.visible = false;
    const rest = rig.rest?.[i];
    if (!rest) return;
    o.scale.copy(rest.scale);
    o.position.y = rest.y;
  });
  if (rig.glasses) rig.glasses.visible = true;
  restoreRig(rig);
  rig.head.scale.set(1 / rig.wide, 1, 1 / rig.wide);
  rig.headMesh.material = mat(look.skin, 0.65);
  if (rig.burst) rig.burst.group.visible = false;
}

/** Put back the parts and colors a symptom stood in for, once. */
export function restoreRig(rig: CharRig) {
  for (const undo of rig.restore ?? []) undo();
  delete rig.restore;
}
