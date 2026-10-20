// Stand-in guests, staff and visitors for the model lab: just enough of a person for the game's posing to work on.

import type { ConditionId, Role } from '../core/data';
import type { Guest, Look, Staff, Visitor, VisitorKind } from '../core/state/types';

/** The look everyone in the lab starts with, so pictures of them stay the same from one run to the next. */
export const LAB_LOOK: Look = {
  skin: 0xeebf9e,
  hair: 0x4a2f1d,
  hairStyle: 1,
  top: 0x2a9d8f,
  bottom: 0x3d405b,
  scale: 1,
  sex: 'female',
  beard: 0,
};

/** What every person has, standing still at the middle of the stage and facing the front. */
const base = (look: Look) => ({
  id: 1,
  name: 'Lab Specimen',
  x: 0,
  y: 0,
  tx: 0,
  ty: 0,
  facing: 0,
  path: null,
  dest: null,
  pose: 'stand' as const,
  h: 0,
  busy: false,
  endPose: 'stand' as const,
  endH: 0,
  endFace: 0,
  look,
  bubble: '',
  bubbleT: 0,
  claimItem: 0,
  claimIdx: 0,
  timer: 0,
});

/** A guest being treated for a condition, in no hurry and wanting nothing. */
export function demoGuest(look: Look, condition: ConditionId): Guest {
  return {
    ...base(look),
    kind: 'guest',
    condition,
    goal: 'treat',
    state: 'served',
    station: 0,
    needKind: '',
    thirst: 0,
    hunger: 0,
    bladder: 0,
    patience: 100,
    diagnosis: 0,
    consults: 0,
    outcome: '',
    spent: 0,
    hasWrapper: false,
    waited: 0,
    emergency: false,
    placed: false,
    feelings: [],
    health: 100,
    stressed: false,
    calmed: false,
    classDay: 0,
  };
}

/** A content, rested member of staff at their post. */
export function demoStaff(look: Look, role: Role): Staff {
  return {
    ...base(look),
    kind: 'staff',
    role,
    skill: 3,
    salary: 0,
    paidTo: 0,
    traits: [],
    energy: 100,
    thirst: 0,
    hunger: 0,
    state: 'atPost',
    post: 0,
    job: null,
    served: 0,
    quals: [],
    training: null,
    strain: 1,
    morale: 100,
    raiseAsked: false,
    unhappyT: 0,
    yearServed: 0,
    xp: 0,
    promotion: false,
    general: [],
    off: [],
    rooms: [],
    offer: 0,
    call: null,
  };
}

/** A visitor, a VIP or the inspector, partway round a room. */
export function demoVisitor(look: Look, visit: VisitorKind): Visitor {
  return {
    ...base(look),
    kind: 'visitor',
    visit,
    title: visit === 'vip' ? 'a lifestyle columnist' : 'the health inspector',
    state: 'looking',
    tour: [],
    seen: [],
  };
}
