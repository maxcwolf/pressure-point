// Courses staff can take in a Training Room.

import { DAY_SECONDS, MODALITIES, MODALITY_ORDER, modalityLabel, ROLES } from '../data';
import type { CourseId, Staff } from '../state/types';
import { accessPose, accessTile } from '../world';
import { say, staffById } from './chars';
import { claim, findAccess, release } from './claims';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';
import { goTo } from './movement';
import { hasRoom } from './progress';
import { staffIdle } from './staffing';
import { unlocked } from './treatments';

/** Something a member of staff can study in a Training Room. */
export interface Course {
  id: CourseId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  days: number;
}

/** Courses this member of staff could take right now. */
export function courses(ctx: SimContext, st: Staff): Course[] {
  const out: Course[] = [];
  const discipline = ROLES[st.role].discipline;
  if (discipline) {
    for (const m of MODALITY_ORDER) {
      const def = MODALITIES[m];
      if (def.discipline !== discipline || st.quals.includes(m) || !unlocked(ctx, m)) continue;
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
export function trainBlocker(ctx: SimContext, st: Staff, course: Course): string {
  if (st.state === 'leaving') return 'They are leaving.';
  if (st.training) return 'Already on a course.';
  if (!hasRoom(ctx, 'training')) return 'Build a Training Room first.';
  if (!findAccess(ctx, 'study', st.tx, st.ty)) return 'Every Study Desk is taken. Add another.';
  if (ctx.s.money < course.cost) return 'Not enough money.';
  return '';
}

/** Send a member of staff on a course, paying the fee up front. False if it cannot start. */
export function train(ctx: SimContext, staffId: number, courseId: string): boolean {
  const st = staffById(ctx, staffId);
  const course = st && courses(ctx, st).find((c) => c.id === courseId);
  if (!st || !course || trainBlocker(ctx, st, course)) {
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  const desk = findAccess(ctx, 'study', st.tx, st.ty);
  if (!desk) return false;
  staffIdle(ctx, st);
  claim(ctx, st, desk.item, desk.idx);
  const [x, y] = accessTile(desk.item, desk.idx);
  if (!goTo(ctx, st, x, y, accessPose(desk.item, desk.idx))) {
    release(ctx, st);
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, course.cost, 'training');
  st.training = { course: course.id, progress: 0, seconds: course.days * DAY_SECONDS, cost: course.cost };
  st.state = 'toTrain';
  say(st, '📚', 3);
  emit(ctx, { type: 'sfx', name: 'place' });
  toast(ctx, `${st.name} is off to study ${course.name}.`, 'info');
  return true;
}

/** Finish a course: one more skill level, or a new qualification. */
export function graduate(ctx: SimContext, st: Staff) {
  const t = st.training;
  if (!t) return;
  let what: string;
  if (t.course === 'skill') {
    st.skill = Math.min(5, st.skill + 1);
    what = `reached skill level ${st.skill}`;
  } else {
    const m = t.course;
    if (!st.quals.includes(m)) st.quals.push(m);
    what = `is now qualified in ${modalityLabel(m)}`;
  }
  st.training = null;
  staffIdle(ctx, st);
  say(st, '🎓', 5);
  // being worth more now, they will soon ask to be paid more
  toast(ctx, `${st.name} ${what}.`, 'good');
  emit(ctx, { type: 'sfx', name: 'build' });
}
