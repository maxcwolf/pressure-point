// The advisor: the next thing worth telling the player, and announcements over the speakers.

import {
  conditionOf,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  ITEMS,
  LOAN_MAX,
  MODALITIES,
  MODALITY_ORDER,
  modalityLabel,
  ROLES,
  ROOMS,
  STAR_GOALS,
  STONE_USE,
} from '../data';
import { ANNOUNCEMENTS } from '../data';
import { pick, rnd } from '../random';
import { type Item } from '../state/types';
import { System } from './system';

export class Advisor extends System {
  /** Make an announcement over the speakers every so often. */
  announce(dt: number) {
    const s = this.s;
    s.announceT -= dt;
    if (s.announceT > 0) return;
    s.announceT = rnd(40, 70);
    if (s.open) this.sim.events.emit({ type: 'announce', text: this.contextAnnouncement() ?? pick(ANNOUNCEMENTS) });
  }

  /** The advisor's current nudge. */
  advice(): string {
    const s = this.s;
    if (!this.sim.progress.hasItem('reception_desk'))
      return 'Welcome! Open the Items menu and place a Reception Desk somewhere near the entrance.';
    if (!this.sim.progress.hasStaff('receptionist'))
      return 'A desk needs a face behind it. Hire a Receptionist from the Hire menu.';
    if (!this.sim.progress.hasRoom('consult'))
      return 'Guests need diagnosing. Pick a Consultation Room from the Rooms menu, drag out the floor, add a door, then place the furniture.';
    if (!this.sim.progress.hasStaff('consultant')) return 'Hire a Wellness Consultant to run the Consultation Room.';
    if (!this.sim.progress.hasRoom('massage')) return 'Now the main event: build a Massage Suite.';
    if (!this.sim.progress.hasStaff('therapist'))
      return 'Hire a Massage Therapist and the knots will start untying themselves.';
    const tired = s.staff.some((x) => x.energy < 20);
    if (tired && !this.sim.progress.hasRoom('staffroom'))
      return 'Your staff members are worn out and working slowly. Build a Staff Room so they can take breaks.';
    if (s.guests.some((g) => g.bladder > 85) && !this.sim.progress.hasRoom('restroom'))
      return 'Guests are crossing their legs. A Restroom would be a kindness.';
    if (s.litter.length >= 3 && !this.sim.progress.hasStaff('caretaker'))
      return 'Litter is piling up. Hire a Janitor to keep the place clean.';
    if (s.items.some((i) => i.type === 'plant' && i.water < 20) && !this.sim.progress.hasStaff('caretaker'))
      return 'Your plants are wilting. A Janitor will water them.';
    if (s.offer) return 'There is an emergency on offer at the top of the screen. Accept it only if you can cope.';
    const broken = s.items.find((i) => i.wear >= 100);
    if (broken)
      return this.sim.progress.hasStaff('caretaker')
        ? `A ${ITEMS[broken.type].name} has broken down. Your Janitor will get to it.`
        : `A ${ITEMS[broken.type].name} has broken down. Hire a Janitor to repair it.`;
    const asking = s.staff.find((x) => x.raiseAsked && x.state !== 'leaving');
    if (asking) return `${asking.name} wants a raise. Select them to respond, or they may quit.`;
    if (s.money < 0 && s.loan < LOAN_MAX) return 'You are in the red. A loan from the Money menu would tide you over.';
    const gap = this.modalityAdvice();
    if (gap) return gap;
    for (const it of s.items) {
      const st = ITEMS[it.type].station;
      if (!st || !this.world.usable(it)) continue;
      if (it.queue.length >= 2 && !it.staffId)
        return `Guests are lining up for a ${this.stationPlace(it)} with nobody staffing it. Hire another ${ROLES[st.staff].name}.`;
      if (it.queue.length >= 6)
        return `The line for the ${this.stationPlace(it)} is getting long. Build another and staff it.`;
    }
    if (s.guests.length > 4 && !s.items.some((i) => i.type === 'bench'))
      return 'Standing guests lose patience quickly. Put some Benches in the corridors.';
    if (s.guests.some((g) => g.thirst > 85) && !this.sim.progress.hasItem('tea_station'))
      return 'Guests are parched. A Herbal Tea Station would help, and it earns a little too.';
    if (!STAR_GOALS[s.stars]) return 'Three stars! You have mastered massage. Acupuncture and reiki are coming soon.';
    return 'Looking good. Keep an eye on the objectives to earn your next star.';
  }

  /** Nudge about modalities guests are waiting for that the center cannot deliver. */
  private modalityAdvice(): string {
    const s = this.s;
    for (const m of MODALITY_ORDER) {
      const def = MODALITIES[m];
      if (!this.sim.treatments.unlocked(m)) continue;
      const wanted = s.guests.some((g) => g.goal === 'treat' && conditionOf(g.condition).modality === m);
      if (!wanted) continue;
      const role = ROLES[DISCIPLINES[def.discipline].role];
      const room = ROOMS[DISCIPLINES[def.discipline].room];
      const staff = s.staff.filter((x) => x.role === role.role && x.state !== 'leaving');
      const an = /^[AEIOU]/.test(role.name) ? 'an' : 'a';
      if (!staff.length) return `Guests need ${modalityLabel(m)}. Hire ${an} ${role.name} for your ${room.name}.`;
      const studying = staff.some((x) => x.training?.course === m);
      if (!staff.some((x) => x.quals.includes(m)) && !studying) {
        return this.sim.progress.hasRoom('training')
          ? `Guests need ${modalityLabel(m)} and nobody is qualified. Select ${an} ${role.name} and send them on the course.`
          : `Guests need ${modalityLabel(m)} and nobody is qualified. Build a Training Room, then train ${an} ${role.name}.`;
      }
      if (def.equipment) {
        const eq = ITEMS[def.equipment];
        const have = s.items.filter((i) => i.type === def.equipment && this.world.usable(i));
        if (!have.length)
          return `${modalityLabel(m)} needs a ${eq.name} in the ${room.name}. You'll find it in the Items menu.`;
        if (def.equipment === 'stone_warmer' && have.every((i) => i.water < STONE_USE))
          return this.sim.progress.hasStaff('caretaker')
            ? 'The massage stones have gone cold. Your Janitor is stretched thin.'
            : 'The massage stones have gone cold. Hire a Janitor to keep the Stone Warmer hot.';
      }
    }
    // a newly available discipline nobody has set up yet
    for (const d of DISCIPLINE_ORDER) {
      const def = DISCIPLINES[d];
      const room = ROOMS[def.room];
      if (
        !def.optional ||
        !this.sim.treatments.enabled(d) ||
        s.stars < (room.unlock ?? 0) ||
        this.sim.progress.hasRoom(def.room)
      )
        continue;
      return `${def.name} is now available. Build an ${room.name} and hire an ${ROLES[def.role].name} to bring in a new kind of guest.`;
    }
    return '';
  }

  /** What to call the place a station is in: its room, or the item itself in a corridor. */
  private stationPlace(it: Item): string {
    const where = ITEMS[it.type].where;
    return where === 'corridor' || where === 'any' ? ITEMS[it.type].name : ROOMS[where].name;
  }

  contextAnnouncement(): string | null {
    for (const it of this.s.items) {
      const st = ITEMS[it.type].station;
      if (st && this.world.usable(it) && it.queue.length >= 2 && !it.staffId)
        return `${ROLES[st.staff].name} needed at the ${this.stationPlace(it)}.`;
    }
    if (this.s.litter.length >= 4) return 'Janitor needed. The corridors are getting crunchy.';
    return null;
  }
}
