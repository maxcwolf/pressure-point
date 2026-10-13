// Stations where staff serve guests: the lines, the service itself and its outcome.

import {
  ASSESS_FEE,
  BOTCH_FACTOR,
  conditionOf,
  CONSULT_FEE,
  DIAGNOSIS_TARGET,
  DISCIPLINES,
  ITEMS,
  MODALITIES,
  modalityLabel,
  ROOMS,
  STONE_USE,
  traitOf,
} from '../data';
import { random, rnd } from '../random';
import { type Guest, type Item, type Staff } from '../state/types';
import { clamp, must } from '../util';
import { accessPose, accessTile } from '../world';
import { System } from './system';

export class Stations extends System {
  /** Lower is better. Guests steer toward tables that can actually deliver what they need. */
  score(it: Item, g: Guest) {
    let score = it.queue.length + (it.serving ? 1 : 0) + (it.staffId ? 0 : 2.5);
    if (ITEMS[it.type].station?.goal === 'treat') {
      const problem = this.sim.treatments.deliveryProblem(
        it,
        this.sim.chars.staff(it.staffId),
        this.sim.treatments.modalityOf(g),
      );
      if (problem === 'unqualified') score += 6;
      else if (problem) score += 40;
    }
    return score;
  }

  /** The best usable station for a guest's current goal, if there is one. */
  pickStation(g: Guest): Item | null {
    const goal = g.goal;
    let best: Item | null = null;
    let bestScore = 1e9;
    for (const it of this.s.items) {
      const st = ITEMS[it.type].station;
      if (st?.goal !== goal || !this.world.usable(it)) continue;
      if (goal === 'treat' && st.discipline !== this.sim.treatments.modalityOf(g).discipline) continue;
      const score = this.score(it, g);
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  /** How long a service takes this member of staff, given their skill, traits, energy and morale. */
  private serviceSeconds(base: number, st: Staff) {
    let speed = 0.85 + st.skill * 0.05;
    for (const t of st.traits) speed *= traitOf(t).speed ?? 1;
    if (st.energy < 15) speed *= 0.6;
    speed *= 0.9 + st.morale / 500;
    return base / speed;
  }

  /** Run every station: tidy its line, call the next guest and move the service along. */
  update(dt: number) {
    for (const it of this.s.items) {
      const def = ITEMS[it.type].station;
      if (!def) continue;
      const staff = this.sim.chars.staff(it.staffId);
      if (it.staffId && staff?.post !== it.id) it.staffId = 0;
      const ready = !!staff && staff.state === 'atPost' && this.world.usable(it);
      let g = this.sim.chars.guest(it.serving);
      if (it.serving && (g?.station !== it.id || (g.state !== 'called' && g.state !== 'served'))) {
        it.serving = 0;
        g = undefined;
      }
      if (it.queue.some((id) => this.sim.chars.guest(id)?.station !== it.id))
        it.queue = it.queue.filter((id) => this.sim.chars.guest(id)?.station === it.id);
      // tired staff finish with their current guest, then stop calling new ones so they can get away
      const wantsBreak = !!staff && staff.energy < 18 && !!this.sim.claims.findAccess('rest', staff.tx, staff.ty);
      if (!it.serving && ready && !wantsBreak) {
        for (const id of it.queue) {
          const q = this.sim.chars.guest(id);
          if (q?.state === 'waiting' || q?.state === 'toWait') {
            this.callGuest(it, q);
            break;
          }
        }
      }
      if (staff && ready) {
        const served = g?.state === 'served' ? g : undefined;
        const mod = served && def.goal === 'treat' ? this.sim.treatments.modalityOf(served) : null;
        staff.busy = !!served;
        staff.strain = mod ? mod.strain : 1;
        if (served) {
          it.progress += dt / this.serviceSeconds(mod ? mod.seconds : def.seconds, staff);
          if (it.progress >= 1) this.completeService(it, served, staff);
        }
      }
    }
  }

  /** Call a guest out of the line to be served. */
  private callGuest(it: Item, g: Guest) {
    it.queue = it.queue.filter((id) => id !== g.id);
    it.serving = g.id;
    it.progress = 0;
    this.sim.claims.release(g);
    const ai = this.sim.claims.accessIndex(it, 'guest');
    const [ax, ay] = accessTile(it, ai);
    g.state = 'called';
    g.timer = 40;
    if (!this.sim.movement.goTo(g, ax, ay, accessPose(it, ai))) {
      it.serving = 0;
      this.sim.guests.leave(g);
    }
  }

  /** Finish a service and apply its outcome: checked in, diagnosed or treated. */
  private completeService(it: Item, g: Guest, staff: Staff) {
    const def = must(ITEMS[it.type].station, 'station');
    it.serving = 0;
    it.progress = 0;
    staff.busy = false;
    staff.served++;
    g.patience = Math.min(100, g.patience + 30);
    this.sim.upkeep.wear(it);
    const room = this.world.roomOfItem(it);
    const nice = room ? (this.sim.ambience.prestige(room) - 1) * 0.02 : 0;
    const price = this.s.priceLevel;
    if (def.goal === 'reception') {
      g.goal = 'consult';
      this.sim.chars.say(g, '📋');
      this.sim.events.emit({ type: 'sfx', name: 'blip' });
    } else if (def.goal === 'consult' || def.goal === 'assess') {
      g.consults++;
      const gain = def.goal === 'consult' ? 0.4 + staff.skill * 0.13 + rnd(0, 0.15) : 0.45 + staff.skill * 0.08;
      g.diagnosis = clamp(g.diagnosis + gain + nice, 0, 1);
      const fee = Math.round((def.goal === 'consult' ? CONSULT_FEE : ASSESS_FEE) * price);
      this.sim.economy.earn(fee, 'consult', g.x, g.y);
      g.spent += fee;
      if (g.diagnosis >= DIAGNOSIS_TARGET || g.consults >= 4) {
        g.goal = 'treat';
        this.sim.chars.say(g, '💡');
        // steep prices put some guests off once they hear what the treatment costs
        if (!g.emergency && random() < Math.max(0, (price - 1) * 0.35)) {
          g.outcome = 'stormed';
          g.goal = 'leave';
          this.s.stats.stormed++;
          this.sim.economy.changeRep(-1);
          this.sim.chars.say(g, '💸', 6);
          this.sim.events.emit({ type: 'float', text: 'Too pricey!', x: g.x, y: g.y, kind: 'bad' });
          this.sim.events.tipOnce(
            'pricey',
            'A guest balked at your prices and left. High prices earn more per guest but drive some away.',
            'bad',
          );
        }
      } else {
        // unsure: a scan settles it if there is a Posture Lab, otherwise it is back to the Consultant
        g.goal = def.goal === 'consult' && this.sim.progress.hasRoom('assess') ? 'assess' : 'consult';
        this.sim.chars.say(g, '❓');
        this.sim.events.tipOnce(
          'rediagnose',
          'Some guests need more than one consultation before the diagnosis is certain. A skilled Consultant helps, and so does a Posture Lab.',
        );
      }
    } else {
      const cond = conditionOf(g.condition);
      const mod = MODALITIES[cond.modality];
      const problem = this.sim.treatments.deliveryProblem(it, staff, mod);
      let chance = clamp(
        0.56 +
          staff.skill * 0.09 +
          Math.min(1, g.diagnosis) * 0.15 +
          nice -
          mod.difficulty -
          (staff.energy < 15 ? 0.15 : 0),
        0.3,
        0.98,
      );
      // the wrong hands or missing equipment: they try anyway, and it rarely works
      if (problem) chance *= BOTCH_FACTOR;
      else if (mod.equipment === 'stone_warmer') {
        const zone = this.world.zoneAt(it.x, it.y);
        const warmer = this.s.items
          .filter((i) => i.type === 'stone_warmer' && this.world.zoneAt(i.x, i.y) === zone && i.water >= STONE_USE)
          .sort((a, b) => b.water - a.water)[0];
        if (warmer) warmer.water -= STONE_USE;
      }
      g.goal = 'leave';
      if (random() < chance) {
        g.outcome = 'healed';
        this.s.stats.healed++;
        const fee = Math.round(cond.fee * price);
        this.sim.economy.earn(fee, 'treatment', g.x, g.y);
        g.spent += fee;
        // good value earns a better name than a steep bill does
        this.sim.economy.changeRep((1.8 + g.patience / 100) * (1.25 - 0.25 * price));
        if (g.emergency && this.s.emergency) this.s.emergency.healed++;
        this.sim.chars.say(g, '💖', 6);
        this.sim.events.emit({ type: 'sfx', name: 'heal' });
      } else {
        g.outcome = 'failed';
        this.s.stats.failed++;
        this.sim.economy.changeRep(-2.5);
        this.sim.chars.say(g, '💢', 6);
        const why = {
          '': 'Still knotted!',
          unqualified: 'Not qualified!',
          'no-equipment': 'No equipment!',
          cold: 'Cold stones!',
        }[problem];
        this.sim.events.emit({ type: 'float', text: why, x: g.x, y: g.y, kind: 'bad' });
        this.sim.events.emit({ type: 'sfx', name: 'fail' });
        if (problem === 'unqualified')
          this.sim.events.tipOnce(
            `botch-qual-${mod.id}`,
            `${staff.name} is not trained in ${modalityLabel(mod.id)} and botched it. Send them on the course in a Training Room.`,
            'bad',
          );
        else if (problem === 'no-equipment')
          this.sim.events.tipOnce(
            `botch-equipment-${mod.id}`,
            `${modalityLabel(mod.id)} needs a ${mod.equipment ? ITEMS[mod.equipment].name : 'piece of equipment'} in the same ${ROOMS[DISCIPLINES[mod.discipline].room].name} as the table.`,
            'bad',
          );
        else if (problem === 'cold')
          this.sim.events.tipOnce(
            'botch-cold',
            'The massage stones were cold. A Janitor keeps Stone Warmers hot.',
            'bad',
          );
        else
          this.sim.events.tipOnce(
            'failed',
            'A treatment failed, and that guest is not paying. Skilled, well-rested Therapists and a confident diagnosis improve the odds.',
            'bad',
          );
      }
    }
    this.sim.guests.decide(g);
  }

  /** Take a guest out of every line and off every station. */
  removeGuest(g: Guest) {
    for (const it of this.s.items) {
      if (it.serving === g.id) it.serving = 0;
      if (it.queue.includes(g.id)) it.queue = it.queue.filter((id) => id !== g.id);
    }
    g.station = 0;
  }
}
