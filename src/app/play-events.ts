// The moments in a game worth counting in the play statistics, found by comparing the game with how it last stood.

import { type AchievementId, DAYS_PER_MONTH } from '../core/data';
import { netOf } from '../core/sim/economy';
import type { GameState } from '../core/state/types';

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
  priceLevel: number;
  prices: Readonly<Partial<Record<string, number>>>;
  /** The marketing campaigns running. */
  campaigns: ReadonlySet<string>;
}

/** How a game stands now. */
export function markOf(s: GameState): PlayMark {
  return {
    open: s.open,
    stars: s.stars,
    month: monthOf(s),
    rooms: new Set(s.rooms.filter((r) => r.done).map((r) => r.id)),
    achieved: new Set(s.achieved),
    milestones: new Set(milestonesOf(s)),
    itemTypes: new Set(s.items.map((i) => i.type)),
    staff: new Set(s.staff.map((x) => x.id)),
    leaving: new Set(s.staff.filter((x) => x.state === 'leaving').map((x) => x.id)),
    lastQuit: s.stats.lastQuit,
    money: s.money,
    loan: s.loan,
    priceLevel: s.priceLevel,
    prices: { ...s.prices },
    campaigns: new Set(s.campaigns.map(campaignKey)),
  };
}

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
  return { center: s.center, day: Math.floor(s.day), stars: s.stars, cheated: s.cheated };
}

/** What has happened in a game since it stood as marked, oldest first. */
export function playEvents(mark: PlayMark, s: GameState): PlayEvent[] {
  const game = gameProps(s);
  const out: PlayEvent[] = [];
  if (s.open && !mark.open) out.push({ name: 'doors_opened', props: game });
  const done = s.rooms.filter((r) => r.done);
  for (const r of done)
    if (!mark.rooms.has(r.id)) out.push({ name: 'room_built', props: { ...game, room: r.type, rooms: done.length } });
  // only the month just closed is in the records: the books for any before it in the same look are summed into it
  const last = s.months.at(-1);
  if (monthOf(s) > mark.month && last) out.push({ name: 'month_ended', props: { ...game, ...monthProps(s, last) } });
  for (let star = mark.stars + 1; star <= s.stars; star++) out.push({ name: 'star_earned', props: { ...game, star } });
  for (const id of s.achieved)
    if (!mark.achieved.has(id)) out.push({ name: 'achievement_earned', props: { ...game, achievement: id } });
  for (const milestone of milestonesOf(s))
    if (!mark.milestones.has(milestone)) out.push({ name: 'milestone_reached', props: { ...game, milestone } });
  out.push(...peopleEvents(mark, s, game), ...moneyEvents(mark, s, game));
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

/** Going into the red, borrowing and repaying, prices changed and marketing bought. */
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
  if (m.waitCount) props.wait = Math.round(m.waitTotal / m.waitCount);
  return props;
}
