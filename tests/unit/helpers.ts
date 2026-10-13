// Shared setup for the simulation tests: seeded games and a standard little center.
import { type ItemType, type Role, type RoomType } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { type SimEvent } from '../../src/core/sim/events';
import { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import { type Room, type Staff } from '../../src/core/state/types';
import { type Rect } from '../../src/core/world';

/** Start a new game with a fixed random seed. */
export function freshSim(seed = 1): Sim {
  setSeed(seed);
  return new Sim(newGame());
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
