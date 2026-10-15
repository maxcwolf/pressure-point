// Bringing saves written by earlier versions up to date.

import {
  ACHIEVEMENTS,
  APPLICANT_DAYS,
  type AwardId,
  AWARDS,
  CALL_GAP_MIN,
  CHALLENGE_GAP_MIN,
  DISCIPLINES,
  FEELINGS,
  FIRST_OUTBREAK_DAY,
  type Modality,
  OUTBREAK_GAP_MIN,
  RANK_XP,
  type Role,
  ROLES,
} from '../data';
import { defaultPolicy, emptyTally, FIRST_CALL_DAY, FIRST_CHALLENGE_DAY, SAVE_VERSION } from './game';
import type {
  Candidate,
  CaseRecord,
  GameState,
  Guest,
  Item,
  Ledger,
  MonthRecord,
  Room,
  Staff,
  Stats,
  Tally,
} from './types';

/** What everyone in a role is qualified in to begin with: their discipline's basic modality. */
const baseQuals = (role: Role): Modality[] => {
  const d = ROLES[role].discipline;
  return d ? [DISCIPLINES[d].base] : [];
};

/** A record written before some of its fields existed, so those fields may be missing. */
type Before<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type OldLedger = Before<Ledger, 'training' | 'interest' | 'bonus' | 'shop' | 'calls' | 'marketing'>;

/** A save as an earlier version may have written it. */
type OldSave = Before<
  Omit<
    GameState,
    | 'staff'
    | 'candidates'
    | 'items'
    | 'rooms'
    | 'guests'
    | 'ledger'
    | 'lastLedger'
    | 'stats'
    | 'tally'
    | 'months'
    | 'casebook'
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
  | 'prices'
  | 'campaigns'
  | 'callOffer'
  | 'nextCall'
  | 'outbreakOffer'
  | 'outbreak'
  | 'nextOutbreak'
  | 'outbreaksOn'
  | 'weatherOn'
> & {
  stats: Before<Stats, 'priced' | 'sent' | 'worse' | 'healedBy' | 'emergencies' | 'lastQuit'>;
  tally?: Before<Tally, 'sent' | 'worse'>;
  months?: Before<MonthRecord, 'sent' | 'worse'>[];
  casebook?: Partial<Record<string, Before<CaseRecord, 'worse'>>>;
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
    | 'call'
    | 'thirst'
    | 'hunger'
  >[];
  candidates: Before<Candidate, 'quals'>[];
  items: Before<Item, 'wear' | 'dirt'>[];
  rooms: Before<Room, 'windows' | 'priority' | 'vibes' | 'claimedBy'>[];
  guests: Before<Guest, 'emergency' | 'placed' | 'feelings' | 'health' | 'stressed' | 'calmed'>[];
  ledger: OldLedger;
  lastLedger: OldLedger;
};

/** An award's id now, for one saved under a name it has since changed from. */
export const renamedAward = (id: string): AwardId =>
  (id === 'janitor-of-the-year' ? 'caretaker-of-the-year' : id) as AwardId;

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
    st.call ??= null;
    st.thirst ??= 0;
    st.hunger ??= 0;
  }
  for (const c of s.candidates) c.quals ??= baseQuals(c.role);
  for (const it of s.items) {
    it.wear ??= 0;
    it.dirt ??= 0;
  }
  for (const r of s.rooms) {
    r.windows ??= [];
    r.priority ??= false;
    r.vibes ??= 0;
    r.claimedBy ??= 0;
  }
  for (const g of s.guests) {
    g.emergency ??= false;
    g.placed ??= false;
    g.health ??= 100;
    g.stressed ??= false;
    g.calmed ??= false;
    // a feeling from a newer version means nothing here
    g.feelings = (g.feelings ?? []).filter((f) => Object.hasOwn(FEELINGS, f));
  }
  for (const l of [s.ledger, s.lastLedger]) {
    l.training ??= 0;
    l.interest ??= 0;
    l.bonus ??= 0;
    l.shop ??= 0;
    l.calls ??= 0;
    l.marketing ??= 0;
  }
  s.announceT ??= 25;
  s.loan ??= 0;
  s.priceLevel ??= 1;
  s.offer ??= null;
  s.emergency ??= null;
  s.nextEmergency ??= s.day + 60;
  s.outbreakOffer ??= null;
  s.outbreak ??= null;
  s.nextOutbreak ??= Math.max(FIRST_OUTBREAK_DAY, s.day + OUTBREAK_GAP_MIN);
  s.options ??= {};
  s.stats.priced ??= 0;
  s.stats.sent ??= 0;
  s.stats.worse ??= 0;
  s.stats.healedBy ??= {};
  s.stats.emergencies ??= 0;
  s.stats.lastQuit ??= -1;
  // every game from before the campaign was a sandbox game
  s.center ??= 'sandbox';
  s.tally ??= emptyTally();
  s.months ??= [];
  for (const t of [s.tally, ...s.months]) {
    t.sent ??= 0;
    t.worse ??= 0;
  }
  s.policy ??= defaultPolicy();
  s.challenge ??= null;
  s.nextChallenge ??= Math.max(FIRST_CHALLENGE_DAY, s.day + CHALLENGE_GAP_MIN);
  s.challengesOn ??= true;
  s.outbreaksOn ??= true;
  s.weatherOn ??= true;
  s.nextApplicant ??= s.day + APPLICANT_DAYS;
  s.reviews = (s.reviews ?? []).map((r) => ({ ...r, feelings: r.feelings.filter((f) => Object.hasOwn(FEELINGS, f)) }));
  s.casebook ??= {};
  for (const c of Object.values(s.casebook)) if (c) c.worse ??= 0;
  s.prices ??= {};
  s.campaigns ??= [];
  s.callOffer ??= null;
  s.nextCall ??= Math.max(FIRST_CALL_DAY, s.day + CALL_GAP_MIN);
  s.ceremony ??= null;
  // the Janitor became the Caretaker, and their award with them
  for (const t of [...(s.trophies ?? []), ...(s.ceremony?.results ?? [])]) t.award = renamedAward(t.award);
  // an award from a newer version means nothing here
  s.trophies = (s.trophies ?? []).filter((t) => Object.hasOwn(AWARDS, t.award));
  if (s.ceremony) s.ceremony.results = s.ceremony.results.filter((r) => Object.hasOwn(AWARDS, r.award));
  s.unlockAll ??= false;
  // an achievement from a newer version means nothing here
  s.achieved = (s.achieved ?? []).filter((id) => Object.hasOwn(ACHIEVEMENTS, id));
  s.version = SAVE_VERSION;
}
