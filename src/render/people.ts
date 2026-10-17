// People: a clay figure for every guest and member of staff, posed each frame.

import type * as THREE from 'three';

import { conditionOf, ROLES, SIDEWALK_Y } from '../core/data';
import { streetEnds } from '../core/sim/chars';
import type { Sim } from '../core/sim/sim';
import type { Char } from '../core/state/types';
import { Crowd } from './crowd';
import { disposeOwned } from './disposal';
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
      poseChar(rig, c, t, dt, this.workStyle(c));
      rig.group.scale.setScalar(size);
    }
    for (const [id, rig] of this.chars) {
      if (live.has(id)) continue;
      this.scene.remove(rig.group);
      if (rig.smoke) this.scene.remove(rig.smoke);
      disposeOwned(rig.group);
      this.chars.delete(id);
    }
  }

  /** Hand everyone's parts, as posed for this frame, to the batches that draw them. Call once positions are final. */
  gather() {
    this.crowd.gather([...this.chars.values()].map((r) => r.group));
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
