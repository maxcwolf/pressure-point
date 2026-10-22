// People: a clay figure for every guest and member of staff, posed each frame.

import type * as THREE from 'three';

import { conditionOf, ROLES, SIDEWALK_Y } from '../core/data';
import { streetEnds } from '../core/sim/chars';
import type { Sim } from '../core/sim/sim';
import type { Char, Guest } from '../core/state/types';
import { Crowd, type Viewpoint } from './crowd';
import { disposeOwned } from './disposal';
import { applyGuestGag } from './gags/apply';
import { gagFrame } from './gags/beats';
import { GagClock } from './gags/clock';
import { GAGS } from './gags/scripts';
import { buildCharacter, type CharRig } from './models/character';
import { poseChar, type WorkStyle } from './pose';

/** Over how many tiles of pavement people grow from nothing, or shrink away, where they arrive and leave. */
const FADE_TILES = 1;

/**
 * How big someone is drawn, from 0 to 1: on the pavement, they grow from nothing over the first tile from where people
 * arrive, and shrink away over the last tile to where they leave, rather than popping in and out of sight there.
 */
export function streetFade(x: number, y: number, ends: readonly number[]): number {
  if (Math.floor(y) !== SIDEWALK_Y) return 1;
  const d = Math.min(...ends.map((e) => Math.abs(x - (e + 0.5))));
  return Math.min(1, d / FADE_TILES);
}

export class PeopleLayer {
  private chars = new Map<number, CharRig>();
  private crowd: Crowd;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
    private gags: GagClock = new GagClock(),
  ) {
    this.crowd = new Crowd(scene);
  }

  /** The invisible shape around each person that a click lands on. */
  picks(): THREE.Object3D[] {
    return [...this.chars.values()].map((r) => r.pick);
  }

  /** Give everyone a figure, pose them for this frame and remove those who have left. */
  update(t: number, dt: number) {
    const live = new Set<number>();
    const ends = streetEnds(this.sim.world.building, this.sim.world.w);
    // the front door, between its two tiles in the front wall, that a guest who is fed up with waiting turns toward
    const {
      door: [left, right],
      front,
    } = this.sim.world.building;
    const door = { x: (left + right + 1) / 2, y: front + 1 };
    // anyone on a really bad trip, whom everyone near turns to look at: hardly ever anyone
    const around = { runners: this.sim.s.guests.filter((g) => g.state === 'running') };
    // the rooms the Gong of Last Resort rattles through the wall this moment, whose people flinch: hardly ever any
    const rattled = this.sim.rattledRooms();
    for (const c of [...this.sim.s.guests, ...this.sim.s.staff, ...this.sim.s.visitors] as Char[]) {
      live.add(c.id);
      let rig = this.chars.get(c.id);
      if (!rig) {
        rig =
          c.kind === 'staff'
            ? buildCharacter(c.look, c.role)
            : c.kind === 'visitor'
              ? buildCharacter(c.look, undefined, undefined, c.visit)
              : // a class-goer is here for a class, and shows no symptoms
                buildCharacter(c.look, undefined, c.classDay ? undefined : conditionOf(c.condition).visual);
        rig.pick.userData.charId = c.id;
        rig.pick.userData.charKind = c.kind;
        this.scene.add(rig.group);
        // the smoke from a bundle of sage hangs in the room, not on whoever is carrying it
        if (rig.smoke) this.scene.add(rig.smoke);
        this.chars.set(c.id, rig);
      }
      // someone away on a house call is not here to be seen, or clicked
      const away = c.kind === 'staff' && c.state === 'away';
      const size = streetFade(c.x, c.y, ends);
      const shown = !away && size > 0.02;
      rig.group.visible = shown;
      rig.pick.visible = shown;
      if (!shown && rig.smoke) rig.smoke.visible = false;
      if (!shown) continue;
      const mopping = this.mopping(c);
      const shook = rattled.size > 0 && rattled.has(this.sim.world.zoneAt(c.tx, c.ty));
      poseChar(
        rig,
        c,
        t,
        dt,
        this.workStyle(c),
        door,
        mopping || shook ? { ...around, mopping, rattled: shook } : around,
      );
      rig.group.scale.setScalar(size);
      if (c.kind === 'guest') this.inMachine(rig, c, t);
    }
    for (const [id, rig] of this.chars) {
      if (live.has(id)) continue;
      this.scene.remove(rig.group);
      if (rig.smoke) this.scene.remove(rig.smoke);
      disposeOwned(rig.group);
      this.chars.delete(id);
    }
  }

  /** Whether a Caretaker is cleaning up flood water, which they mop rather than pick up. */
  private mopping(c: Char): boolean {
    if (c.kind !== 'staff' || c.role !== 'caretaker' || c.job?.kind !== 'litter') return false;
    const id = c.job.id;
    return !!this.sim.s.litter.find((l) => l.id === id)?.flood;
  }

  /**
   * A guest inside a machine moves with its gag: carried round, squashed, hidden inside it, and so on. So does a bored
   * guest having a ride on one.
   */
  private inMachine(rig: CharRig, g: Guest, t: number) {
    const id =
      g.state === 'served' || g.state === 'called'
        ? g.station
        : g.state === 'need' && g.needKind === 'play'
          ? g.claimItem
          : 0;
    const it = id ? this.sim.world.item(id) : undefined;
    const script = it && GAGS[it.type];
    if (!it || !script) {
      applyGuestGag(rig, {}, 0);
      return;
    }
    const input = this.gags.input(this.sim, it, t);
    applyGuestGag(rig, input ? gagFrame(script, input).guest : {}, it.rot);
  }

  /**
   * Hand everyone's parts, as posed for this frame, to the batches that draw them, as seen from a viewpoint. Call once
   * positions are final.
   */
  gather(view: Viewpoint) {
    this.crowd.gather(
      [...this.chars.values()].map((r) => r.group),
      view,
    );
  }

  /**
   * Which treatment a busy practitioner is giving, so each modality can move differently, or Qi Gong, for an
   * Instructor leading a class and the class-goers following.
   */
  private workStyle(c: Char): WorkStyle {
    if (c.kind === 'guest') {
      const spot = c.classDay && c.state === 'served' ? this.sim.world.item(c.station) : undefined;
      return spot && this.sim.classPlaying(spot) ? 'qigong' : null;
    }
    if (c.kind === 'staff' && c.busy && c.role === 'instructor') return 'qigong';
    if (c.kind !== 'staff' || !c.busy || !ROLES[c.role].discipline) return null;
    const post = this.sim.world.item(c.post);
    const guest = post && this.sim.servedAt(post);
    return guest ? conditionOf(guest.condition).modality : null;
  }
}
