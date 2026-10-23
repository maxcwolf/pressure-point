// Bringing saves written by earlier versions up to date.

import {
  ACHIEVEMENTS,
  type AwardId,
  AWARDS,
  DAYS_PER_MONTH,
  type Discipline,
  DISCIPLINES,
  FEELINGS,
  FOLLOWING,
  type Land,
  type Modality,
  RIVAL_START_POINTS,
  type Role,
  ROLES,
} from '../data';
import { type LandSide, stripsBought } from '../land';
import { makeCandidate, settleLook, settleSex } from '../people';
import { newSeed } from '../random';
import {
  defaultPolicy,
  emptyLedger,
  emptyStats,
  emptyTally,
  itemStart,
  roomStart,
  SAVE_VERSION,
  SOLD_BOWLS,
  staffStart,
  startingState,
} from './game';
import type {
  BubbleId,
  Candidate,
  CaseRecord,
  Char,
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

/** The parts of a save that hold records of their own, which may each be missing fields. */
type Records =
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
  | 'casebook';

/** What every save has held since the first version. */
type Always =
  | 'version'
  | 'nextId'
  | 'money'
  | 'reputation'
  | 'day'
  | 'speed'
  | 'open'
  | 'litter'
  | 'history'
  | 'stars'
  | 'spawnT'
  | 'seenTips';

type OldLedger = Partial<Ledger>;

/** A save as an earlier version may have written it: anything that came later than the first may be missing. */
type OldSave = Partial<Omit<GameState, Records>> &
  Pick<GameState, Always> & {
    stats: Before<
      Stats,
      'priced' | 'sent' | 'worse' | 'healedBy' | 'emergencies' | 'lastQuit' | 'classes' | 'classgoers'
    >;
    tally?: Before<Tally, 'sent' | 'worse' | 'classgoers'>;
    months?: (Before<MonthRecord, 'sent' | 'worse' | 'classgoers' | 'ledger'> & { ledger: OldLedger })[];
    casebook?: Partial<Record<string, Before<CaseRecord, 'worse'>>>;
    staff: Before<
      Staff,
      | 'quals'
      | 'training'
      | 'strain'
      | 'morale'
      | 'raiseAsked'
      | 'unhappyT'
      | 'paidTo'
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

/** A record with some fields filled in, each still of whatever type the record already had it as. */
type Filled<T, D> = T & { [K in keyof D & keyof T]-?: Exclude<T[K], undefined> };

/**
 * Fill in whatever a record lacks from one as it starts out now, as `??=` would field by field. Only the top level:
 * anything there already is left as it is.
 */
function fill<T extends object, D extends object>(into: T, from: D): asserts into is Filled<T, D> {
  const record = into as Record<keyof D, unknown>;
  for (const key of Object.keys(from) as (keyof D)[]) record[key] ??= from[key];
}

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
  for (const st of s.staff) {
    if (st.role !== 'practitioner' || st.training?.course !== 'sound') continue;
    // the course is called off, so its fee comes back, as it does for any course cut short
    s.money += st.training.cost;
    st.training = null;
  }
  /** The type of room a tile is in, if any. */
  const roomAt = (x: number, y: number) => s.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const stray = s.items.filter((it) => it.type === 'singing_bowls' && roomAt(it.x, it.y)?.type !== 'sound');
  if (!stray.length) return;
  s.items = s.items.filter((it) => !stray.includes(it));
  s.money += stray.length * SOLD_BOWLS;
}

/** The emoji a speech bubble held before the icons, and the icon each became. */
const BUBBLE_EMOJI: Readonly<Record<string, BubbleId>> = {
  '⚠️': 'bubble-quitting',
  '💢': 'bubble-impatient',
  '🤕': 'bubble-hurt',
  '🚻': 'bubble-restroom',
  '🍵': 'bubble-thirsty',
  '🥤': 'bubble-thirsty',
  '🍪': 'bubble-hungry',
  '🥜': 'bubble-hungry',
  '🕹️': 'bubble-play',
  '💤': 'bubble-break',
  '😴': 'bubble-break',
  '📚': 'bubble-training',
  '🧳': 'bubble-house-call',
  '🎓': 'bubble-graduated',
  '📋': 'bubble-checkin',
  '🧐': 'bubble-looking',
  '😊': 'bubble-happy',
  '😒': 'bubble-unhappy',
  '🤔': 'bubble-unsure',
  '😞': 'bubble-disappointed',
  '😠': 'bubble-angry',
  '😤': 'bubble-annoyed',
  '😰': 'bubble-stressed',
  '😌': 'bubble-relieved',
  '🤢': 'bubble-sick',
  '🤷': 'bubble-shrug',
  '❓': 'bubble-question',
  '💡': 'bubble-idea',
  '💖': 'bubble-cured',
  '🙏': 'bubble-thanks',
  '🍀': 'bubble-lucky',
  '💦': 'bubble-sweaty',
  '🍄': 'bubble-mushroom',
  '💎': 'bubble-shopping',
  '🕯️': 'bubble-shopping',
  '🧴': 'bubble-shopping',
  '🔔': 'bubble-shopping',
  '💸': 'bubble-cant-afford',
  '📦': 'bubble-fired',
  '💰': 'bubble-raise',
  '✨': 'bubble-sparkle',
  '🪶': 'bubble-feather',
  '🌿': 'bubble-smudge',
  '💧': 'bubble-watering',
  '⚙️': 'bubble-installing',
  '🧺': 'bubble-linens',
  '⬆️': 'bubble-promoted',
  '🎉': 'bubble-celebrate',
  '🏠': 'bubble-going-home',
};

/**
 * Up to version 32, and in a 33 with the machines, a speech bubble held an emoji: it becomes the icon that took its place, or goes if none did. The
 * inspector's clipboard looks over the rooms; everyone else's is a guest's at reception.
 */
function iconBubble(c: Pick<Char, 'bubble' | 'bubbleT'>, inspector: boolean) {
  const old: string = c.bubble;
  if (!old || old.startsWith('bubble-')) return;
  const id = old === '📋' && inspector ? 'bubble-inspecting' : BUBBLE_EMOJI[old];
  c.bubble = id ?? '';
  if (!id) c.bubbleT = 0;
}

/**
 * Bring a save from any earlier version up to date by filling in what it lacks: mostly what a game started on the day
 * it has got to would have, and for the records in it, what a new one starts with.
 */
export function upgradeSave(save: GameState) {
  const s: OldSave = save;
  // every game from before the campaign was a sandbox game
  s.center ??= 'sandbox';
  // before followings, a center drew as if each discipline it had a room for were well known, so carry on that way
  s.following ??= Object.fromEntries(
    (Object.keys(DISCIPLINES) as Discipline[])
      .filter((d) => d === 'massage' || s.rooms.some((r) => r.done && r.type === DISCIPLINES[d].room))
      .map((d) => [d, FOLLOWING.established]),
  );
  // whatever else it has no word on is as a game started on its day would have it, and a game saved before it kept its
  // own random numbers starts a stream of its own: first, since the applicants made below draw from that stream, and
  // are paid as the difficulty sets
  fill(s, startingState(s.center, s.day, s.rng ?? newSeed()));
  // up to version 32, wages the bank would not lend for waited a few days to be found: they are put to the player
  // again, to go into the red
  if (s.payrollDue && 'until' in s.payrollDue) s.payrollDue = { wages: s.payrollDue.wages, loan: 0 };
  for (const st of s.staff) {
    // before massage modalities, everyone on the payroll knew Swedish and nothing else
    st.quals ??= baseQuals(st.role);
    // before ranks, skill was all there was: they start at the beginning of the rank it makes them
    fill(st, staffStart(st.skill));
    // before pay was settled by the day, it was paid in whole months: they are owed from the start of this one
    st.paidTo ??= Math.floor(s.day / DAYS_PER_MONTH) * DAYS_PER_MONTH;
  }
  for (const c of s.candidates) c.quals ??= baseQuals(c.role);
  movedSoundBath(s);
  // before women and men were told apart, a look had no sex, and any hair style went with any name; and Amanda
  // Jablonsky's mohawk came later than she did, so in an older save she may have an ordinary haircut
  for (const p of [...s.staff, ...s.candidates, ...s.guests, ...s.visitors]) settleSex(p);
  // nor builds: each is given one from their id, a regular's look kept for their next visit as well
  for (const p of [...s.staff, ...s.candidates, ...s.guests, ...s.visitors, ...s.regulars]) settleLook(p);
  for (const it of s.items) fill(it, itemStart());
  for (const r of s.rooms) fill(r, roomStart());
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
  for (const l of [s.ledger, s.lastLedger, ...s.months.map((m) => m.ledger)]) fill(l, emptyLedger());
  fill(s.stats, emptyStats());
  for (const t of [s.tally, ...s.months]) {
    // patience was kept from version 0.30.0: a month with guests counted before then goes without, not at nothing
    const unkept = t.patienceTotal === undefined && t.waitCount > 0;
    fill(t, emptyTally());
    if (unkept) delete (t as Tally).patienceTotal;
  }
  // before the rival kept its own points, they grew 0.45 a day without limit: it starts from there, and shrinks back
  // to its ceiling as it goes
  const rival: Before<GameState['rival'], 'points' | 'knocked'> = s.rival;
  rival.points ??= rival.opened === null ? 0 : RIVAL_START_POINTS + Math.max(0, s.day - rival.opened) * 0.45;
  rival.knocked ??= 0;
  // a policy saved before the mushrooms has no word on putting them away
  fill(s.policy, defaultPolicy());
  s.reviews = s.reviews.map((r) => ({ ...r, feelings: r.feelings.filter((f) => Object.hasOwn(FEELINGS, f)) }));
  for (const c of Object.values(s.casebook)) if (c) c.worse ??= 0;
  // the Janitor became the Caretaker, and their award with them
  for (const t of [...s.trophies, ...(s.ceremony?.results ?? [])]) t.award = renamedAward(t.award);
  // an award from a newer version means nothing here
  s.trophies = s.trophies.filter((t) => Object.hasOwn(AWARDS, t.award));
  if (s.ceremony) s.ceremony.results = s.ceremony.results.filter((r) => Object.hasOwn(AWARDS, r.award));
  // an achievement from a newer version means nothing here
  s.achieved = s.achieved.filter((id) => Object.hasOwn(ACHIEVEMENTS, id));
  // the Qi Gong Instructor came with version 21: a few apply straight away, as for any role in a new game
  if (s.version < 21)
    while (s.candidates.filter((c) => c.role === 'instructor').length < 3)
      s.candidates.push(makeCandidate(save, 'instructor'));
  // up to version 24, land was kept as the sides bought, worked out on a lot that has since grown
  const land: readonly unknown[] = s.land;
  s.land = land.every((l) => typeof l === 'string') ? stripsBought(s.center, land as LandSide[]) : (land as Land[]);
  // and the Shaman with version 22
  if (s.version < 22)
    while (s.candidates.filter((c) => c.role === 'shaman').length < 3) s.candidates.push(makeCandidate(save, 'shaman'));
  // a 33 saved with the machines still held emoji, and the icons' 33 is left as it is
  if (s.version < 34) {
    for (const c of [...s.staff, ...s.guests]) iconBubble(c, false);
    for (const v of s.visitors) iconBubble(v, v.visit === 'inspector');
  }
  freeScanners(save);
  s.version = SAVE_VERSION;
}

/**
 * A Consultant once worked the Posture Scanner, which now runs itself: whoever was posted at one goes back to finding
 * work, and nobody is kept from scans any more. Nothing in a save from since then is touched.
 */
function freeScanners(s: GameState) {
  const scanners = new Set(s.items.filter((it) => it.type === 'posture_scanner').map((it) => it.id));
  for (const it of s.items) if (scanners.has(it.id)) it.staffId = 0;
  for (const st of s.staff) {
    st.off = st.off.filter((d) => (d as string) !== 'assess');
    if (!scanners.has(st.post)) continue;
    st.post = 0;
    st.busy = false;
    if (st.state === 'toPost' || st.state === 'atPost') {
      st.state = 'idle';
      st.path = null;
      st.dest = null;
    }
  }
}
