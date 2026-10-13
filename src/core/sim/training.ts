// Courses staff can take in a Training Room.

import { DAY_SECONDS, MODALITIES, type Modality, MODALITY_ORDER, modalityLabel, ROLES } from '../data';
import { type Staff } from '../state/types';
import { accessPose, accessTile } from '../world';
import { System } from './system';

/** Something a member of staff can study in a Training Room. */
export interface Course {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  days: number;
}

export class Training extends System {
  /** Courses this member of staff could take right now. */
  courses(st: Staff): Course[] {
    const out: Course[] = [];
    const discipline = ROLES[st.role].discipline;
    if (discipline) {
      for (const m of MODALITY_ORDER) {
        const def = MODALITIES[m];
        if (def.discipline !== discipline || st.quals.includes(m) || !this.sim.treatments.unlocked(m)) continue;
        out.push({
          id: m,
          name: modalityLabel(m),
          icon: def.icon,
          desc: def.desc,
          cost: def.trainCost,
          days: def.trainDays,
        });
      }
    }
    if (st.skill < 5)
      out.push({
        id: 'skill',
        name: `Skill level ${st.skill + 1}`,
        icon: '⭐',
        desc: 'General professional development. Faster and more reliable at everything.',
        cost: 600 + st.skill * 700,
        days: 5 + st.skill * 2,
      });
    return out;
  }

  /** Why training cannot start ('' when it can). */
  blocker(st: Staff, course: Course): string {
    if (st.state === 'leaving') return 'They are leaving.';
    if (st.training) return 'Already on a course.';
    if (!this.sim.progress.hasRoom('training')) return 'Build a Training Room first.';
    if (!this.sim.claims.findAccess('study', st.tx, st.ty)) return 'Every Study Desk is taken. Add another.';
    if (this.s.money < course.cost) return 'Not enough money.';
    return '';
  }

  train(staffId: number, courseId: string): boolean {
    const st = this.sim.chars.staff(staffId);
    const course = st && this.courses(st).find((c) => c.id === courseId);
    if (!st || !course || this.blocker(st, course)) {
      this.sim.events.emit({ type: 'sfx', name: 'error' });
      return false;
    }
    const desk = this.sim.claims.findAccess('study', st.tx, st.ty);
    if (!desk) return false;
    this.sim.staffing.idle(st);
    this.sim.claims.claim(st, desk.item, desk.idx);
    const [x, y] = accessTile(desk.item, desk.idx);
    if (!this.sim.movement.goTo(st, x, y, accessPose(desk.item, desk.idx))) {
      this.sim.claims.release(st);
      this.sim.events.emit({ type: 'sfx', name: 'error' });
      return false;
    }
    this.sim.economy.spend(course.cost, 'training');
    st.training = { course: course.id, progress: 0, seconds: course.days * DAY_SECONDS, cost: course.cost };
    st.state = 'toTrain';
    this.sim.chars.say(st, '📚', 3);
    this.sim.events.emit({ type: 'sfx', name: 'place' });
    this.sim.events.toast(`${st.name} is off to study ${course.name}.`, 'info');
    return true;
  }

  graduate(st: Staff) {
    const t = st.training;
    if (!t) return;
    let what: string;
    if (t.course === 'skill') {
      st.skill = Math.min(5, st.skill + 1);
      what = `reached skill level ${st.skill}`;
    } else {
      const m = t.course as Modality;
      if (!st.quals.includes(m)) st.quals.push(m);
      what = `is now qualified in ${modalityLabel(m)}`;
    }
    st.training = null;
    this.sim.staffing.idle(st);
    this.sim.chars.say(st, '🎓', 5);
    // being worth more now, they will soon ask to be paid more
    this.sim.events.toast(`${st.name} ${what}.`, 'good');
    this.sim.events.emit({ type: 'sfx', name: 'build' });
  }
}
