// Courses staff can take in a Training Room.

import { DAY_SECONDS, GENERAL_COURSES, isGeneral, MODALITIES, modalityLabel, RANK_XP } from '../data';
import { money } from '../format';
import type { CourseId, Staff } from '../state/types';
import { accessPose, accessTile } from '../world';
import { expert, generalToLearn, offerPromotion, roomFor, treatmentsToLearn } from './careers';
import { say, staffById } from './chars';
import { claim, findAccess, release } from './claims';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';
import { goTo } from './movement';
import { hasRoom } from './progress';
import { staffIdle } from './staffing';

/** Something a member of staff can study in a Training Room. */
export interface Course {
  id: CourseId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  days: number;
}

/** The display name of a training course. */
export function courseName(id: CourseId) {
  if (id === 'skill') return 'professional development';
  return isGeneral(id) ? GENERAL_COURSES[id].name : modalityLabel(id);
}

/** Courses this member of staff could take right now. */
export function courses(ctx: SimContext, st: Staff): Course[] {
  const treatments = treatmentsToLearn(ctx, st).map((m): Course => {
    const def = MODALITIES[m];
    return { id: m, name: modalityLabel(m), icon: def.icon, desc: def.desc, cost: def.trainCost, days: def.trainDays };
  });
  const general = generalToLearn(st).map((id): Course => {
    const def = GENERAL_COURSES[id];
    return { id, name: def.name, icon: def.icon, desc: def.desc, cost: def.cost, days: def.days };
  });
  return [...treatments, ...general];
}

/** Why training cannot start ('' when it can). */
export function trainBlocker(ctx: SimContext, st: Staff, course: Course): string {
  if (st.state === 'leaving') return 'They are leaving.';
  // sending them off would leave the call never finished, and never paid for
  if (st.state === 'toCall' || st.state === 'away') return 'They are out on a house call.';
  if (st.training) return 'Already on a course.';
  if (!roomFor(st, course.id))
    return expert(st)
      ? 'Every qualification slot is full. As an Expert, they can still learn any treatment.'
      : 'Every qualification slot is full. A promotion brings another.';
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
  toast(ctx, `${st.name} is off to study ${course.name}.`, 'info', { kind: 'staff', id: st.id });
  return true;
}

/** Why a course cannot be called off ('' when it can). */
export function cancelBlocker(st: Staff): string {
  if (!st.training) return 'Not on a course.';
  if (st.state === 'leaving') return 'They are leaving.';
  return '';
}

/**
 * Call a member of staff off the course they are on, before it is finished: the whole fee comes back, as it does when
 * a course is cut short any other way, their desk is freed and they go back to work with no new qualification. False
 * if they are not on one.
 */
export function cancelTraining(ctx: SimContext, staffId: number): boolean {
  const st = staffById(ctx, staffId);
  const t = st?.training;
  if (!st || !t || cancelBlocker(st)) {
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  // dropping what they were doing hands the fee back, off this month's training costs, and frees the desk
  staffIdle(ctx, st);
  emit(ctx, { type: 'sfx', name: 'cash' });
  toast(ctx, `${st.name} has left the ${courseName(t.course)} course. ${money(t.cost)} refunded.`, 'info', {
    kind: 'staff',
    id: st.id,
  });
  return true;
}

/**
 * Send someone part-way through a course back to a Study Desk to carry on where they left off, as when the room or
 * the desk they were at is moved. If no desk can be reached the course is dropped and its fee comes back.
 */
export function backToStudy(ctx: SimContext, st: Staff) {
  const t = st.training;
  // drop what they were doing without giving the fee back: the course is not over
  st.training = null;
  staffIdle(ctx, st);
  st.training = t;
  if (!t) return;
  const desk = findAccess(ctx, 'study', st.tx, st.ty);
  if (desk) {
    claim(ctx, st, desk.item, desk.idx);
    const [x, y] = accessTile(desk.item, desk.idx);
    if (goTo(ctx, st, x, y, accessPose(desk.item, desk.idx))) {
      st.state = 'toTrain';
      return;
    }
    release(ctx, st);
  }
  staffIdle(ctx, st);
}

/** Finish a course: a new qualification, or (on a course begun before ranks) a rank up. */
export function graduate(ctx: SimContext, st: Staff) {
  const t = st.training;
  if (!t) return;
  let what: string;
  const course = t.course;
  if (course === 'skill') {
    st.skill = Math.min(5, st.skill + 1);
    st.xp = Math.max(st.xp, RANK_XP[st.skill - 1] ?? 0);
    what = `reached rank ${st.skill}`;
  } else if (isGeneral(course)) {
    if (!st.general.includes(course)) st.general.push(course);
    what = `has passed ${GENERAL_COURSES[course].name}`;
  } else {
    if (!st.quals.includes(course)) st.quals.push(course);
    what = `is now qualified in ${modalityLabel(course)}`;
  }
  st.training = null;
  staffIdle(ctx, st);
  say(st, '🎓', 5);
  // being worth more now, they will soon ask to be paid more
  toast(ctx, `${st.name} ${what}.`, 'good', { kind: 'staff', id: st.id });
  emit(ctx, { type: 'sfx', name: 'build' });
  // the experience may already be there, waiting on this course
  offerPromotion(ctx, st);
}
