// What an item shows of what it is doing, with no overlay open: smoke, a shudder or a flickering light as it wears out
// and a dead look once it breaks, grime as it gets dirty, ripples while a guest plays something loud, wisps of warm
// or cool air off a heater or an air conditioner, flames and black smoke while it burns and a charred look after, and
// the mark of a mishap that has stopped it: its lights out in a power cut, frost in a freeze, and wasps round it. Each cue is a few small parts added to a model the first time it is
// needed, from shapes every model shares, and hidden the rest of the time, so a cue that is off draws nothing. Like the
// rest of an item's moving parts, each is worked out afresh from the time and the item's state, frame by frame.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { DIRT_FILTHY, ITEMS, type ItemType, type MishapId, NOISE_NOTICE, WEAR_WARN } from '../core/data';
import { clamp } from '../core/util';
import { isOwned, owned } from './disposal';
import { BOOST_LOOP } from './gags/clock';
import { cached, type CueParts, partsOf, sph } from './models/parts';

/** How an item shows its wear: a machine puffs smoke, furniture shudders, and a mat gives off dust. */
export type WearLook = 'smoke' | 'shudder' | 'dust';

/** How each item that wears out shows it. */
export const WEAR_LOOKS: Partial<Record<ItemType, WearLook>> = {
  snack_machine: 'smoke',
  posture_scanner: 'smoke',
  arcade_machine: 'smoke',
  air_conditioner: 'smoke',
  fortune_teller: 'smoke',
  water_cooler: 'smoke',
  generator: 'smoke',
  massage_table: 'shudder',
  acu_table: 'shudder',
  reiki_table: 'shudder',
  lounger: 'shudder',
  tea_station: 'shudder',
  kombucha_tap: 'shudder',
  sound_mat: 'dust',
  ceremony_mat: 'dust',
  // a treatment machine's gag already smokes once it is worn enough to overload, so it shudders rather than smoke twice
  kneadmaster: 'shudder',
  pin_press: 'shudder',
  aura_wash: 'shudder',
  great_alphorn: 'shudder',
  cider_press: 'shudder',
  wheel_of_rebirth: 'shudder',
  stone_kiln: 'shudder',
  octopus: 'shudder',
  geode: 'shudder',
};

/**
 * The least noise an item must make for a guest using it to send out ripples: as much as a guest on a treatment table
 * would notice. Anything quieter is a murmur not worth showing, or every reception desk would ripple all day.
 */
export const NOISE_CUE = NOISE_NOTICE;

/** How loud something is while a guest uses it: its own noise, or that of the session it sounds in, like a gong. */
export const usedNoise = (type: ItemType) => ITEMS[type].noise ?? ITEMS[type].sessionNoise ?? 0;

/** How far a broken piece of furniture lists to one side, in radians, as if a leg had gone. */
export const BROKEN_LEAN = 0.07;

/** How far into its warning an item is: 0 below `WEAR_WARN`, rising to 1 as it breaks. */
export const wearShown = (wear: number) => clamp((wear - WEAR_WARN) / (100 - WEAR_WARN), 0, 1);

/** Whether an item is worn enough to show it, but not yet broken. */
export const showsWear = (wear: number) => wear >= WEAR_WARN && wear < 100;

/** Seconds between puffs of smoke or shudders: every five at first, more and more often as it wears. */
export const cueEvery = (shown: number) => 5 - 3.2 * shown;

/** An item's own offset into each repeating cue, as a share of the time between, so no two keep time together. */
const offset = (id: number) => (((id * 0.618 - 0.4) % 1) + 1) % 1;

/**
 * Where a short burst that comes every `every` seconds and lasts `lasts` is at time `t`: from 0 to 1 while it runs,
 * and -1 between bursts. An item's id sets it off at its own moment.
 */
export function burst(t: number, every: number, lasts: number, id: number): number {
  const into = (((t + offset(id) * every) % every) + every) % every;
  return into < lasts ? into / lasts : -1;
}

/** A number from 0 to 1 that looks random but is always the same for the same input. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** How bright a worn light is at a moment: now and then it drops out, more often the more worn it is. */
export function flicker(t: number, id: number, shown: number): number {
  return hash(Math.floor(t * 9) + id * 97) < 0.06 + 0.4 * shown ? 0.15 : 1;
}

/** How far worn furniture tips at a moment: still, then a short shudder every few seconds, harder as it wears. */
export function shudder(t: number, id: number, shown: number): number {
  const p = burst(t, cueEvery(shown), 0.6, id);
  return p < 0 ? 0 : (0.015 + 0.035 * shown) * Math.sin(p * Math.PI * 8) * (1 - p);
}

/** What the cues follow: the item, how worn and dirty it is, whether a guest is using it and how hard it is heating. */
export interface CueCondition {
  id: number;
  type: ItemType;
  wear: number;
  dirt: number;
  /** A guest is using it: at its station, or in one of its places. */
  inUse: boolean;
  /** How hard it is running: warming or cooling the air, or carrying the center through a mishap, from 0 (off) to 1 (flat out). */
  running: number;
  /** Its room is being rattled through the wall by a machine next door, like the Gong of Last Resort as it plays. */
  rattled?: boolean;
  /** How a mishap that has taken it out of action shows on it, if one has. */
  stopped?: StopLook | undefined;
  /** How far it stands in the dark of a power cut, from 0 in the light to 1 inside the building with its lights out. */
  shade?: number;
  /**
   * It is on fire, and being put out this moment, hosed by a firefighter or doused by a Caretaker: how far it is out,
   * from 0 as they start to 1 as it goes out.
   */
  burning?: boolean;
  hosed?: number;
  /** It burnt in a fire, and has not been repaired since. */
  burnt?: boolean;
}

/**
 * How bright a cue drawn without light (smoke, ripples, wisps) shows in the dark, against in the light: it dims with
 * everything round it in a power cut, rather than glowing as if lit.
 */
const UNLIT_IN_SHADE = 0.45;

/** The share of its own brightness a cue drawn without light shows, for how far it stands in the dark. */
export const unlitShare = (c: Pick<CueCondition, 'shade'>) => 1 - (c.shade ?? 0) * (1 - UNLIT_IN_SHADE);

/**
 * How a mishap shows on what it has stopped: switched off at the plug, frozen solid, or swarmed by wasps; or how a fire
 * leaves what it burnt, charred black.
 */
export type StopLook = 'off' | 'frost' | 'wasps' | 'charred';

/** How each mishap shows on the items it stops: a storm shuts the Aura Wash down, as a power cut does. */
export const STOP_LOOKS: Readonly<Record<MishapId, StopLook>> = {
  power: 'off',
  storm: 'off',
  freeze: 'frost',
  wasps: 'wasps',
};

/** A see-through material for one puff, ring or wisp, so each can fade on its own. */
const fade = (color: number) =>
  owned(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));

/** A flat ring lying level, for ripples: one shape for every one of them. */
const ring = () => cached('cue-ring', () => new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2));

/** The box a model's own parts fill, in the model's frame, before any cue or marker was added to it. */
function bounds(model: THREE.Object3D): THREE.Box3 {
  model.updateWorldMatrix(true, true);
  const toModel = model.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  model.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const shape = (o as THREE.Mesh).geometry;
    shape.computeBoundingBox();
    if (shape.boundingBox)
      box.union(part.copy(shape.boundingBox).applyMatrix4(toModel.clone().multiply(o.matrixWorld)));
  });
  return box;
}

/** A model's cues, set up the first time one is needed. */
function cuesOf(model: THREE.Object3D): CueParts {
  const parts = partsOf(model);
  parts.cues ??= { box: bounds(model) };
  return parts.cues;
}

/** A group of `n` parts of one shape, each fading on its own, added to a model and never picked. */
function cueGroup(model: THREE.Object3D, shape: THREE.BufferGeometry, n: number, color: number): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(shape, fade(color));
    /** Cues are not there to be clicked: a click goes to the item itself. */
    m.raycast = () => undefined;
    m.renderOrder = 2;
    m.userData.cue = true;
    group.add(m);
  }
  model.add(group);
  return group;
}

/** The material of each part of a cue group. */
const fadeOf = (o: THREE.Object3D) => (o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material;

/** Smoke a worn machine puffs out, or the dust a worn mat gives off, and the dark smoke of a broken machine. */
function animateSmoke(model: THREE.Object3D, c: CueCondition, look: WearLook | undefined, t: number) {
  const worn = showsWear(c.wear);
  // anything on fire gives off black smoke, whatever it shows of its wear
  const dead = (c.wear >= 100 && look === 'smoke') || !!c.burning;
  const on = (worn && (look === 'smoke' || look === 'dust')) || dead;
  let smoke = partsOf(model).cues?.smoke;
  if (!on) {
    if (smoke) smoke.visible = false;
    return;
  }
  const cues = cuesOf(model);
  smoke = cues.smoke ??= cueGroup(model, sph(0.1, 8), 3, 0x9a9a9a);
  smoke.visible = true;
  const { box } = cues;
  const shown = wearShown(c.wear);
  const dust = look === 'dust';
  // a broken machine smolders without a break; a worn one puffs every few seconds, bigger as it wears
  const every = dead ? 1.8 : cueEvery(shown);
  const color = dead ? 0x26262a : dust ? 0xcbb68f : 0x9a9a9a;
  // big enough to read from the game's usual distance, where a meter is a few dozen pixels
  const size = dead ? 2.2 : (dust ? 2.6 : 2.4) * (0.8 + 0.7 * shown);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  smoke.children.forEach((p, i) => {
    const f = dead ? burst(t + i * 0.6, every, every, c.id) : burst(t - i * 0.25, every, 1.6, c.id);
    const m = fadeOf(p);
    m.color.setHex(color).multiplyScalar(unlitShare(c));
    p.visible = f >= 0;
    if (f < 0) return;
    // dust spreads along the mat and settles; smoke climbs from the top and drifts
    const spread = dust ? (box.max.z - box.min.z) * 0.3 : 0.08;
    p.position.set(
      cx + Math.sin(f * 4 + i * 2.1 + c.id) * spread * (dust ? 1 : f),
      box.max.y + 0.05 + f * (dust ? 0.35 : dead ? 1.3 : 0.9),
      cz + (dust ? (i - 1) * spread : 0),
    );
    p.scale.setScalar(size * (0.5 + f * 1.1));
    m.opacity = (dead ? 0.8 : dust ? 0.55 : 0.7) * (1 - f) * Math.min(1, f * 6);
  });
}

/** The colors of a fire's flames, orange outside and yellow at the heart, and of the steam off one being put out. */
const FLAME = 0xff5a1a;
const FLAME_HEART = 0xffc23a;
const STEAM = 0xf4f6f8;

/**
 * Where the flames stand on something on fire, in shares of its box: four orange ones toward its corners and three
 * yellow ones at the heart, rising from a little over halfway up so they wrap round its top, whatever its shape, rather
 * than float over a chimney or a lamp.
 */
const FLAME_SPOTS: readonly { x: number; z: number; up: number; heart: boolean }[] = [
  { x: -0.3, z: -0.25, up: 0.55, heart: false },
  { x: 0.3, z: -0.25, up: 0.55, heart: false },
  { x: -0.3, z: 0.25, up: 0.5, heart: false },
  { x: 0.3, z: 0.25, up: 0.5, heart: false },
  { x: -0.15, z: 0, up: 0.62, heart: true },
  { x: 0.15, z: 0.05, up: 0.62, heart: true },
  { x: 0, z: -0.1, up: 0.66, heart: true },
];

/** How much of their size the flames keep once nearly hosed out. */
const HOSED_LEFT = 0.2;

/** A flame: a cone standing on its base, one shape for every flame on every fire. */
const flame = () => cached('cue-flame', () => new THREE.ConeGeometry(0.16, 0.55, 8).translate(0, 0.275, 0));

/** The flames for a model, made the first time it burns: full strength, as a fire's light is. */
function flamesFor(model: THREE.Object3D): THREE.Group {
  const group = cueGroup(model, flame(), FLAME_SPOTS.length, FLAME);
  group.children.forEach((f, i) => {
    const m = fadeOf(f);
    m.color.setHex(FLAME_SPOTS[i]?.heart ? FLAME_HEART : FLAME);
    m.toneMapped = false;
  });
  return group;
}

/**
 * Flames licking up round the top of something on fire, each flickering on its own, and shrinking over the time it
 * takes to hose them out while a firefighter or a Caretaker is putting them out, with steam rising off it.
 */
function animateFlames(model: THREE.Object3D, c: CueCondition, t: number) {
  let flames = partsOf(model).cues?.flames;
  if (!c.burning) {
    if (flames) flames.visible = false;
    const steam = partsOf(model).cues?.steam;
    if (steam) steam.visible = false;
    return;
  }
  const cues = cuesOf(model);
  flames = cues.flames ??= flamesFor(model);
  flames.visible = true;
  const { box } = cues;
  const w = box.max.x - box.min.x;
  const d = box.max.z - box.min.z;
  const h = box.max.y - box.min.y;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  // shrinking as the hose or the extinguisher puts it out, in step with the game, so it waits while the game is paused
  const hosed = c.hosed !== undefined;
  const left = 1 - (1 - HOSED_LEFT) * clamp(c.hosed ?? 0, 0, 1);
  // big enough to read from the game's usual distance, and bigger on something bigger
  const size = clamp(Math.max(w, d, h) * 0.85, 1, 1.8) * left;
  flames.children.forEach((f, i) => {
    const spot = FLAME_SPOTS[i] ?? { x: 0, z: 0, up: 0.6, heart: true };
    const lick = 0.8 + 0.22 * Math.sin(t * (9 + i * 2.3) + c.id + i) + 0.12 * Math.sin(t * 23 + i * 5);
    f.position.set(
      cx + spot.x * w + Math.sin(t * 3 + i) * 0.02,
      box.min.y + spot.up * h,
      cz + spot.z * d + Math.cos(t * 2.6 + i) * 0.02,
    );
    const across = size * (spot.heart ? 0.75 : 1);
    f.scale.set(across, size * lick * (spot.heart ? 1.25 : 1.1), across);
    fadeOf(f).opacity = 0.95;
  });
  const steam = (cues.steam ??= cueGroup(model, sph(0.1, 8), 3, STEAM));
  steam.visible = hosed;
  if (!hosed) return;
  steam.children.forEach((p, i) => {
    const f = burst(t + i * 0.4, 1.2, 1.2, c.id);
    p.position.set(cx + Math.sin(f * 4 + i * 2.1) * 0.15, box.max.y + 0.2 + f * 1.1, cz + (i - 1) * 0.1);
    p.scale.setScalar(2.2 * (0.6 + f));
    fadeOf(p).opacity = 0.75 * (1 - f) * Math.min(1, f * 5);
  });
}

/** The warm white of the ripples off something loud. */
const RIPPLE = 0xfff4d6;

/** Ripples spreading from something loud while a guest plays it, wider the louder it is. */
function animateRipples(model: THREE.Object3D, c: CueCondition, t: number) {
  const noise = usedNoise(c.type);
  const on = c.inUse && noise >= NOISE_CUE && c.wear < 100;
  let ripple = partsOf(model).cues?.ripple;
  if (!on) {
    if (ripple) ripple.visible = false;
    return;
  }
  const cues = cuesOf(model);
  ripple = cues.ripple ??= cueGroup(model, ring(), 2, RIPPLE);
  ripple.visible = true;
  const { box } = cues;
  const from = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  ripple.children.forEach((r, i) => {
    const f = burst(t + i * 0.7, 1.4, 1.4, c.id);
    r.position.set((box.min.x + box.max.x) / 2, box.max.y * 0.55, (box.min.z + box.max.z) / 2);
    r.scale.setScalar(from + 0.1 + f * noise * 0.3);
    fadeOf(r).opacity = 0.6 * (1 - f) ** 1.5;
    fadeOf(r).color.setHex(RIPPLE).multiplyScalar(unlitShare(c));
  });
}

/** The color of the heat rising off a heater, and of the cool air blowing out of an air conditioner. */
const WARM_AIR = 0xff8a3d;
const COOL_AIR = 0x5ab8f0;
/** How big a line of moving air is, in meters, and how many waves it shows along its length. */
const AIR_LINE = { w: 0.24, h: 0.52, waves: 1.25 };
/** How steeply cool air rises as it blows out of an air conditioner's vents, in radians above level. */
const COOL_RISE = 0.45;
/** How far a line of cool air drifts out from the vents over its life, in meters. */
const COOL_DRIFT = 0.3;
/** How high up the front of an air conditioner its vents are, as a share of its height. */
const VENT_HEIGHT = 0.8;
/** How many times a second the waves of moving air travel a whole wave along their line, and how long each line lasts. */
const AIR_WAVE_SPEED = 0.9;
const AIR_LIFE = 2.4;

/**
 * One wave of a line of moving air, from side to side and back as it goes along, as a picture that repeats along a
 * line: a thick, soft-edged white stroke for the line to tint.
 */
function airWaveTexture(): THREE.DataTexture {
  const W = 32;
  const H = 64;
  const swing = W * 0.24;
  const half = W * 0.15;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const a = ((y + 0.5) / H) * Math.PI * 2;
    // how far the stroke is from the pixel, square to the stroke rather than straight across, where it slants
    const slant = Math.hypot(1, ((swing * Math.PI * 2) / H) * Math.cos(a));
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x + 0.5 - W / 2 - swing * Math.sin(a)) / slant;
      data.set([255, 255, 255, Math.round(255 * clamp(half - d + 0.5, 0, 1))], (y * W + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, AIR_LINE.waves);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * How much of a line of moving air shows along its length, for an alpha map: nothing at either end, so it comes out of
 * the air where it starts and melts back into it where it ends.
 */
function airFadeTexture(): THREE.DataTexture {
  const H = 64;
  const data = new Uint8Array(H * 4);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const a = Math.round(255 * THREE.MathUtils.smoothstep(v, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(v, 0.55, 1)));
    data.set([a, a, a, 255], y * 4);
  }
  const tex = new THREE.DataTexture(data, 1, H);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
let airWave: THREE.DataTexture | null = null;
let airFade: THREE.DataTexture | null = null;

/**
 * A line of cool air blowing out of a vent: a flat ribbon starting at the vent and running out from the front, rising
 * as it goes. It lies nearly level, so the camera, always looking down from above, sees its waves from every side.
 */
const coolLine = () =>
  cached('cue-cool-line', () =>
    new THREE.PlaneGeometry(AIR_LINE.w, AIR_LINE.h).translate(0, AIR_LINE.h / 2, 0).rotateX(Math.PI / 2 - COOL_RISE),
  );

/**
 * A group of `n` wavy lines of moving air, each fading on its own, added to a model and never picked: warm air's lines
 * stand up and face the camera as they rise, and cool air's lie out from the vents.
 */
function airLines(model: THREE.Object3D, n: number, cool: boolean): THREE.Group {
  airWave ??= airWaveTexture();
  airFade ??= airFadeTexture();
  const look = { map: airWave, alphaMap: airFade, transparent: true, opacity: 0, depthWrite: false };
  const group = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const line = cool
      ? new THREE.Mesh(
          coolLine(),
          owned(new THREE.MeshBasicMaterial({ ...look, color: COOL_AIR, side: THREE.DoubleSide })),
        )
      : new THREE.Sprite(owned(new THREE.SpriteMaterial({ ...look, color: WARM_AIR })));
    /** Cues are not there to be clicked: a click goes to the item itself. */
    line.raycast = () => undefined;
    line.renderOrder = 2;
    line.userData.cue = true;
    group.add(line);
  }
  model.add(group);
  return group;
}

/**
 * Wavy lines of heat rising off a heater, or of cool air blowing out of an air conditioner's vents and up into the room,
 * while it runs.
 */
function animateWisps(model: THREE.Object3D, c: CueCondition, t: number) {
  const heat = ITEMS[c.type].heat ?? 0;
  const on = heat !== 0 && c.running > 0 && c.wear < 100;
  let wisps = partsOf(model).cues?.wisps;
  if (!on) {
    if (wisps) wisps.visible = false;
    return;
  }
  const cool = heat < 0;
  const cues = cuesOf(model);
  wisps = cues.wisps ??= airLines(model, 3, cool);
  wisps.visible = true;
  const { box } = cues;
  const width = box.max.x - box.min.x;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  // each line drifts along as its waves run along it, swaying a little, and fades out as it goes
  if (airWave) airWave.offset.y = -((t * AIR_WAVE_SPEED) % 1);
  wisps.children.forEach((w, i) => {
    const f = burst(t + (i * AIR_LIFE) / 3, AIR_LIFE, AIR_LIFE, c.id);
    const x = cx + (i - 1) * width * 0.3 + Math.sin(t * 1.3 + i * 2.1) * 0.03;
    const breath = 0.9 + 0.15 * Math.sin(t * 2.3 + i);
    if (cool) {
      // out of the vents on the front, and up and away into the room
      const out = f * COOL_DRIFT;
      w.position.set(x, box.max.y * VENT_HEIGHT + out * Math.sin(COOL_RISE), box.max.z + out * Math.cos(COOL_RISE));
      w.scale.set(breath, 1, 1);
    } else {
      // off the top, and up
      w.position.set(x, box.max.y + AIR_LINE.h * 0.4 + f * 0.3, cz);
      w.scale.set(AIR_LINE.w * breath, AIR_LINE.h, 1);
    }
    const m = (w as THREE.Object3D & { material: THREE.MeshBasicMaterial | THREE.SpriteMaterial }).material;
    m.opacity = Math.sin(f * Math.PI) * (0.65 + 0.3 * c.running);
    m.color.setHex(cool ? COOL_AIR : WARM_AIR).multiplyScalar(unlitShare(c));
  });
}

/** How often fumes puff from a running engine's exhaust, in seconds, and how high they rise. */
const FUME_EVERY = 0.55;
const FUME_RISE = 0.6;
/** How fast and how far a running engine shudders: about eight times a second, by a hundredth of a radian. */
const CHUG_HZ = 8;
const CHUG = 0.01;
/** The share of its light an engine standing by shows, against running. */
const STANDBY_LIGHT = 1 / 3;

/** Fumes puffing from an engine's exhaust while it runs, one after another, rising and spreading as they fade. */
function animateFumes(model: THREE.Object3D, c: CueCondition, t: number) {
  const from = partsOf(model).exhaust;
  let fumes = partsOf(model).cues?.fumes;
  if (!from || c.running <= 0 || c.wear >= 100) {
    if (fumes) fumes.visible = false;
    return;
  }
  fumes = cuesOf(model).fumes ??= cueGroup(model, sph(0.1, 8), 3, 0x5d6066);
  fumes.visible = true;
  fumes.children.forEach((p, i) => {
    const f = burst(t + i * FUME_EVERY, FUME_EVERY * 3, FUME_EVERY * 3, c.id);
    p.visible = f >= 0;
    if (f < 0) return;
    p.position.set(from.x + Math.sin(f * 3 + i) * 0.05 * f, from.y + f * FUME_RISE, from.z);
    p.scale.setScalar(0.6 + f * 1.4);
    fadeOf(p).opacity = 0.65 * (1 - f) * Math.min(1, f * 8);
  });
}

/** Shudder an engine while it runs, and stand it still again when it stops. */
function animateChug(model: THREE.Object3D, c: CueCondition, t: number) {
  if (!partsOf(model).exhaust) return;
  model.rotation.z = c.running > 0 && c.wear < 100 ? Math.sin(t * Math.PI * 2 * CHUG_HZ + c.id) * CHUG : 0;
}

/** The color a light goes when its item breaks: nearly black, whatever it was. */
const DEAD = new THREE.Color(0x2b2e35);

/** How far toward dead a light switched off goes: dark, but not as black as a broken one. */
const SWITCHED_OFF = 0.6;

/**
 * A light on a worn item, at the brightness it would otherwise have: it flickers once the item shows its wear, and goes
 * dark when it breaks, or while it is switched `off`, as in a power cut. It comes back as it was once repaired or the
 * power is back.
 */
export function wearLight(
  m: THREE.MeshStandardMaterial,
  wear: number,
  id: number,
  bright: number,
  t: number,
  off = false,
) {
  const lit = (m.userData.lit ??= m.color.clone()) as THREE.Color;
  if (wear >= 100 || off) {
    m.color.lerpColors(lit, DEAD, wear >= 100 ? 0.85 : SWITCHED_OFF);
    m.emissiveIntensity = 0;
    return;
  }
  m.color.copy(lit);
  m.emissiveIntensity = showsWear(wear) ? bright * flicker(t, id, wearShown(wear)) : bright;
}

/** The dingy brown grime turns a surface toward as it gets dirty. */
const GRIME = new THREE.Color(0x8a7a4e);

/** Tint a surface by how dirty it is, from clean at 0 to as grimy as it gets once filthy. */
export function grime(m: THREE.MeshStandardMaterial, dirt: number) {
  const clean = (m.userData.clean ??= m.color.clone()) as THREE.Color;
  m.color.lerpColors(clean, GRIME, clamp(dirt / DIRT_FILTHY, 0, 1) * 0.6);
}

/** Tip worn furniture in a shudder now and then, and let broken furniture list as if a leg had gone. */
function animateLean(model: THREE.Object3D, c: CueCondition, t: number) {
  model.rotation.x = 0;
  model.rotation.z = c.wear >= 100 ? BROKEN_LEAN : showsWear(c.wear) ? shudder(t, c.id, wearShown(c.wear)) : 0;
}

/** How far, in radians, something next door to a struck gong rocks at most, give or take its own build. */
export const RATTLE_PEAK = 0.025;
/** The stretch of each loop of a booster's gag, after the gong is struck, that the rooms next door rattle for. */
const RATTLE_FROM = 0.18;
const RATTLE_TO = 0.6;

/**
 * How far something next door to a struck gong rocks at a moment: a short rattle just after each strike, in step with
 * the gong's own loop, and still between. Each item rocks a little harder or softer, and its own way.
 */
export function rattle(t: number, id: number): number {
  const p = (((t / BOOST_LOOP) % 1) + 1) % 1;
  if (p < RATTLE_FROM || p > RATTLE_TO) return 0;
  const f = (p - RATTLE_FROM) / (RATTLE_TO - RATTLE_FROM);
  return RATTLE_PEAK * (0.7 + 0.6 * hash(id)) * Math.sin(f * Math.PI * 12 + id) * (1 - f);
}

/**
 * Rock an item while its room is rattled, from however it stands: worn furniture's lean is set afresh each frame, so it
 * rocks from that, and anything else from the tilt it had before it was first rattled.
 */
function animateRattle(model: THREE.Object3D, c: CueCondition, leans: boolean, t: number) {
  if (!c.rattled && model.userData.restTilt === undefined) return;
  const rest = (model.userData.restTilt ??= model.rotation.z) as number;
  const shake = c.rattled ? rattle(t, c.id) : 0;
  model.rotation.z = (leans ? model.rotation.z : rest) + shake;
}

/** The ice a frozen item is glazed toward, and how far: pale blue, glinting a little even in shade. */
const ICE = new THREE.Color(0xa8d8ff);
const ICE_BY = 0.55;
const ICE_GLINT = 0.18;

/** Glaze a material a model owns with ice, or take the ice off, once its color has been set for the frame. */
function frost(m: THREE.MeshStandardMaterial, on: boolean) {
  const glint = (m.userData.glint ??= { color: m.emissive.clone(), level: m.emissiveIntensity }) as {
    color: THREE.Color;
    level: number;
  };
  if (!on) {
    m.emissive.copy(glint.color);
    m.emissiveIntensity = glint.level;
    return;
  }
  m.color.lerp(ICE, ICE_BY);
  m.emissive.copy(ICE);
  m.emissiveIntensity = ICE_GLINT;
}

/**
 * The near-black a fire chars everything it burns toward, and how far: colors mix in linear light, where most of a
 * color's brightness on screen lies in its first few percent, so it takes nearly all the way to look burnt.
 */
const CHAR = new THREE.Color(0x221d1a);
const CHAR_BY = 0.94;

/** The looks an item's parts can be dressed in: switched off, frozen, or charred. */
type Dress = 'off' | 'frost' | 'charred';

/** Each material's look while stopped, made once from it: a shared material's is shared too. */
const stoppedLooks = new WeakMap<THREE.Material, Partial<Record<Dress, THREE.Material>>>();

/**
 * A material as it looks on an item a mishap has stopped, or the material itself where it does not change: glazed with
 * ice when frozen; with any glow switched off, and darker, when the power is off; and charred nearly black, matt and with
 * no glow, once it has burnt.
 */
function stoppedMaterial(m: THREE.Material, look: Dress): THREE.Material {
  const made = stoppedLooks.get(m)?.[look];
  if (made) return made;
  let out: THREE.Material = m;
  if (look === 'charred' && (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial)) {
    const burnt = m.clone();
    burnt.color.lerp(CHAR, CHAR_BY);
    if (burnt instanceof THREE.MeshStandardMaterial) {
      burnt.emissiveIntensity = 0;
      burnt.roughness = 0.95;
    }
    out = burnt;
  } else if (
    look === 'off' &&
    m instanceof THREE.MeshStandardMaterial &&
    m.emissiveIntensity > 0 &&
    m.emissive.getHex()
  ) {
    const dark = m.clone();
    dark.emissiveIntensity = 0;
    dark.color.multiplyScalar(0.55);
    out = dark;
  } else if (look === 'frost' && (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial)) {
    const iced = m.clone();
    iced.color.lerp(ICE, ICE_BY);
    if (iced instanceof THREE.MeshStandardMaterial) {
      iced.emissive.copy(ICE);
      iced.emissiveIntensity = ICE_GLINT;
      iced.roughness = Math.min(iced.roughness, 0.3);
    }
    out = iced;
  }
  // a look made from a material one model alone owns belongs to that model too, and goes with it
  if (out !== m && isOwned(m)) owned(out);
  stoppedLooks.set(m, { ...stoppedLooks.get(m), [look]: out });
  return out;
}

/** The materials of a model that its own parts change frame by frame, which a stop must leave to them. */
function animatedMaterials(model: THREE.Object3D): Set<THREE.Material | undefined> {
  const { leaf, glow, led, lamp, grime: dirty, linens, moss, shine } = partsOf(model);
  return new Set([leaf, glow, led, lamp, dirty, linens, moss, shine]);
}

/**
 * Dress a model for how a mishap has stopped it: each of its parts in its stopped material, or back in its own once
 * the mishap is over. Only a change of look does any work, so this is free from frame to frame.
 */
export function dressStopped(model: THREE.Object3D, look: StopLook | undefined) {
  const dressed = look === 'off' || look === 'frost' || look === 'charred' ? look : undefined;
  const cues = cuesOf(model);
  if (cues.dressed === dressed) return;
  cues.dressed = dressed;
  // what burnt is charred all over, its glow and its moving parts too: they stand still until it is repaired
  const keep = dressed === 'charred' ? new Set() : animatedMaterials(model);
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.cue) return;
    const own = (o.userData.asBuilt ??= o.material) as THREE.Material | THREE.Material[];
    if (Array.isArray(own)) return;
    // a part left to animate itself goes back to its own material all the same, should a fire have charred it
    o.material = dressed && !keep.has(own) ? stoppedMaterial(own, dressed) : own;
  });
}

/** How many wasps buzz round something they have stopped, how far out they fly and how high over its top. */
const WASPS = 7;
const WASP_REACH = 0.5;
const WASP_RISE = 0.35;

/** How big a wasp is, in meters, and the colors of the swarm: mostly black, one in three gold, so it reads as wasps. */
const WASP_SIZE = 0.4;
const WASP_BLACK = new THREE.Color(0x2a2620);
const WASP_GOLD = new THREE.Color(0xf2b705);

/** A round dot, solid to its edge, for a wasp seen from far off. */
function dotTexture(): THREE.DataTexture {
  const N = 16;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inside = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) < N / 2 - 0.5;
      data.set([255, 255, 255, inside ? 255 : 0], (y * N + x) * 4);
    }
  const tex = new THREE.DataTexture(data, N, N);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** What every wasp is drawn in: one material for every swarm. */
let waspLook: THREE.PointsMaterial | null = null;

/**
 * Where a wasp is at a moment, round the middle of what it buzzes about: each on its own looping path, darting quickly
 * this way and that, so a swarm reads from far off by its jitter.
 */
export function waspAt(t: number, i: number, id: number): [x: number, y: number, z: number] {
  const a = t * (2.1 + (i % 3) * 0.5) + i * 2.4 + id;
  const b = t * (3.3 + (i % 2) * 0.9) + i * 1.3;
  return [
    Math.sin(a) * WASP_REACH * (0.6 + 0.4 * Math.sin(b * 0.7)),
    Math.sin(b) * 0.12 + Math.sin(t * 23 + i * 5) * 0.025,
    Math.cos(a * 1.3) * WASP_REACH * 0.7,
  ];
}

/** A swarm of wasps, as dots: one part, drawn at once, whatever their number. */
function swarm(model: THREE.Object3D): THREE.Points {
  const shape = owned(new THREE.BufferGeometry());
  shape.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WASPS * 3), 3));
  const colors = new Float32Array(WASPS * 3);
  for (let i = 0; i < WASPS; i++) (i % 3 === 1 ? WASP_GOLD : WASP_BLACK).toArray(colors, i * 3);
  shape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  waspLook ??= new THREE.PointsMaterial({
    size: WASP_SIZE,
    map: dotTexture(),
    vertexColors: true,
    alphaTest: 0.5,
  });
  const wasps = new THREE.Points(shape, waspLook);
  /** Cues are not there to be clicked: a click goes to the item itself. */
  wasps.raycast = () => undefined;
  // they move every frame, so their bounds are never worked out
  wasps.frustumCulled = false;
  wasps.userData.cue = true;
  model.add(wasps);
  return wasps;
}

/** A swarm of wasps round the top of something they have stopped, black and gold and never still. */
function animateWasps(model: THREE.Object3D, c: CueCondition, t: number) {
  let wasps = partsOf(model).cues?.wasps;
  if (c.stopped !== 'wasps') {
    if (wasps) wasps.visible = false;
    return;
  }
  const cues = cuesOf(model);
  wasps = cues.wasps ??= swarm(model);
  wasps.visible = true;
  const { box } = cues;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const at = wasps.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < WASPS; i++) {
    const [x, y, z] = waspAt(t, i, c.id);
    at.setXYZ(i, cx + x, box.max.y + WASP_RISE + y, cz + z);
  }
  at.needsUpdate = true;
}

/** How many icicles hang from the front of something frozen, and how long the longest is. */
const ICICLES = 4;
const ICICLE_LONG = 0.16;

/** What every icicle is drawn in: one see-through ice for all of them. */
let ice: THREE.MeshBasicMaterial | null = null;

/** The icicles along the top front edge of a model's box, as one shape of its own, so they are drawn at once. */
function icicles(model: THREE.Object3D, box: THREE.Box3, id: number): THREE.Mesh {
  const width = box.max.x - box.min.x;
  const each = Array.from({ length: ICICLES }, (_, i) =>
    new THREE.ConeGeometry(0.03, 1, 6)
      .rotateX(Math.PI)
      .translate(0, -0.5, 0)
      .scale(1, ICICLE_LONG * (0.55 + 0.45 * (((i * 7 + id) % 4) / 3)), 1)
      .translate(box.min.x + width * ((i + 0.5) / ICICLES), box.max.y * 0.98, box.max.z),
  );
  const shape = mergeGeometries(each);
  for (const g of each) g.dispose();
  ice ??= new THREE.MeshBasicMaterial({ color: 0xd6efff, transparent: true, opacity: 0.9, depthWrite: false });
  const m = new THREE.Mesh(owned(shape), ice);
  /** Cues are not there to be clicked: a click goes to the item itself. */
  m.raycast = () => undefined;
  m.renderOrder = 2;
  m.userData.cue = true;
  model.add(m);
  return m;
}

/** Icicles hanging from the top front edge of something frozen, so a freeze reads beside the frost on its parts. */
function animateIcicles(model: THREE.Object3D, c: CueCondition) {
  let hung = partsOf(model).cues?.icicles;
  if (c.stopped !== 'frost') {
    if (hung) hung.visible = false;
    return;
  }
  const cues = cuesOf(model);
  hung = cues.icicles ??= icicles(model, cues.box, c.id);
  hung.visible = true;
}

/**
 * Show every cue an item gives: of its wear, its dirt, its noise and its warmth, an engine running, a rattle from next
 * door, a fire, and a mishap that has stopped it. Something on fire, or burnt and not yet repaired, is charred black,
 * whatever else has stopped it.
 */
export function animateCues(model: THREE.Object3D, c: CueCondition, t: number) {
  const look = WEAR_LOOKS[c.type];
  const { lamp, grime: dirty, exhaust } = partsOf(model);
  const charred = !!c.burnt || !!c.burning;
  if (lamp) {
    const bright = (lamp.userData.bright ??= lamp.emissiveIntensity) as number;
    // an engine's light is full on while it runs, and low while it stands by; out once it has burnt
    const off = c.stopped === 'off' || charred;
    wearLight(lamp, c.wear, c.id, exhaust && c.running <= 0 ? bright * STANDBY_LIGHT : bright, t, off);
  }
  const dress = charred ? 'charred' : c.stopped;
  if (dress || partsOf(model).cues) dressStopped(model, dress);
  if (dirty) {
    grime(dirty, c.dirt);
    // the grime is worked out afresh each frame, so the ice goes on over it
    frost(dirty, !charred && c.stopped === 'frost');
  }
  if (look === 'shudder') animateLean(model, c, t);
  animateChug(model, c, t);
  animateRattle(model, c, look === 'shudder', t);
  animateSmoke(model, c, look, t);
  animateRipples(model, c, t);
  animateWisps(model, c, t);
  animateFumes(model, c, t);
  animateWasps(model, c, t);
  animateIcicles(model, c);
  animateFlames(model, c, t);
}
