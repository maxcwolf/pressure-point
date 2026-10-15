// Starting a game, and small questions asked of one.

import {
  APPLICANT_DAYS,
  BREAK_AT,
  type CenterId,
  CENTERS,
  DIAGNOSIS_TARGET,
  type Discipline,
  DISCIPLINES,
} from '../data';
import { refillCandidates } from '../people';
import type { GameState, Ledger, Policy, Tally, WallSpot } from './types';

/** Whether two wall spots are the same stretch of wall. */
export const sameSpot = (a: WallSpot, b: WallSpot) => a.x === b.x && a.y === b.y && a.dx === b.dx && a.dy === b.dy;

/** A month with nothing counted yet. */
export const emptyTally = (): Tally => ({
  arrived: 0,
  healed: 0,
  failed: 0,
  stormed: 0,
  priced: 0,
  sent: 0,
  waitTotal: 0,
  waitCount: 0,
  healedBy: {},
});

/** A ledger with every entry at zero. */
export const emptyLedger = (): Ledger => ({
  consult: 0,
  treatment: 0,
  vending: 0,
  salaries: 0,
  building: 0,
  training: 0,
  interest: 0,
  bonus: 0,
});

/** The day the first staff challenge may be set. */
export const FIRST_CHALLENGE_DAY = 30;

/** The policy a new game starts with. */
export const defaultPolicy = (): Policy => ({
  diagnosis: DIAGNOSIS_TARGET,
  emergenciesFirst: false,
  breakAt: BREAK_AT,
  breakLimit: {},
});

/**
 * Goes up whenever a save could hold content an older version has never heard of (tests/unit/save-version.test.ts
 * notices), so that older versions refuse the save rather than crash on it. 4: the karma items and Saltmarsh.
 * 5: policy, room priority and sending guests home. 6: staff challenges and the year-end awards. 7: staff careers
 * and the new traits. 8: guests' feelings, reviews and the casebook.
 */
export const SAVE_VERSION = 8;

/** The state of a brand new game, in the sandbox unless a center is given. */
export function newGame(center: CenterId = 'sandbox'): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    center,
    nextId: 1,
    money: CENTERS[center].startMoney,
    reputation: 30,
    day: 0,
    speed: 1,
    open: false,
    rooms: [],
    items: [],
    staff: [],
    guests: [],
    litter: [],
    candidates: [],
    ledger: emptyLedger(),
    lastLedger: emptyLedger(),
    history: [],
    stats: {
      healed: 0,
      failed: 0,
      stormed: 0,
      priced: 0,
      sent: 0,
      arrived: 0,
      healedBy: {},
      emergencies: 0,
      lastQuit: -1,
    },
    tally: emptyTally(),
    months: [],
    stars: 0,
    spawnT: 4,
    announceT: 25,
    seenTips: [],
    loan: 0,
    priceLevel: 1,
    offer: null,
    emergency: null,
    nextEmergency: 75,
    policy: defaultPolicy(),
    options: {},
    unlockAll: false,
    reviews: [],
    casebook: {},
    nextApplicant: APPLICANT_DAYS,
    challenge: null,
    nextChallenge: FIRST_CHALLENGE_DAY,
    challengesOn: true,
    ceremony: null,
    trophies: [],
    achieved: [],
  };
  refillCandidates(s);
  return s;
}

/** The star whose rooms, items and treatments are unlocked so far: every one, in a game with everything unlocked. */
export function unlockedUpTo(s: GameState): number {
  return s.unlockAll ? Infinity : s.stars;
}

/** Whether a discipline exists in this game's center at all. Massage always does. */
export function disciplineHere(s: GameState, d: Discipline): boolean {
  return !DISCIPLINES[d].optional || CENTERS[s.center].disciplines.includes(d);
}

/** Whether a discipline is switched on for this game: on offer in its center, and not switched off. Massage always is. */
export function disciplineOn(s: GameState, d: Discipline): boolean {
  return !DISCIPLINES[d].optional || (disciplineHere(s, d) && s.options[d] !== false);
}
