// The moments in a game worth counting in the play statistics, found by comparing the game with how it last stood.

import { type AchievementId, conditionOf, DAYS_PER_MONTH, FEATURE_ORDER, MODALITIES } from '../core/data';
import { incomeOf, netOf } from '../core/sim/economy';
import { featureOn } from '../core/state/game';
import type {
  Emergency,
  FireReport,
  GameState,
  HouseCall,
  Ledger,
  Outbreak,
  Sketch,
  VisitReport,
  Wave,
} from '../core/state/types';

/** What an event says, as PostHog takes it. */
export type PlayProps = Record<string, string | number | boolean | Partial<Record<string, string | number>>>;

/** One moment to count: its name and what it says. */
export interface PlayEvent {
  name: string;
  props: PlayProps;
}

/** Firsts in a game that show how far a new player has got: an item down, someone hired, a guest in, a guest healed. */
export type Milestone = 'first_item' | 'first_hire' | 'first_guest' | 'first_heal';

/** How a game stood when last looked at: just enough to tell what has happened since. */
export interface PlayMark {
  open: boolean;
  stars: number;
  /** The month the game was in, counting from 0. */
  month: number;
  /** The rooms finished. */
  rooms: ReadonlySet<number>;
  /** The rooms pencilled in, by id. */
  sketches: ReadonlyMap<number, Sketch>;
  achieved: ReadonlySet<AchievementId>;
  milestones: ReadonlySet<Milestone>;
  /** The kinds of item in the center. */
  itemTypes: ReadonlySet<string>;
  /** The staff working there, and those on their way out. */
  staff: ReadonlySet<number>;
  leaving: ReadonlySet<number>;
  /** The game day someone last quit, to tell a quit from a firing. */
  lastQuit: number;
  money: number;
  loan: number;
  /** The gifts made to the Foundation. */
  gifts: number;
  priceLevel: number;
  prices: Readonly<Partial<Record<string, number>>>;
  /** The marketing campaigns running. */
  campaigns: ReadonlySet<string>;
  /** The offers on the table: an emergency, a stress outbreak and a house call. */
  offers: Readonly<Record<OfferKind, Offer | null>>;
  /** The emergency and outbreak under way. */
  emergency: Emergency | null;
  outbreak: Outbreak | null;
  /** The ailment going around, warned of or under way. */
  wave: Wave | null;
  /** The latest visitor's report, and whether it was a failed inspection still to be settled. */
  report: VisitReport | null;
  unsettled: boolean;
  /** The latest fire, burning or out. */
  fire: FireReport | null;
}

/** The offers a game makes, which the player takes on, turns down or lets lapse. */
export type OfferKind = 'emergency' | 'outbreak' | 'house_call';
type Offer = Emergency | Outbreak | HouseCall;

/** What the watcher knows besides the game itself. */
export interface PlayContext {
  /** The offers the player answered, so one that goes without an answer lapsed. */
  answered?: { has: (offer: object) => boolean };
  /** How the month just ended felt, to go with its record. */
  month?: PlayProps;
}

/** How a game stands now. */
export function markOf(s: GameState): PlayMark {
  return {
    open: s.open,
    stars: s.stars,
    month: monthOf(s),
    rooms: new Set(s.rooms.filter((r) => r.done).map((r) => r.id)),
    sketches: new Map(s.sketches.map((sk) => [sk.id, { ...sk }])),
    achieved: new Set(s.achieved),
    milestones: new Set(milestonesOf(s)),
    itemTypes: new Set(s.items.map((i) => i.type)),
    staff: new Set(s.staff.map((x) => x.id)),
    leaving: new Set(s.staff.filter((x) => x.state === 'leaving').map((x) => x.id)),
    lastQuit: s.stats.lastQuit,
    money: s.money,
    loan: s.loan,
    gifts: s.gifts,
    priceLevel: s.priceLevel,
    prices: { ...s.prices },
    campaigns: new Set(s.campaigns.map(campaignKey)),
    offers: offersOf(s),
    emergency: s.emergency,
    outbreak: s.outbreak,
    wave: s.wave,
    report: s.visitReport,
    unsettled: s.visitReport?.bribe !== undefined,
    fire: s.fire ?? null,
  };
}

/**
 * Rooms pencilled in, built or erased since the mark. A sketch gone is built if a room of its kind now stands on any
 * of its floor, as nothing else may be built over it; otherwise it was erased (or picked up to be drawn again).
 */
function sketchEvents(mark: PlayMark, s: GameState, game: PlayProps): PlayEvent[] {
  const out: PlayEvent[] = [];
  const now = new Set(s.sketches.map((sk) => sk.id));
  for (const sk of s.sketches)
    if (!mark.sketches.has(sk.id))
      out.push({ name: 'sketch_drawn', props: { ...game, room: sk.type, sketches: s.sketches.length } });
  for (const [id, sk] of mark.sketches) {
    if (now.has(id)) continue;
    const built = s.rooms.some(
      (r) => r.type === sk.type && r.x < sk.x + sk.w && sk.x < r.x + r.w && r.y < sk.y + sk.h && sk.y < r.y + r.h,
    );
    // one that remembered a room was built whole, from its template
    const template = built && sk.layout ? { template: true } : {};
    out.push({ name: built ? 'sketch_built' : 'sketch_erased', props: { ...game, room: sk.type, ...template } });
  }
  return out;
}

/** The offers on the table. */
const offersOf = (s: GameState): Record<OfferKind, Offer | null> => ({
  emergency: s.offer,
  outbreak: s.outbreakOffer,
  house_call: s.callOffer,
});

/** The milestones a game has reached. */
function milestonesOf(s: GameState): Milestone[] {
  const out: Milestone[] = [];
  if (s.items.length) out.push('first_item');
  if (s.staff.length) out.push('first_hire');
  if (s.stats.arrived) out.push('first_guest');
  if (s.stats.healed) out.push('first_heal');
  return out;
}

/** A marketing campaign, told apart from the others running. */
const campaignKey = (c: GameState['campaigns'][number]) => `${c.kind}:${c.condition ?? ''}:${c.until}`;

/** What every event says about the game it came from. Never the save's name, which is the player's own. */
export function gameProps(s: GameState): PlayProps {
  // the features being tried out that are on in this game, so a chart can split the games that have them
  const features = FEATURE_ORDER.filter((f) => featureOn(s, f)).join(',');
  return { center: s.center, day: Math.floor(s.day), stars: s.stars, cheated: s.cheated, features };
}

/** What has happened in a game since it stood as marked, oldest first. */
export function playEvents(mark: PlayMark, s: GameState, known: PlayContext = {}): PlayEvent[] {
  const game = gameProps(s);
  const out: PlayEvent[] = [];
  if (s.open && !mark.open) out.push({ name: 'doors_opened', props: game });
  const done = s.rooms.filter((r) => r.done);
  for (const r of done)
    if (!mark.rooms.has(r.id)) out.push({ name: 'room_built', props: { ...game, room: r.type, rooms: done.length } });
  // only the month just closed is in the records: the books for any before it in the same look are summed into it
  const last = s.months.at(-1);
  if (monthOf(s) > mark.month && last)
    out.push({ name: 'month_ended', props: { ...game, ...monthProps(s, last), ...known.month } });
  out.push(...sketchEvents(mark, s, game));
  for (let star = mark.stars + 1; star <= s.stars; star++) out.push({ name: 'star_earned', props: { ...game, star } });
  for (const id of s.achieved)
    if (!mark.achieved.has(id)) out.push({ name: 'achievement_earned', props: { ...game, achievement: id } });
  for (const milestone of milestonesOf(s))
    if (!mark.milestones.has(milestone)) out.push({ name: 'milestone_reached', props: { ...game, milestone } });
  out.push(...peopleEvents(mark, s, game), ...moneyEvents(mark, s, game), ...happenings(mark, s, game, known));
  return out;
}

/** Offers left to lapse, and how emergencies, outbreaks and visits turned out. */
function happenings(mark: PlayMark, s: GameState, game: PlayProps, known: PlayContext): PlayEvent[] {
  const out: PlayEvent[] = [];
  const now = offersOf(s);
  for (const [offer, was] of Object.entries(mark.offers) as [OfferKind, Offer | null][]) {
    if (!was || now[offer] === was || known.answered?.has(was)) continue;
    // one gone unanswered before its time was withdrawn: an emergency for a discipline switched off
    const answer = s.day >= was.deadline ? 'lapsed' : 'withdrawn';
    out.push({ name: 'offer_answered', props: { ...game, offer, answer } });
  }
  const e = mark.emergency;
  if (e && s.emergency !== e) {
    const off = s.options[MODALITIES[conditionOf(e.condition).modality].discipline] === false;
    const outcome = e.healed >= e.target ? 'handled' : off ? 'called_off' : 'failed';
    out.push({
      name: 'emergency_ended',
      props: { ...game, outcome, condition: e.condition, healed: e.healed, target: e.target, reward: e.reward },
    });
  }
  const o = mark.outbreak;
  if (o && s.outbreak !== o) {
    const outcome = o.lost <= o.lostMax ? 'contained' : 'escaped';
    out.push({ name: 'outbreak_ended', props: { ...game, outcome, lost: o.lost, lost_max: o.lostMax } });
  }
  // a wave ends at the end of its month, or quietly when its discipline is switched off; switching the feature off
  // sets it aside to come round again, which ends this one here too, as its guests stop coming
  const w = mark.wave;
  if (w && s.wave !== w) {
    const technique = conditionOf(w.condition).modality;
    out.push({
      name: 'wave_ended',
      props: {
        ...game,
        condition: w.condition,
        technique,
        opened_early: w.opened,
        came: w.came,
        healed: w.healed,
        turned: w.turned,
        // a wave guest only comes in once the center is ready for them, so any who came means it was chased
        chased: w.came > 0,
      },
    });
  }
  // a fire's record is replaced as it goes out, so it ends the moment the latest one is out and was not before; one
  // whose flames went with what was sold has nothing that put it out
  const f = s.fire;
  if (f?.out && f !== mark.fire)
    out.push({
      name: 'fire_ended',
      props: { ...game, item: f.item, how: f.how ?? 'sold', burnt: f.burnt, fee: f.fee },
    });
  // a failed inspection is settled by paying it off, or by its fine: the next visit's report settles it first
  const was = mark.report;
  if (was && mark.unsettled && (s.visitReport !== was || was.bribe === undefined))
    out.push({
      name: 'inspection_settled',
      props: { ...game, how: was.outcome === 'paid off' ? 'paid_off' : 'fined', money: was.money },
    });
  const r = s.visitReport;
  if (r && r !== was)
    out.push({
      name: 'visit_ended',
      props: { ...game, visit: r.visit, outcome: r.outcome, score: r.score, money: r.money, rep: r.rep },
    });
  return out;
}

/** Items used for the first time, and staff hired, quitting or let go. */
function peopleEvents(mark: PlayMark, s: GameState, game: PlayProps): PlayEvent[] {
  const out: PlayEvent[] = [];
  const firstTypes = new Set(s.items.map((i) => i.type).filter((t) => !mark.itemTypes.has(t)));
  for (const item of firstTypes) out.push({ name: 'item_first_placed', props: { ...game, item } });
  for (const st of s.staff) {
    if (!mark.staff.has(st.id)) out.push({ name: 'staff_hired', props: { ...game, role: st.role } });
    if (st.state === 'leaving' && !mark.leaving.has(st.id)) {
      // quitting notes the day; a firing does not
      const reason = s.stats.lastQuit !== mark.lastQuit ? 'quit' : 'fired';
      out.push({ name: 'staff_left', props: { ...game, role: st.role, reason } });
    }
  }
  return out;
}

/** Going into the red, borrowing and repaying, prices changed, marketing bought and gifts made to the Foundation. */
function moneyEvents(mark: PlayMark, s: GameState, game: PlayProps): PlayEvent[] {
  const out: PlayEvent[] = [];
  if (s.money < 0 && mark.money >= 0)
    out.push({ name: 'in_the_red', props: { ...game, money: s.money, loan: s.loan } });
  if (s.loan !== mark.loan)
    out.push({
      name: 'loan_changed',
      props: { ...game, loan: s.loan, change: s.loan > mark.loan ? 'borrowed' : 'repaid' },
    });
  if (s.priceLevel !== mark.priceLevel)
    out.push({ name: 'price_changed', props: { ...game, technique: 'all', level: s.priceLevel } });
  for (const [technique, level] of Object.entries(s.prices))
    if (level !== mark.prices[technique]) out.push({ name: 'price_changed', props: { ...game, technique, level } });
  for (const c of s.campaigns) {
    if (mark.campaigns.has(campaignKey(c))) continue;
    const props: PlayProps = { ...game, kind: c.kind, months: Math.round((c.until - s.day) / DAYS_PER_MONTH) };
    if (c.condition) props.condition = c.condition;
    out.push({ name: 'marketing_started', props });
  }
  for (let gift = mark.gifts + 1; gift <= s.gifts; gift++)
    out.push({ name: 'foundation_gift', props: { ...game, gift, money: s.money } });
  return out;
}

/** The month the game is in, counting from 0. */
const monthOf = (s: GameState) => Math.floor(s.day / DAYS_PER_MONTH);

/** How a month went: the guests, the books and how the center stood at the end of it. */
function monthProps(s: GameState, m: GameState['months'][number]): PlayProps {
  const props: PlayProps = {
    month: monthOf(s),
    money: m.money,
    reputation: Math.round(m.reputation),
    net: netOf(m.ledger),
    income: incomeOf(m.ledger),
    loan: s.loan,
    arrived: m.arrived,
    healed: m.healed,
    failed: m.failed,
    stormed: m.stormed,
    priced: m.priced,
    sent: m.sent,
    worse: m.worse,
    healed_by: m.healedBy,
    staff: s.staff.filter((x) => x.state !== 'leaving').length,
    rooms: s.rooms.filter((r) => r.done).length,
    price_level: s.priceLevel,
  };
  // the books line by line, each its own figure so PostHog can sum and chart it
  for (const line of Object.keys(m.ledger) as (keyof Ledger)[]) props[`ledger_${line}`] = m.ledger[line];
  if (m.waitCount) {
    props.wait = Math.round(m.waitTotal / m.waitCount);
    if (m.patienceTotal !== undefined) props.patience = Math.round(m.patienceTotal / m.waitCount);
  }
  return props;
}

/** How a month has felt, from a look once a second while the game runs and the doors are open. */
export interface MonthFeel {
  looks: number;
  /** Looks at which each stage held guests up, by its key. */
  held: Partial<Record<string, number>>;
  /** The advisor's nudges, and how many looks each was seen at. */
  advice: Partial<Record<string, number>>;
  /** Staff morale, energy and the share of them with nothing to do, summed over the looks with anyone working. */
  morale: number;
  energy: number;
  idle: number;
  staffed: number;
}

/** A month not looked at yet. */
export const freshFeel = (): MonthFeel => ({
  looks: 0,
  held: {},
  advice: {},
  morale: 0,
  energy: 0,
  idle: 0,
  staffed: 0,
});

/** Note how the game stands: the stage holding guests up, if any, what the advisor says, and how the staff are. */
export function noteFeel(f: MonthFeel, s: GameState, held: string | undefined, advice: string) {
  f.looks++;
  if (held) f.held[held] = (f.held[held] ?? 0) + 1;
  const nudge = withoutNames(advice, s);
  f.advice[nudge] = (f.advice[nudge] ?? 0) + 1;
  const working = s.staff.filter((x) => x.state !== 'leaving' && x.state !== 'away');
  if (!working.length) return;
  f.staffed++;
  f.morale += working.reduce((sum, x) => sum + x.morale, 0) / working.length;
  f.energy += working.reduce((sum, x) => sum + x.energy, 0) / working.length;
  f.idle += working.filter((x) => x.state === 'idle' || x.state === 'wander').length / working.length;
}

/** How the month felt, for its `month_ended`: nothing if it was never looked at while open. */
export function feelProps(f: MonthFeel): PlayProps {
  if (!f.looks) return {};
  const held = most(f.held);
  const props: PlayProps = {
    bottleneck: held?.[0] ?? 'none',
    bottleneck_share: round2((held?.[1] ?? 0) / f.looks),
    advice: most(f.advice)?.[0] ?? '',
  };
  if (f.staffed) {
    props.morale = Math.round(f.morale / f.staffed);
    props.energy = Math.round(f.energy / f.staffed);
    props.idle_share = round2(f.idle / f.staffed);
  }
  return props;
}

/** The thing counted most often, and how often, if anything was. */
function most(counts: Partial<Record<string, number>>): [string, number] | null {
  let top: [string, number] | null = null;
  for (const [k, n = 0] of Object.entries(counts)) if (!top || n > top[1]) top = [k, n];
  return top;
}

/** A share to two places. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The advisor's nudge with the names of the people in it left out, so the same nudge reads the same for anyone. */
function withoutNames(text: string, s: GameState): string {
  let out = text;
  for (const p of [...s.staff, ...s.guests]) if (p.name) out = out.replaceAll(p.name, '…');
  return out;
}
