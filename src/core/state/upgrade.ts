// Bringing saves written by earlier versions up to date.

import {
  ACHIEVEMENTS,
  APPLICANT_DAYS,
  AWARDS,
  CHALLENGE_GAP_MIN,
  DISCIPLINES,
  FEELINGS,
  type Modality,
  RANK_XP,
  type Role,
  ROLES,
} from '../data';
import { defaultPolicy, emptyTally, FIRST_CHALLENGE_DAY, SAVE_VERSION } from './game';
import type { Candidate, GameState, Guest, Item, Ledger, MonthRecord, Room, Staff, Stats, Tally } from './types';

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
  Omit<
    GameState,
    'staff' | 'candidates' | 'items' | 'rooms' | 'guests' | 'ledger' | 'lastLedger' | 'stats' | 'tally' | 'months'
  >,
  | 'announceT'
  | 'loan'
  | 'priceLevel'
  | 'offer'
  | 'emergency'
  | 'nextEmergency'
  | 'options'
  | 'center'
  | 'unlockAll'
  | 'achieved'
  | 'policy'
  | 'challenge'
  | 'nextChallenge'
  | 'challengesOn'
  | 'ceremony'
  | 'trophies'
  | 'nextApplicant'
  | 'reviews'
  | 'casebook'
> & {
  stats: Before<Stats, 'priced' | 'sent' | 'healedBy' | 'emergencies' | 'lastQuit'>;
  tally?: Before<Tally, 'sent'>;
  months?: Before<MonthRecord, 'sent'>[];
  staff: Before<
    Staff,
    | 'quals'
    | 'training'
    | 'strain'
    | 'morale'
    | 'raiseAsked'
    | 'unhappyT'
    | 'yearServed'
    | 'xp'
    | 'promotion'
    | 'general'
    | 'off'
  >[];
  candidates: Before<Candidate, 'quals'>[];
  items: Before<Item, 'wear' | 'dirt'>[];
  rooms: Before<Room, 'windows' | 'priority'>[];
  guests: Before<Guest, 'emergency' | 'placed' | 'feelings'>[];
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
    st.yearServed ??= 0;
    // before ranks, skill was all there was: they start at the beginning of the rank it makes them
    st.xp ??= RANK_XP[st.skill - 1] ?? 0;
    st.promotion ??= false;
    st.general ??= [];
    st.off ??= [];
  }
  for (const c of s.candidates) c.quals ??= baseQuals(c.role);
  for (const it of s.items) {
    it.wear ??= 0;
    it.dirt ??= 0;
  }
  for (const r of s.rooms) {
    r.windows ??= [];
    r.priority ??= false;
  }
  for (const g of s.guests) {
    g.emergency ??= false;
    g.placed ??= false;
    // a feeling from a newer version means nothing here
    g.feelings = (g.feelings ?? []).filter((f) => Object.hasOwn(FEELINGS, f));
  }
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
  s.stats.sent ??= 0;
  s.stats.healedBy ??= {};
  s.stats.emergencies ??= 0;
  s.stats.lastQuit ??= -1;
  // every game from before the campaign was a sandbox game
  s.center ??= 'sandbox';
  s.tally ??= emptyTally();
  s.months ??= [];
  for (const t of [s.tally, ...s.months]) t.sent ??= 0;
  s.policy ??= defaultPolicy();
  s.challenge ??= null;
  s.nextChallenge ??= Math.max(FIRST_CHALLENGE_DAY, s.day + CHALLENGE_GAP_MIN);
  s.challengesOn ??= true;
  s.nextApplicant ??= s.day + APPLICANT_DAYS;
  s.reviews = (s.reviews ?? []).map((r) => ({ ...r, feelings: r.feelings.filter((f) => Object.hasOwn(FEELINGS, f)) }));
  s.casebook ??= {};
  s.ceremony ??= null;
  // an award from a newer version means nothing here
  s.trophies = (s.trophies ?? []).filter((t) => Object.hasOwn(AWARDS, t.award));
  if (s.ceremony) s.ceremony.results = s.ceremony.results.filter((r) => Object.hasOwn(AWARDS, r.award));
  s.unlockAll ??= false;
  // an achievement from a newer version means nothing here
  s.achieved = (s.achieved ?? []).filter((id) => Object.hasOwn(ACHIEVEMENTS, id));
  s.version = SAVE_VERSION;
}
