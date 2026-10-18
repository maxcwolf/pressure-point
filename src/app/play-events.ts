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

/** How a game stood when last looked at: just enough to tell what has happened since. */
export interface PlayMark {
  open: boolean;
  stars: number;
  /** The month the game was in, counting from 0. */
  month: number;
  /** The rooms finished. */
  rooms: ReadonlySet<number>;
  achieved: ReadonlySet<AchievementId>;
}

/** How a game stands now. */
export function markOf(s: GameState): PlayMark {
  return {
    open: s.open,
    stars: s.stars,
    month: monthOf(s),
    rooms: new Set(s.rooms.filter((r) => r.done).map((r) => r.id)),
    achieved: new Set(s.achieved),
  };
}

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
