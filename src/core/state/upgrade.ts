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
  INSPECTION_FIRST_DAY,
  type Land,
  type LandSide,
  MISHAP_FIRST_DAY,
  MISHAP_GAP_DAYS,
  type Modality,
  OUTBREAK_GAP_MIN,
  RANK_XP,
  type Role,
  ROLES,
  VIP_FIRST_DAY,
  VIP_GAP_DAYS,
} from '../data';
import { stripsBought } from '../land';
import { makeCandidate, settleSex } from '../people';
import {
  defaultPolicy,
  emptyTally,
  FIRST_CALL_DAY,
  FIRST_CHALLENGE_DAY,
  newRival,
  SAVE_VERSION,
  SOLD_BOWLS,
} from './game';
import type {
  Candidate,
  CaseRecord,
  GameState,
  Guest,
  Item,
  Ledger,
  MonthRecord,
  Policy,
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

type OldLedger = Before<
  Ledger,
  'training' | 'interest' | 'bonus' | 'shop' | 'calls' | 'marketing' | 'fines' | 'classes' | 'mushrooms'
>;

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
  | 'cheated'
  | 'policy'
  | 'mushrooms'
  | 'mushroomsStashed'
  | 'land'
  | 'regulars'
  | 'difficulty'
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
  | 'visitors'
  | 'visitNotice'
  | 'visitReport'
  | 'nextVip'
  | 'nextInspection'
  | 'visitsOn'
  | 'grade'
  | 'rival'
  | 'rivalOn'
  | 'mishap'
  | 'nextMishap'
  | 'mishapsOn'
  | 'arrivals'
> & {
  stats: Before<
    Stats,
    'priced' | 'sent' | 'worse' | 'healedBy' | 'emergencies' | 'lastQuit' | 'classes' | 'classgoers'
  >;
  tally?: Before<Tally, 'sent' | 'worse' | 'classgoers'>;
  months?: Before<MonthRecord, 'sent' | 'worse' | 'classgoers'>[];
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
    | 'rooms'
    | 'offer'
    | 'call'
    | 'thirst'
    | 'hunger'
  >[];
  candidates: Before<Candidate, 'quals'>[];
  items: Before<Item, 'wear' | 'dirt' | 'level' | 'upgradePaid'>[];
  rooms: Before<Room, 'windows' | 'priority' | 'vibes' | 'claimedBy'>[];
  guests: Before<Guest, 'emergency' | 'placed' | 'feelings' | 'health' | 'stressed' | 'calmed' | 'classDay'>[];
  ledger: OldLedger;
  lastLedger: OldLedger;
};

/** An award's id now, for one saved under a name it has since changed from. */
export const renamedAward = (id: string): AwardId =>
  (id === 'janitor-of-the-year' ? 'caretaker-of-the-year' : id) as AwardId;

/**
 * The sound bath moved out of reiki into a discipline of its own: Reiki Practitioners forget it, a course in it is
 * called off, and Singing Bowls bought for a Reiki Studio are sold back at what they cost, since they now belong
 * only in a Sound Bath Studio.
 */
function movedSoundBath(s: OldSave) {
  for (const st of [...s.staff, ...s.candidates]) {
    if (st.role !== 'practitioner') continue;
    st.quals = (st.quals ?? []).filter((q) => q !== 'sound');
  }
  for (const st of s.staff) if (st.role === 'practitioner' && st.training?.course === 'sound') st.training = null;
  /** The type of room a tile is in, if any. */
  const roomAt = (x: number, y: number) => s.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const stray = s.items.filter((it) => it.type === 'singing_bowls' && roomAt(it.x, it.y)?.type !== 'sound');
  if (!stray.length) return;
  s.items = s.items.filter((it) => !stray.includes(it));
  s.money += stray.length * SOLD_BOWLS;
}

/** Bring a save from any earlier version up to date by filling in what it lacks. */
export function upgradeSave(save: GameState) {
  const s: OldSave = save;
  // first, since the applicants made below are paid as the difficulty sets
  s.difficulty ??= {};
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
    st.rooms ??= [];
    st.offer ??= 0;
    st.call ??= null;
    st.thirst ??= 0;
    st.hunger ??= 0;
  }
  for (const c of s.candidates) c.quals ??= baseQuals(c.role);
  movedSoundBath(s);
  // before women and men were told apart, a look had no sex, and any hair style went with any name; and Amanda
  // Jablonsky's mohawk came later than she did, so in an older save she may have an ordinary haircut
  for (const p of [...s.staff, ...s.candidates, ...s.guests, ...(s.visitors ?? [])]) settleSex(p);
  for (const it of s.items) {
    it.wear ??= 0;
    it.dirt ??= 0;
    it.level ??= 0;
    it.upgradePaid ??= false;
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
    g.classDay ??= 0;
    // a feeling from a newer version means nothing here
    g.feelings = (g.feelings ?? []).filter((f) => Object.hasOwn(FEELINGS, f));
  }
  for (const l of [s.ledger, s.lastLedger, ...(s.months ?? []).map((m) => m.ledger as OldLedger)]) {
    l.training ??= 0;
    l.interest ??= 0;
    l.bonus ??= 0;
    l.shop ??= 0;
    l.calls ??= 0;
    l.marketing ??= 0;
    l.fines ??= 0;
    l.classes ??= 0;
    l.mushrooms ??= 0;
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
  s.stats.classes ??= 0;
  s.stats.classgoers ??= 0;
  // every game from before the campaign was a sandbox game
  s.center ??= 'sandbox';
  s.tally ??= emptyTally();
  s.months ??= [];
  for (const t of [s.tally, ...s.months]) {
    t.sent ??= 0;
    t.worse ??= 0;
    t.classgoers ??= 0;
  }
  s.policy ??= defaultPolicy();
  s.challenge ??= null;
  s.nextChallenge ??= Math.max(FIRST_CHALLENGE_DAY, s.day + CHALLENGE_GAP_MIN);
  s.challengesOn ??= true;
  s.outbreaksOn ??= true;
  s.weatherOn ??= true;
  s.visitors ??= [];
  s.visitNotice ??= null;
  s.visitReport ??= null;
  s.nextVip ??= Math.max(VIP_FIRST_DAY, s.day + VIP_GAP_DAYS[0]);
  s.nextInspection ??= Math.max(INSPECTION_FIRST_DAY, s.day + INSPECTION_FIRST_DAY);
  s.visitsOn ??= true;
  // standing is worked out again from the center as it is, and announced as reached
  s.grade ??= 0;
  s.rival ??= newRival(s.day);
  s.rivalOn ??= true;
  s.mishap ??= null;
  s.nextMishap ??= Math.max(MISHAP_FIRST_DAY, s.day + MISHAP_GAP_DAYS[0]);
  s.mishapsOn ??= true;
  s.nextApplicant ??= s.day + APPLICANT_DAYS;
  s.reviews = (s.reviews ?? []).map((r) => ({ ...r, feelings: r.feelings.filter((f) => Object.hasOwn(FEELINGS, f)) }));
  s.casebook ??= {};
  for (const c of Object.values(s.casebook)) if (c) c.worse ??= 0;
  s.prices ??= {};
  s.arrivals ??= [];
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
  s.cheated ??= false;
  // the Qi Gong Instructor came with version 21: a few apply straight away, as for any role in a new game
  if (s.version < 21)
    while (s.candidates.filter((c) => c.role === 'instructor').length < 3)
      s.candidates.push(makeCandidate(save, 'instructor'));
  s.mushrooms ??= false;
  s.mushroomsStashed ??= false;
  // up to version 24, land was kept as the sides bought, worked out on a lot that has since grown
  const land: readonly unknown[] = s.land ?? [];
  s.land = land.every((l) => typeof l === 'string') ? stripsBought(s.center, land as LandSide[]) : (land as Land[]);
  s.regulars ??= [];
  // a policy saved before the mushrooms has no word on putting them away
  const policy: Partial<Policy> = s.policy;
  policy.stashMushrooms ??= true;
  // and the Shaman with version 22
  if (s.version < 22)
    while (s.candidates.filter((c) => c.role === 'shaman').length < 3) s.candidates.push(makeCandidate(save, 'shaman'));
  s.version = SAVE_VERSION;
}
