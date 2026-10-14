// Bringing saves written by earlier versions up to date.

import { ACHIEVEMENTS, DISCIPLINES, type Modality, type Role, ROLES } from '../data';
import { emptyTally, SAVE_VERSION } from './game';
import type { Candidate, GameState, Guest, Item, Ledger, Room, Staff, Stats } from './types';

/** What everyone in a role is qualified in to begin with: their discipline's basic modality. */
const baseQuals = (role: Role): Modality[] => {
  const d = ROLES[role].discipline;
  return d ? [DISCIPLINES[d].base] : [];
};

/** A record written before some of its fields existed, so those fields may be missing. */
type Before<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type OldLedger = Before<Ledger, 'training' | 'interest' | 'bonus'>;

/** A save as an earlier version may have written it. */
type OldSave = Before<
  Omit<GameState, 'staff' | 'candidates' | 'items' | 'rooms' | 'guests' | 'ledger' | 'lastLedger' | 'stats'>,
  | 'announceT'
  | 'loan'
  | 'priceLevel'
  | 'offer'
  | 'emergency'
  | 'nextEmergency'
  | 'options'
  | 'tally'
  | 'months'
  | 'center'
  | 'unlockAll'
  | 'achieved'
> & {
  stats: Before<Stats, 'priced' | 'healedBy' | 'emergencies' | 'lastQuit'>;
  staff: Before<Staff, 'quals' | 'training' | 'strain' | 'morale' | 'raiseAsked' | 'unhappyT'>[];
  candidates: Before<Candidate, 'quals'>[];
  items: Before<Item, 'wear' | 'dirt'>[];
  rooms: Before<Room, 'windows'>[];
  guests: Before<Guest, 'emergency'>[];
  ledger: OldLedger;
  lastLedger: OldLedger;
};

/** Bring a save from any earlier version up to date by filling in what it lacks. */
export function upgradeSave(save: GameState) {
  const s: OldSave = save;
  for (const st of s.staff) {
    // before massage modalities, everyone on the payroll knew Swedish and nothing else
    st.quals ??= baseQuals(st.role);
    st.training ??= null;
    st.strain ??= 1;
    st.morale ??= 75;
    st.raiseAsked ??= false;
    st.unhappyT ??= 0;
  }
  for (const c of s.candidates) c.quals ??= baseQuals(c.role);
  for (const it of s.items) {
    it.wear ??= 0;
    it.dirt ??= 0;
  }
  for (const r of s.rooms) r.windows ??= [];
  for (const g of s.guests) g.emergency ??= false;
  for (const l of [s.ledger, s.lastLedger]) {
    l.training ??= 0;
    l.interest ??= 0;
    l.bonus ??= 0;
  }
  s.announceT ??= 25;
  s.loan ??= 0;
  s.priceLevel ??= 1;
  s.offer ??= null;
  s.emergency ??= null;
  s.nextEmergency ??= s.day + 60;
  s.options ??= {};
  s.stats.priced ??= 0;
  s.stats.healedBy ??= {};
  s.stats.emergencies ??= 0;
  s.stats.lastQuit ??= -1;
  // every game from before the campaign was a sandbox game
  s.center ??= 'sandbox';
  s.tally ??= emptyTally();
  s.months ??= [];
  s.unlockAll ??= false;
  // an achievement from a newer version means nothing here
  s.achieved = (s.achieved ?? []).filter((id) => Object.hasOwn(ACHIEVEMENTS, id));
  s.version = SAVE_VERSION;
}
