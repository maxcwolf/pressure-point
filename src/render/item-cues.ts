// What an item shows of what it is doing, with no overlay open: smoke, a shudder or a flickering light as it wears out
// and a dead look once it breaks, grime as it gets dirty, ripples while a guest plays something loud, and wisps of warm
// or cool air off a heater or an air conditioner. Each cue is a few small parts added to a model the first time it is
// needed, from shapes every model shares, and hidden the rest of the time, so a cue that is off draws nothing. Like the
// rest of an item's moving parts, each is worked out afresh from the time and the item's state, frame by frame.

import * as THREE from 'three';

import { DIRT_FILTHY, ITEMS, type ItemType, NOISE_NOTICE, WEAR_WARN } from '../core/data';
import { clamp } from '../core/util';
import { owned } from './disposal';
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
  /** How hard it is warming or cooling the air, from 0 (off) to 1 (flat out). */
  running: number;
  /** Its room is being rattled through the wall by a machine next door, like the Gong of Last Resort as it plays. */
  rattled?: boolean;
}

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
    m.color.setHex(color);
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
  ripple = cues.ripple ??= cueGroup(model, ring(), 2, 0xfff4d6);
  ripple.visible = true;
  const { box } = cues;
  const from = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  ripple.children.forEach((r, i) => {
    const f = burst(t + i * 0.7, 1.4, 1.4, c.id);
    r.position.set((box.min.x + box.max.x) / 2, box.max.y * 0.55, (box.min.z + box.max.z) / 2);
    r.scale.setScalar(from + 0.1 + f * noise * 0.3);
    fadeOf(r).opacity = 0.6 * (1 - f) ** 1.5;
  });
}

/** Wisps of warm air rising off a heater, or cool air drifting out of the front of an air conditioner, while it runs. */
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
  wisps = cues.wisps ??= cueGroup(model, sph(0.1, 8), 3, cool ? 0xa8dcff : 0xffa860);
  wisps.visible = true;
  const { box } = cues;
  const width = box.max.x - box.min.x;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  wisps.children.forEach((w, i) => {
    const f = burst(t + (i * 2.4) / 3, 2.4, 2.4, c.id);
    const x = cx + (i - 1) * width * 0.28 + Math.sin(t * 2 + i * 1.7) * 0.04;
    // warm air climbs over the top; cool air spills out of the front and sinks
    if (cool) w.position.set(x, box.max.y * 0.72 - f * 0.4, box.max.z + 0.05 + f * 0.55);
    else w.position.set(x, box.max.y + 0.05 + f * 0.8, cz);
    w.scale.set(1.1, cool ? 1.1 : 2.8, cool ? 2.6 : 1.1).multiplyScalar(0.8 + f * 0.6);
    fadeOf(w).opacity = Math.sin(f * Math.PI) * (0.3 + 0.3 * c.running);
  });
}

/** The color a light goes when its item breaks: nearly black, whatever it was. */
const DEAD = new THREE.Color(0x2b2e35);

/**
 * A light on a worn item, at the brightness it would otherwise have: it flickers once the item shows its wear, and goes
 * dark when it breaks. It comes back as it was once repaired.
 */
export function wearLight(m: THREE.MeshStandardMaterial, wear: number, id: number, bright: number, t: number) {
  const lit = (m.userData.lit ??= m.color.clone()) as THREE.Color;
  if (wear >= 100) {
    m.color.lerpColors(lit, DEAD, 0.85);
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
  return 0.025 * (0.7 + 0.6 * hash(id)) * Math.sin(f * Math.PI * 12 + id) * (1 - f);
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

/** Show every cue an item gives: of its wear, its dirt, its noise and its warmth, and a rattle from next door. */
export function animateCues(model: THREE.Object3D, c: CueCondition, t: number) {
  const look = WEAR_LOOKS[c.type];
  const { lamp, grime: dirty } = partsOf(model);
  if (lamp) wearLight(lamp, c.wear, c.id, (lamp.userData.bright ??= lamp.emissiveIntensity) as number, t);
  if (dirty) grime(dirty, c.dirt);
  if (look === 'shudder') animateLean(model, c, t);
  animateRattle(model, c, look === 'shudder', t);
  animateSmoke(model, c, look, t);
  animateRipples(model, c, t);
  animateWisps(model, c, t);
}
