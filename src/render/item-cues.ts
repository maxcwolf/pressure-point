// What an item shows of what it is doing, with no overlay open: smoke, a shudder or a flickering light as it wears out
// and a dead look once it breaks, grime as it gets dirty, ripples while a guest plays something loud, wisps of warm
// or cool air off a heater or an air conditioner, and the mark of a mishap that has stopped it: its lights out in a
// power cut, frost in a freeze, and wasps round it. Each cue is a few small parts added to a model the first time it is
// needed, from shapes every model shares, and hidden the rest of the time, so a cue that is off draws nothing. Like the
// rest of an item's moving parts, each is worked out afresh from the time and the item's state, frame by frame.

import * as THREE from 'three';

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
  recliner: 'shudder',
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
}

/**
 * How bright a cue drawn without light (smoke, ripples, wisps) shows in the dark, against in the light: it dims with
 * everything round it in a power cut, rather than glowing as if lit.
 */
const UNLIT_IN_SHADE = 0.45;

/** The share of its own brightness a cue drawn without light shows, for how far it stands in the dark. */
export const unlitShare = (c: Pick<CueCondition, 'shade'>) => 1 - (c.shade ?? 0) * (1 - UNLIT_IN_SHADE);

/** How a mishap shows on what it has stopped: switched off at the plug, frozen solid, or swarmed by wasps. */
export type StopLook = 'off' | 'frost' | 'wasps';

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
  const dead = c.wear >= 100 && look === 'smoke';
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

/** Each material's look while stopped, made once from it: a shared material's is shared too. */
const stoppedLooks = new WeakMap<THREE.Material, Partial<Record<'off' | 'frost', THREE.Material>>>();

/**
 * A material as it looks on an item a mishap has stopped, or the material itself where it does not change: glazed with
 * ice when frozen; with any glow switched off, and darker, when the power is off.
 */
function stoppedMaterial(m: THREE.Material, look: 'off' | 'frost'): THREE.Material {
  const made = stoppedLooks.get(m)?.[look];
  if (made) return made;
  let out: THREE.Material = m;
  if (look === 'off' && m instanceof THREE.MeshStandardMaterial && m.emissiveIntensity > 0 && m.emissive.getHex()) {
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
  const dressed = look === 'off' || look === 'frost' ? look : undefined;
  const cues = cuesOf(model);
  if (cues.dressed === dressed) return;
  cues.dressed = dressed;
  const keep = animatedMaterials(model);
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.cue) return;
    const own = (o.userData.asBuilt ??= o.material) as THREE.Material | THREE.Material[];
    if (Array.isArray(own) || keep.has(own)) return;
    o.material = dressed ? stoppedMaterial(own, dressed) : own;
  });
}

/** How many wasps buzz round something they have stopped, how far out they fly and how high over its top. */
const WASPS = 7;
const WASP_REACH = 0.5;
const WASP_RISE = 0.35;

/** The shape of a wasp, a little fatter than long so it reads as a body: one for all of them. */
const waspShape = () => cached('cue-wasp', () => new THREE.SphereGeometry(0.06, 8, 6).scale(1.5, 1, 1));

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

/** A swarm of wasps round the top of something they have stopped, black and gold and never still. */
function animateWasps(model: THREE.Object3D, c: CueCondition, t: number) {
  let wasps = partsOf(model).cues?.wasps;
  if (c.stopped !== 'wasps') {
    if (wasps) wasps.visible = false;
    return;
  }
  const cues = cuesOf(model);
  if (!wasps) {
    wasps = cues.wasps = cueGroup(model, waspShape(), WASPS, 0x2a2620);
    wasps.children.forEach((w, i) => {
      const m = fadeOf(w);
      // one in three a gold one, so the swarm reads as wasps and not flies
      if (i % 3 === 1) m.color.setHex(0xf2b705);
      m.opacity = 1;
      m.transparent = false;
      m.depthWrite = true;
    });
  }
  wasps.visible = true;
  const { box } = cues;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  wasps.children.forEach((w, i) => {
    const [x, y, z] = waspAt(t, i, c.id);
    w.position.set(cx + x, box.max.y + WASP_RISE + y, cz + z);
    // facing the way it darts
    w.rotation.y = Math.atan2(-Math.cos(t * 2 + i), Math.sin(t * 2 + i));
  });
}

/** How many icicles hang from the front of something frozen, and how long the longest is. */
const ICICLES = 4;
const ICICLE_LONG = 0.16;

/** An icicle, its root at the top: one shape for all of them. */
const icicleShape = () =>
  cached('cue-icicle', () => new THREE.ConeGeometry(0.03, 1, 6).rotateX(Math.PI).translate(0, -0.5, 0));

/** Icicles hanging from the top front edge of something frozen, so a freeze reads beside the frost on its parts. */
function animateIcicles(model: THREE.Object3D, c: CueCondition) {
  let icicles = partsOf(model).cues?.icicles;
  if (c.stopped !== 'frost') {
    if (icicles) icicles.visible = false;
    return;
  }
  const cues = cuesOf(model);
  if (!icicles) {
    icicles = cues.icicles = cueGroup(model, icicleShape(), ICICLES, 0xd6efff);
    const { box } = cues;
    const width = box.max.x - box.min.x;
    icicles.children.forEach((ice, i) => {
      const m = fadeOf(ice);
      m.opacity = 0.9;
      ice.position.set(box.min.x + width * ((i + 0.5) / ICICLES), box.max.y * 0.98, box.max.z);
      ice.scale.set(1, ICICLE_LONG * (0.55 + 0.45 * (((i * 7 + c.id) % 4) / 3)), 1);
    });
  }
  icicles.visible = true;
}

/**
 * Show every cue an item gives: of its wear, its dirt, its noise and its warmth, an engine running, a rattle from next
 * door, and a mishap that has stopped it.
 */
export function animateCues(model: THREE.Object3D, c: CueCondition, t: number) {
  const look = WEAR_LOOKS[c.type];
  const { lamp, grime: dirty, exhaust } = partsOf(model);
  if (lamp) {
    const bright = (lamp.userData.bright ??= lamp.emissiveIntensity) as number;
    // an engine's light is full on while it runs, and low while it stands by
    wearLight(lamp, c.wear, c.id, exhaust && c.running <= 0 ? bright * STANDBY_LIGHT : bright, t, c.stopped === 'off');
  }
  if (c.stopped || partsOf(model).cues) dressStopped(model, c.stopped);
  if (dirty) {
    grime(dirty, c.dirt);
    // the grime is worked out afresh each frame, so the ice goes on over it
    frost(dirty, c.stopped === 'frost');
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
}
