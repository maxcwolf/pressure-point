// Starting a game, and small questions asked of one.

import {
  APPLICANT_DAYS,
  BREAK_AT,
  type CenterId,
  CENTERS,
  DIAGNOSIS_TARGET,
  type Discipline,
  DISCIPLINES,
  FIRST_OUTBREAK_DAY,
  INSPECTION_FIRST_DAY,
  MISHAP_FIRST_DAY,
  type Offering,
  POACH_GAP_DAYS,
  RIVAL_OPENS,
  SALE_GAP_DAYS,
  VIP_FIRST_DAY,
} from '../data';
import { refillCandidates } from '../people';
import type { GameState, Ledger, Policy, Rival, Tally, WallSpot } from './types';

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
  worse: 0,
  waitTotal: 0,
  waitCount: 0,
  healedBy: {},
  classgoers: 0,
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
  shop: 0,
  calls: 0,
  classes: 0,
  marketing: 0,
  fines: 0,
});

/** The day the first house call may be offered. */
export const FIRST_CALL_DAY = 40;

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
 * and the new traits. 8: guests' feelings, reviews and the casebook. 9: the Shop Counter, prices per treatment,
 * marketing and house calls. 10: guests' worsening condition, bad vibes, stress outbreaks and the Smudging course.
 * 11: noise, linens, temperature, staff needs, and the radiator, air conditioner and linen hamper. 12: High Pines,
 * its ailments and the Fireplace. 13: VIPs and the health inspector. 18: sound healing, and Distance Reiki in place
 * of the sound bath. 19: equipment upgrades and the Mechanics course. 20: the Recovery Lounge and its Recliner.
 * 21: Qi Gong classes, the Qi Gong Studio and its Instructor.
 */
export const SAVE_VERSION = 21;

/** What Singing Bowls cost when they were reiki equipment, given back for any left in a Reiki Studio. */
export const SOLD_BOWLS = 1500;

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
      worse: 0,
      arrived: 0,
      healedBy: {},
      emergencies: 0,
      lastQuit: -1,
      classes: 0,
      classgoers: 0,
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
    outbreakOffer: null,
    outbreak: null,
    nextOutbreak: FIRST_OUTBREAK_DAY,
    policy: defaultPolicy(),
    options: {},
    unlockAll: false,
    reviews: [],
    casebook: {},
    prices: {},
    arrivals: [],
    campaigns: [],
    callOffer: null,
    nextCall: FIRST_CALL_DAY,
    nextApplicant: APPLICANT_DAYS,
    challenge: null,
    nextChallenge: FIRST_CHALLENGE_DAY,
    challengesOn: true,
    outbreaksOn: true,
    weatherOn: true,
    visitors: [],
    visitNotice: null,
    visitReport: null,
    nextVip: VIP_FIRST_DAY,
    nextInspection: INSPECTION_FIRST_DAY,
    visitsOn: true,
    grade: 0,
    rival: newRival(0),
    rivalOn: true,
    mishap: null,
    nextMishap: MISHAP_FIRST_DAY,
    mishapsOn: true,
    ceremony: null,
    trophies: [],
    achieved: [],
  };
  refillCandidates(s);
  return s;
}

/** The star whose rooms, items and treatments are unlocked so far: every one, in a game with everything unlocked. */
export function unlockedUpTo(s: GameState): number {
  // a center can open with some of what the stars bring already open
  return s.unlockAll ? Infinity : Math.max(s.stars, CENTERS[s.center].unlockedFrom ?? 0);
}

/** Whether something Settings can switch off is on in this game: an optional discipline, or the Qi Gong classes. */
export function offeringOn(s: GameState, o: Offering): boolean {
  return o === 'qigong' ? s.options.qigong !== false : disciplineOn(s, o);
}

/** Whether a discipline exists in this game's center at all. Massage always does. */
export function disciplineHere(s: GameState, d: Discipline): boolean {
  return !DISCIPLINES[d].optional || CENTERS[s.center].disciplines.includes(d);
}

/** Whether a discipline is switched on for this game: on offer in its center, and not switched off. Massage always is. */
export function disciplineOn(s: GameState, d: Discipline): boolean {
  return !DISCIPLINES[d].optional || (disciplineHere(s, d) && s.options[d] !== false);
}

/** The rival across the street, not yet open: it opens on its day, or straight away in a game already past it. */
export function newRival(day: number): Rival {
  const opens = Math.max(RIVAL_OPENS, day);
  return {
    opened: null,
    saleUntil: 0,
    nextSale: opens + SALE_GAP_DAYS[0],
    nextPoach: opens + POACH_GAP_DAYS[0],
    poached: 0,
    trophies: 0,
  };
}
