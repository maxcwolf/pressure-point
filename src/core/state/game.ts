// Starting a game, and small questions asked of one.

import { type Discipline, DISCIPLINES, START_MONEY } from '../data';
import { refillCandidates } from '../people';
import type { GameState, Ledger, WallSpot } from './types';

/** Whether two wall spots are the same stretch of wall. */
export const sameSpot = (a: WallSpot, b: WallSpot) => a.x === b.x && a.y === b.y && a.dx === b.dx && a.dy === b.dy;

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

export const SAVE_VERSION = 3;

/** The state of a brand new game. */
export function newGame(): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    nextId: 1,
    money: START_MONEY,
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
    stats: { healed: 0, failed: 0, stormed: 0, arrived: 0 },
    stars: 0,
    spawnT: 4,
    announceT: 25,
    seenTips: [],
    loan: 0,
    priceLevel: 1,
    offer: null,
    emergency: null,
    nextEmergency: 75,
    options: {},
  };
  refillCandidates(s);
  return s;
}

/** Whether a discipline is switched on for this game. Massage always is. */
export function disciplineOn(s: GameState, d: Discipline): boolean {
  return !DISCIPLINES[d].optional || s.options[d] !== false;
}
