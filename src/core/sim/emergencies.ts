// Emergencies: a batch of guests with one condition, healed against the clock for a reward.

import { conditionOf, CONDITIONS, EMERGENCY_CAUSES, MODALITIES } from '../data';
import { money } from '../format';
import { irnd, pick, rnd } from '../random';
import { System } from './system';

export class Emergencies extends System {
  update() {
    const s = this.s;
    if (s.offer && s.day >= s.offer.deadline) this.decline();
    const e = s.emergency;
    if (e) {
      // arrivals trickle in, one a second
      if (e.pending > 0) {
        this.sim.guests.spawn(e.condition, true);
        e.pending--;
      }
      const stillHere = s.guests.some((g) => g.emergency);
      if (e.healed >= e.target || s.day >= e.deadline || (e.pending === 0 && !stillHere)) this.end();
    } else if (!s.offer && s.open && s.stars >= 1 && s.day >= s.nextEmergency) this.offer();
  }

  /** Put an emergency on the table. Only conditions someone on the payroll can treat are offered. */
  offer(): boolean {
    const s = this.s;
    if (s.offer || s.emergency) return false;
    const staff = s.staff.filter((x) => x.state !== 'leaving');
    const pool = CONDITIONS.filter(
      (c) =>
        this.sim.treatments.unlocked(c.modality) &&
        this.sim.treatments.offered(MODALITIES[c.modality].discipline) &&
        staff.some((t) => t.quals.includes(c.modality)),
    );
    if (!pool.length) {
      s.nextEmergency = s.day + 20;
      return false;
    }
    const cond = pick(pool);
    const total = irnd(4, 5 + s.stars * 2);
    s.offer = {
      condition: cond.id,
      cause: pick(EMERGENCY_CAUSES),
      total,
      target: Math.ceil(total * 0.6),
      healed: 0,
      pending: 0,
      reward: Math.round((total * cond.fee * 0.7) / 100) * 100,
      deadline: s.day + 8,
    };
    this.sim.events.emit({ type: 'announce', text: `Emergency incoming! ${s.offer.cause}` });
    return true;
  }

  accept() {
    const s = this.s;
    const e = s.offer;
    if (!e) return;
    s.offer = null;
    e.deadline = s.day + 25;
    e.pending = e.total;
    e.healed = 0;
    s.emergency = e;
    this.sim.events.emit({ type: 'sfx', name: 'place' });
  }

  decline() {
    this.s.offer = null;
    this.s.nextEmergency = this.s.day + rnd(45, 75);
  }

  private end() {
    const s = this.s;
    const e = s.emergency;
    if (!e) return;
    const name = conditionOf(e.condition).name;
    if (e.healed >= e.target) {
      s.money += e.reward;
      s.ledger.bonus += e.reward;
      this.sim.economy.changeRep(4);
      this.sim.events.toast(
        `Emergency handled: ${e.healed} cases of ${name} healed. ${money(e.reward)} bonus.`,
        'good',
      );
      this.sim.events.emit({ type: 'sfx', name: 'fanfare' });
    } else {
      this.sim.economy.changeRep(-4);
      this.sim.events.toast(
        `Emergency failed: only ${e.healed} of the ${e.target} needed cases of ${name} were healed.`,
        'bad',
      );
      this.sim.events.emit({ type: 'sfx', name: 'fail' });
    }
    for (const g of s.guests) g.emergency = false;
    s.emergency = null;
    s.nextEmergency = s.day + rnd(50, 80);
  }
}
