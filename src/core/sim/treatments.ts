// Which disciplines and modalities are on offer, and whether a table can deliver one properly.

import {
  conditionOf,
  type Discipline,
  DISCIPLINES,
  MODALITIES,
  type Modality,
  type ModalityDef,
  STONE_USE,
} from '../data';
import { refillCandidates } from '../people';
import { disciplineOn } from '../state/game';
import { type Guest, type Item, type Staff } from '../state/types';
import { System } from './system';

/** Why a table cannot deliver a modality properly right now ('' when it can). */
export type DeliveryProblem = '' | 'unqualified' | 'no-equipment' | 'cold';

export class Treatments extends System {
  /** Switched on for this game. */
  enabled(d: Discipline) {
    return disciplineOn(this.s, d);
  }

  /** Switch an optional discipline on or off. What is already built stays, but its guests stop arriving. */
  setDiscipline(d: Discipline, on: boolean) {
    if (!DISCIPLINES[d].optional) return;
    this.s.options[d] = on;
    refillCandidates(this.s);
  }

  /** The center can actually take guests for this discipline: it is on and has a finished room. */
  offered(d: Discipline) {
    return this.enabled(d) && this.sim.progress.hasRoom(DISCIPLINES[d].room);
  }

  /** Whether a modality is available: enough stars, and its discipline switched on. */
  unlocked(m: Modality) {
    return this.s.stars >= MODALITIES[m].star && this.enabled(MODALITIES[m].discipline);
  }

  /** The modality that treats a guest's condition. */
  modalityOf(g: Guest): ModalityDef {
    return MODALITIES[conditionOf(g.condition).modality];
  }

  /** Working equipment for a modality in the suite around a table. */
  private equipmentProblem(table: Item, def: ModalityDef): DeliveryProblem {
    if (!def.equipment) return '';
    const zone = this.world.zoneAt(table.x, table.y);
    const kit = this.s.items.filter((i) => i.type === def.equipment && this.world.zoneAt(i.x, i.y) === zone);
    if (!kit.length) return 'no-equipment';
    if (def.equipment === 'stone_warmer' && kit.every((i) => i.water < STONE_USE)) return 'cold';
    return '';
  }

  /** Can this table, with this therapist, deliver the modality properly? */
  deliveryProblem(table: Item, staff: Staff | undefined, def: ModalityDef): DeliveryProblem {
    const kit = this.equipmentProblem(table, def);
    if (kit) return kit;
    if (staff && !staff.quals.includes(def.id)) return 'unqualified';
    return '';
  }
}
