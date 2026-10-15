// People: a clay figure for every guest and member of staff, posed each frame.

import type * as THREE from 'three';

import { conditionOf, type Modality, ROLES } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Char } from '../core/state/types';
import { disposeOwned } from './disposal';
import { buildCharacter, type CharRig } from './models/character';
import { poseChar } from './pose';

export class PeopleLayer {
  private chars = new Map<number, CharRig>();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** The invisible shape around each person that a click lands on. */
  picks(): THREE.Object3D[] {
    return [...this.chars.values()].map((r) => r.pick);
  }

  /** Give everyone a figure, pose them for this frame and remove those who have left. */
  update(t: number, dt: number) {
    const live = new Set<number>();
    for (const c of [...this.sim.s.guests, ...this.sim.s.staff] as Char[]) {
      live.add(c.id);
      let rig = this.chars.get(c.id);
      if (!rig) {
        rig =
          c.kind === 'staff'
            ? buildCharacter(c.look, c.role)
            : buildCharacter(c.look, undefined, conditionOf(c.condition).visual);
        rig.pick.userData.charId = c.id;
        rig.pick.userData.charKind = c.kind;
        this.scene.add(rig.group);
        this.chars.set(c.id, rig);
      }
      // someone away on a house call is not here to be seen, or clicked
      const away = c.kind === 'staff' && c.state === 'away';
      rig.group.visible = !away;
      rig.pick.visible = !away;
      if (!away) poseChar(rig, c, t, dt, this.workStyle(c));
    }
    for (const [id, rig] of this.chars) {
      if (live.has(id)) continue;
      this.scene.remove(rig.group);
      disposeOwned(rig.group);
      this.chars.delete(id);
    }
  }

  /** Which treatment a busy practitioner is giving, so each modality can move differently. */
  private workStyle(c: Char): Modality | null {
    if (c.kind !== 'staff' || !c.busy || !ROLES[c.role].discipline) return null;
    const guest = this.sim.guest(this.sim.world.item(c.post)?.serving ?? 0);
    return guest ? conditionOf(guest.condition).modality : null;
  }
}
