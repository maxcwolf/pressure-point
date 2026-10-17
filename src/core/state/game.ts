// Starting a game, and small questions asked of one.

import {
  APPLICANT_DAYS,
  BREAK_AT,
  CALL_GAP_MIN,
  type CenterId,
  CENTERS,
  CHALLENGE_GAP_MIN,
  DIAGNOSIS_TARGET,
  type Discipline,
  DISCIPLINES,
  FIRST_OUTBREAK_DAY,
  FOLLOWING,
  INSPECTION_FIRST_DAY,
  MISHAP_FIRST_DAY,
  MISHAP_GAP_DAYS,
  type Offering,
  OUTBREAK_GAP_MIN,
  POACH_GAP_DAYS,
  RANK_XP,
  RIVAL_OPENS,
  SALE_GAP_DAYS,
  VIP_FIRST_DAY,
  VIP_GAP_DAYS,
} from '../data';
import { refillCandidates } from '../people';
import { newSeed } from '../random';
import type { GameState, Item, Ledger, Policy, Rival, Room, Staff, Stats, Tally, WallSpot } from './types';

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
  patienceTotal: 0,
  waitCount: 0,
  healedBy: {},
  classgoers: 0,
});

/** The counts kept over a whole game, with nothing counted yet. */
export const emptyStats = (): Stats => ({
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
  mushrooms: 0,
  marketing: 0,
  fines: 0,
});

/** The day the first house call may be offered. */
export const FIRST_CALL_DAY = 40;

/** The day the first emergency may be offered, and how long one waits in a game that was already under way. */
export const FIRST_EMERGENCY_DAY = 75;
const EMERGENCY_WAIT = 60;

/** The day the first staff challenge may be set. */
export const FIRST_CHALLENGE_DAY = 30;

/** The policy a new game starts with. */
export const defaultPolicy = (): Policy => ({
  diagnosis: DIAGNOSIS_TARGET,
  emergenciesFirst: false,
  breakAt: BREAK_AT,
  breakLimit: {},
  stashMushrooms: true,
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
 * 21: Qi Gong classes, the Qi Gong Studio and its Instructor. 23: more land. 24: regulars, and the Vision Quest. 25: land kept as the tiles it covers.
 * 26: wind chimes, the fortune teller, the kombucha tap, the staff fridge, soundproof panels and rug patterns.
 * 27: things hung on walls. 28: the rest of them.
 * 29: certificates of excellence. 30: each discipline's following. 31: the game's random numbers, the disciplines
 * practised today, and the surroundings as last checked, so a loaded game goes on just as it would have.
 */
export const SAVE_VERSION = 31;

/** What Singing Bowls cost when they were reiki equipment, given back for any left in a Reiki Studio. */
export const SOLD_BOWLS = 1500;

/**
 * The first of something that comes now and then: on its first day in a new game, or in a game already under way on
 * `day`, a gap from then, but never before its first day.
 */
const firstOn = (day: number, first: number, gap: number) => (day > 0 ? Math.max(first, day + gap) : first);

/**
 * Everything a game in this center starts with but its applicants, on `day` and with its random numbers starting from
 * `seed`. A new game starts on day 0; a save from an earlier version takes whatever it has no word on from here, as of
 * the day it has got to, so what comes now and then comes as it would in a game started then.
 */
export function startingState(center: CenterId, day: number, seed: number): GameState {
  return {
    version: SAVE_VERSION,
    center,
    nextId: 1,
    money: CENTERS[center].startMoney,
    reputation: 30,
    day,
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
    stats: emptyStats(),
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
    nextEmergency: firstOn(day, FIRST_EMERGENCY_DAY, EMERGENCY_WAIT),
    outbreakOffer: null,
    outbreak: null,
    nextOutbreak: firstOn(day, FIRST_OUTBREAK_DAY, OUTBREAK_GAP_MIN),
    policy: defaultPolicy(),
    options: {},
    unlockAll: false,
    reviews: [],
    casebook: {},
    following: { massage: FOLLOWING.established },
    prices: {},
    arrivals: [],
    campaigns: [],
    callOffer: null,
    nextCall: firstOn(day, FIRST_CALL_DAY, CALL_GAP_MIN),
    nextApplicant: day + APPLICANT_DAYS,
    challenge: null,
    nextChallenge: firstOn(day, FIRST_CHALLENGE_DAY, CHALLENGE_GAP_MIN),
    challengesOn: true,
    outbreaksOn: true,
    weatherOn: true,
    visitors: [],
    visitNotice: null,
    visitReport: null,
    nextVip: firstOn(day, VIP_FIRST_DAY, VIP_GAP_DAYS[0]),
    nextInspection: firstOn(day, INSPECTION_FIRST_DAY, INSPECTION_FIRST_DAY),
    visitsOn: true,
    grade: 0,
    rival: newRival(day),
    rivalOn: true,
    mishap: null,
    nextMishap: firstOn(day, MISHAP_FIRST_DAY, MISHAP_GAP_DAYS[0]),
    mishapsOn: true,
    ceremony: null,
    trophies: [],
    achieved: [],
    cheated: false,
    mushrooms: false,
    mushroomsStashed: false,
    land: [],
    regulars: [],
    difficulty: {},
    rng: seed,
    practised: [],
    slowT: 0,
    surroundings: null,
  };
}

/** The state of a brand new game, in the sandbox unless a center is given. */
export function newGame(center: CenterId = 'sandbox'): GameState {
  const s = startingState(center, 0, newSeed());
  refillCandidates(s);
  return s;
}

/** How someone starts out on joining the staff, besides who they are, what they do and where they are. */
export const staffStart = (skill: number) =>
  ({
    thirst: 0,
    hunger: 0,
    training: null,
    strain: 1,
    morale: 75,
    raiseAsked: false,
    unhappyT: 0,
    yearServed: 0,
    // they start at the beginning of the rank their skill makes them
    xp: RANK_XP[skill - 1] ?? 0,
    promotion: false,
    general: [],
    off: [],
    rooms: [],
    offer: 0,
    call: null,
  }) satisfies Partial<Staff>;

/** How an item starts out, new and on the floor. */
export const itemStart = () =>
  ({ wear: 0, dirt: 0, claimedBy: 0, level: 0, upgradePaid: false }) satisfies Partial<Item>;

/** How a room starts out, as a blueprint. */
export const roomStart = () =>
  ({ windows: [], done: false, priority: false, vibes: 0, claimedBy: 0 }) satisfies Partial<Room>;

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
