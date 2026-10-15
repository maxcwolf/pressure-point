// Shared setup for the simulation tests: seeded games and a standard little center.
import { isGeneral, type ItemType, type Role, type RoomType } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import type { SimEvent } from '../../src/core/sim/events';
import { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import type { Room, Staff } from '../../src/core/state/types';
import type { Rect } from '../../src/core/world';

/**
 * Start a new game with a fixed random seed. Staff challenges are off and no new applicants turn up, since the random
 * numbers they draw would shift the seeded runs the other tests were written against; both have tests of their own.
 */
export function freshSim(seed = 1): Sim {
  setSeed(seed);
  const s = newGame();
  s.challengesOn = false;
  // the rival hires staff away and draws guests off, and mishaps stop things, which only their own tests and the
  // chaos test want
  s.rivalOn = false;
  s.mishapsOn = false;
  s.nextApplicant = 1e9;
  return new Sim(s);
}

type Door = Room['door'];
type Furniture = [type: ItemType, x: number, y: number, rot?: number];

/** Build a finished room with its furniture, the way the build tool does. */
export function buildRoom(sim: Sim, type: RoomType, rect: Rect, door: Door, items: Furniture[]): Room {
  const room = sim.createRoom(type, rect, door);
  for (const [t, x, y, rot] of items) {
    if (!sim.placeItem(t, x, y, rot ?? 0, { free: true, roomId: room.id }))
      throw new Error(`could not place ${t} at ${x},${y}`);
  }
  sim.finishRoom(room);
  return room;
}

export const LAYOUT = {
  consult: { rect: { x: 5, y: 5, w: 4, h: 4 }, door: { x: 8, y: 7, dx: 1, dy: 0 } },
  massage: { rect: { x: 11, y: 5, w: 4, h: 4 }, door: { x: 12, y: 8, dx: 0, dy: 1 } },
  staffroom: { rect: { x: 17, y: 5, w: 3, h: 3 }, door: { x: 18, y: 7, dx: 0, dy: 1 } },
  restroom: { rect: { x: 21, y: 5, w: 3, h: 2 }, door: { x: 23, y: 6, dx: 0, dy: 1 } },
  training: { rect: { x: 5, y: 11, w: 4, h: 4 }, door: { x: 8, y: 12, dx: 1, dy: 0 } },
  assess: { rect: { x: 19, y: 11, w: 4, h: 4 }, door: { x: 19, y: 12, dx: -1, dy: 0 } },
  acupuncture: { rect: { x: 24, y: 8, w: 4, h: 4 }, door: { x: 25, y: 11, dx: 0, dy: 1 } },
  reiki: { rect: { x: 24, y: 13, w: 4, h: 4 }, door: { x: 24, y: 15, dx: -1, dy: 0 } },
  sound: { rect: { x: 10, y: 10, w: 4, h: 4 }, door: { x: 12, y: 13, dx: 0, dy: 1 } },
  recovery: { rect: { x: 15, y: 9, w: 3, h: 3 }, door: { x: 17, y: 10, dx: 1, dy: 0 } },
  // where the Training Room goes, so not alongside one
  qigong: { rect: { x: 5, y: 11, w: 4, h: 4 }, door: { x: 8, y: 12, dx: 1, dy: 0 } },
} as const;

/** Add a furnished Consultation Room at its standard spot. */
export function addConsult(sim: Sim) {
  return buildRoom(sim, 'consult', LAYOUT.consult.rect, LAYOUT.consult.door, [
    ['consult_desk', 6, 6],
    ['cabinet', 5, 8],
  ]);
}
/** Add a furnished Massage Suite at its standard spot. */
export function addMassage(sim: Sim) {
  return buildRoom(sim, 'massage', LAYOUT.massage.rect, LAYOUT.massage.door, [
    ['massage_table', 12, 5],
    ['oil_trolley', 14, 5],
  ]);
}
/** Add a furnished Staff Room at its standard spot. */
export function addStaffRoom(sim: Sim) {
  return buildRoom(sim, 'staffroom', LAYOUT.staffroom.rect, LAYOUT.staffroom.door, [['sofa', 17, 5]]);
}
/** Add a furnished Restroom at its standard spot. */
export function addRestroom(sim: Sim) {
  return buildRoom(sim, 'restroom', LAYOUT.restroom.rect, LAYOUT.restroom.door, [
    ['toilet', 21, 5],
    ['sink', 22, 5],
  ]);
}
/** Add a furnished Training Room at its standard spot. */
export function addTraining(sim: Sim) {
  return buildRoom(sim, 'training', LAYOUT.training.rect, LAYOUT.training.door, [
    ['whiteboard', 6, 11],
    ['study_desk', 6, 13],
  ]);
}
/** Add a furnished Posture Lab at its standard spot. */
export function addPostureLab(sim: Sim) {
  return buildRoom(sim, 'assess', LAYOUT.assess.rect, LAYOUT.assess.door, [['posture_scanner', 20, 12]]);
}

/** Add a furnished Acupuncture Clinic at its standard spot. */
export function addAcupuncture(sim: Sim) {
  return buildRoom(sim, 'acupuncture', LAYOUT.acupuncture.rect, LAYOUT.acupuncture.door, [
    ['acu_table', 25, 8],
    ['needle_cabinet', 27, 8],
  ]);
}

/** Add a furnished Reiki Studio at its standard spot. */
export function addReiki(sim: Sim) {
  return buildRoom(sim, 'reiki', LAYOUT.reiki.rect, LAYOUT.reiki.door, [
    ['reiki_table', 25, 13],
    ['reiki_altar', 27, 13],
  ]);
}

/** Add a furnished Sound Bath Studio at its standard spot: the bowls, and two mats. */
export function addSound(sim: Sim) {
  return buildRoom(sim, 'sound', LAYOUT.sound.rect, LAYOUT.sound.door, [
    ['sound_mat', 10, 10],
    ['sound_mat', 12, 10],
    ['singing_bowls', 11, 13, 2],
  ]);
}

/** Add a Recovery Lounge at its standard spot, with its one Recliner. */
export function addRecovery(sim: Sim) {
  return buildRoom(sim, 'recovery', LAYOUT.recovery.rect, LAYOUT.recovery.door, [['recliner', 15, 9]]);
}

/** Add a Qi Gong Studio where the Training Room goes: the Instructor's Mat at the back, and three Practice Spots. */
export function addQigong(sim: Sim) {
  return buildRoom(sim, 'qigong', LAYOUT.qigong.rect, LAYOUT.qigong.door, [
    ['instructor_mat', 6, 11],
    ['practice_spot', 5, 13],
    ['practice_spot', 6, 13],
    ['practice_spot', 7, 13],
  ]);
}

/** Hire the most skilled applicant for a role. */
export function hire(sim: Sim, role: Role): Staff {
  const best = sim.s.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
  const staff = best && sim.hire(best.id);
  if (!staff) throw new Error(`could not hire a ${role}`);
  return staff;
}

/** Reception, a Consultation Room and a Massage Suite, each staffed. Plenty of money. */
export function openCenter(seed = 1) {
  const sim = freshSim(seed);
  sim.s.money = 100_000;
  sim.placeItem('reception_desk', 14, 13, 0);
  const consult = addConsult(sim);
  const massage = addMassage(sim);
  const receptionist = hire(sim, 'receptionist');
  const consultant = hire(sim, 'consultant');
  const therapist = hire(sim, 'therapist');
  return { sim, s: sim.s, consult, massage, receptionist, consultant, therapist };
}

/** Advance the game by this many seconds of normal-speed play. */
export function run(sim: Sim, seconds: number) {
  sim.s.speed = 1;
  for (let i = 0; i < Math.round(seconds * 10); i++) sim.tick(0.1);
}
/** Advance until a condition holds, or fail after a time limit. */
export function runUntil(sim: Sim, done: () => boolean, maxSeconds = 600) {
  sim.s.speed = 1;
  for (let i = 0; i < maxSeconds * 10; i++) {
    if (done()) return;
    sim.tick(0.1);
  }
  throw new Error(`condition not met within ${maxSeconds}s of game time`);
}

/** The text of every toast among some events. */
export const toasts = (events: SimEvent[]) => events.flatMap((e) => (e.type === 'toast' ? [e.text] : []));

/**
 * Every way the game's bookkeeping can fall out of step with itself, as a list of readable problems:
 * seats held for someone who is not sitting there, guests waiting on a station with nobody to serve
 * them, lines holding people who left, and staff assigned to rooms that are gone. Empty when all is well.
 */
export function inconsistencies(sim: Sim): string[] {
  const s = sim.s;
  const out: string[] = [];
  for (const it of s.items) {
    for (const [idx, id] of it.users.entries()) {
      if (!id) continue;
      const c = sim.char(id);
      if (!c) out.push(`${it.type} #${it.id} seat ${idx} held for #${id}, who has gone`);
      else if (c.claimItem !== it.id || c.claimIdx !== idx)
        out.push(`${it.type} #${it.id} seat ${idx} held for ${c.name}, who holds ${c.claimItem}:${c.claimIdx}`);
    }
    for (const id of it.queue) if (!sim.guest(id)) out.push(`${it.type} #${it.id} line holds #${id}, who has gone`);
    if (it.serving) {
      const g = sim.guest(it.serving);
      if (g?.state === 'served' && !sim.stationStaff(it))
        out.push(`${g.name} is on ${it.type} #${it.id} with nobody serving`);
    }
    if (it.staffId && sim.staff(it.staffId)?.post !== it.id) out.push(`${it.type} #${it.id} staffed by a stranger`);
  }
  for (const r of s.rooms) {
    if (!r.claimedBy) continue;
    const who = sim.staff(r.claimedBy);
    if (who?.job?.kind !== 'smudge' || who.job.id !== r.id)
      out.push(`room #${r.id} is being cleared by #${r.claimedBy}, who is not clearing it`);
  }
  for (const st of s.staff)
    for (const id of st.rooms)
      if (!sim.world.room(id)) out.push(`${st.name} is assigned to room #${id}, which has gone`);
  for (const c of [...s.guests, ...s.staff]) {
    if (!c.claimItem) continue;
    const it = sim.world.item(c.claimItem);
    if (!it) out.push(`${c.name} holds a seat on #${c.claimItem}, which has gone`);
    else if (it.users[c.claimIdx] !== c.id)
      out.push(`${c.name} thinks they hold ${it.type} #${it.id} seat ${c.claimIdx}`);
  }
  return out;
}

/** The treatment courses among some courses, leaving out the general ones every role can take. */
export const treatmentCourses = (courses: readonly { id: string }[]) =>
  courses.map((c) => c.id).filter((id) => !isGeneral(id));
