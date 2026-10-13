// Stars, the objectives for the next one, and what the center has so far.

import { type ItemType, type Role, type RoomType, STAR_GOALS } from '../data';
import { money } from '../format';
import { refillCandidates } from '../people';
import { System } from './system';

export interface Objective {
  label: string;
  done: boolean;
  progress: number;
}

export class Progress extends System {
  /** Open the doors once the center has the bare minimum: a desk, a consultation room and a massage suite. */
  checkOpening() {
    const s = this.s;
    if (s.open || !this.hasItem('reception_desk') || !this.hasRoom('consult') || !this.hasRoom('massage')) return;
    s.open = true;
    s.spawnT = 3;
    this.sim.events.toast('Grand opening! Guests are on their way.', 'good');
    this.sim.events.emit({
      type: 'announce',
      text: 'The healing center is now open. Please form an orderly line of ailments.',
    });
    this.sim.events.emit({ type: 'sfx', name: 'fanfare' });
  }

  checkStars() {
    const s = this.s;
    const goal = STAR_GOALS[s.stars];
    if (!goal) return;
    if (s.stats.healed >= goal.healed && s.reputation >= goal.reputation && s.money >= goal.balance) {
      s.stars++;
      s.money += 5000 * s.stars;
      refillCandidates(s, true);
      this.sim.events.emit({ type: 'star', stars: s.stars });
      this.sim.events.emit({ type: 'sfx', name: 'fanfare' });
    }
  }

  objectives(): Objective[] {
    const s = this.s;
    const goal = STAR_GOALS[s.stars];
    if (!goal) return [];
    const out: Objective[] = [
      {
        label: `Heal ${goal.healed} guests (${Math.min(s.stats.healed, goal.healed)}/${goal.healed})`,
        done: s.stats.healed >= goal.healed,
        progress: s.stats.healed / goal.healed,
      },
      {
        label: `Reach ${goal.reputation}% reputation`,
        done: s.reputation >= goal.reputation,
        progress: s.reputation / goal.reputation,
      },
    ];
    if (goal.balance > 0)
      out.push({
        label: `Have ${money(goal.balance)} in the bank`,
        done: s.money >= goal.balance,
        progress: s.money / goal.balance,
      });
    return out;
  }

  hasItem(t: ItemType) {
    return this.s.items.some((i) => i.type === t && this.world.usable(i));
  }

  hasRoom(t: RoomType) {
    return this.s.rooms.some((r) => r.type === t && r.done);
  }

  hasStaff(r: Role) {
    return this.s.staff.some((x) => x.role === r && x.state !== 'leaving');
  }
}
