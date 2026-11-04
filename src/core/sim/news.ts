// The quarter's news, logged as it happens, a line from wherever it happens, for the town paper to print on the payday
// that closes the quarter (`paper.ts`). It changes nothing in the simulation: the paper tells the quarter back from
// facts that were told at the time.

import { AMANDA, type AwardId, BRIGADE_FEE, DAY_SECONDS, DAYS_PER_MONTH, NEWS_KEPT, QUARTER_MONTHS } from '../data';
import type {
  Emergency,
  GameState,
  Guest,
  Item,
  Mishap,
  NewsItem,
  Outbreak,
  PutOut,
  Staff,
  VisitReport,
} from '../state/types';
import type { SimContext } from './context';

/** Days to a quarter. */
export const QUARTER_DAYS = DAYS_PER_MONTH * QUARTER_MONTHS;
/** Days a guest must have waited for their wait to be news at all. */
const WAIT_NEWS_DAYS = 6;
/**
 * The most a long wait scores. Over a whole quarter the longest wait runs long, and it is still the smallest kind of
 * story: under a star, a VIP or a fire, however long it was.
 */
const WAIT_MOST = 35;

/** A piece of news as it is logged: on the day it happened unless it says otherwise. */
export type News = Omit<NewsItem, 'day'> & { day?: number };

/** Whether payday, as a month begins, closes a quarter, so the paper prints: on every third payday. */
export function quarterEnded(s: Pick<GameState, 'day'>): boolean {
  const month = Math.floor(s.day / DAYS_PER_MONTH);
  return month > 0 && month % QUARTER_MONTHS === 0;
}

/** The number of the issue printed on the payday that has just come: the quarters run in this center so far. */
export const issueAt = (s: Pick<GameState, 'day'>) => Math.floor(Math.floor(s.day / DAYS_PER_MONTH) / QUARTER_MONTHS);

/** Whether two pieces of news are the same story told again: the later takes the earlier's place. */
function sameStory(a: NewsItem, b: NewsItem): boolean {
  if (a.kind !== b.kind) return false;
  // there is one longest wait a quarter, one accident on the floor and one guest made right, however many there were
  if (a.kind === 'wait' || a.kind === 'accident' || a.kind === 'made-right') return true;
  // a failed inspection settled later, by an offer taken or turned down, is still the one inspection
  if (a.kind === 'inspection') return a.day === b.day;
  // a storm that floods a restroom as it starts is one storm
  if (a.kind === 'mishap') return a.what === b.what && Math.abs(a.day - b.day) < 1;
  return false;
}

/**
 * Log a piece of news for this quarter's paper. The same story told again takes its place (the longest wait only if it
 * is longer); a full log makes room by letting go of its smallest story, if the new one is bigger, so a busy quarter
 * keeps its biggest moments. Nothing to log, nothing happens; and news dated before the last issue printed, such as an
 * inspection settled the day after, is old news: that issue told the story as it stood.
 */
export function logNews(ctx: SimContext, news: News | null) {
  if (!news) return;
  const s = ctx.s;
  const item: NewsItem = { ...news, day: news.day ?? s.day };
  if (s.paper && item.day < s.paper.day) return;
  const log = (s.news ??= []);
  const same = log.findIndex((o) => sameStory(o, item));
  const old = log[same];
  if (old) {
    if (item.kind !== 'wait' || (item.n ?? 0) > (old.n ?? 0)) log[same] = item;
    return;
  }
  if (log.length < NEWS_KEPT) {
    log.push(item);
    return;
  }
  const smallest = log.reduce((a, b) => (scoreOf(b) < scoreOf(a) ? b : a));
  if (scoreOf(item) <= scoreOf(smallest)) return;
  log.splice(log.indexOf(smallest), 1);
  log.push(item);
}

/** How big a story is: its kind's base and its extras. The biggest leads. All first guesses. */
export function scoreOf(n: NewsItem): number {
  switch (n.kind) {
    case 'inspection':
      if (n.how === 'refused') return 70;
      return n.how === 'clean' ? 25 : n.how === 'passed' ? 10 : 50;
    case 'fire':
      return 60 + 5 * (n.n ?? 1) + (n.fee ? 10 : 0);
    case 'awards':
      return n.how === 'center' ? 60 : 40;
    case 'runaway':
      return n.how === 'door' ? 55 : 35;
    case 'star':
      return 50;
    case 'vip':
      return n.how === 'delighted' ? 50 : n.how === 'disappointed' ? 45 : 20;
    case 'opened':
    case 'grade':
    case 'amanda':
      return 45;
    case 'left':
      return n.how === 'poached' ? 40 : 30;
    case 'overtook':
      return 40;
    case 'emergency':
      return n.how === 'failed' ? 40 : 35;
    case 'outbreak':
      return n.how === 'escaped' ? 40 : 35;
    case 'overload':
      return 35;
    case 'mishap':
      return n.how === 'unready' || n.how === 'flooded' ? 45 : 30;
    case 'expert':
    case 'sale':
      return 25;
    case 'accident':
    case 'made-right':
      return 30;
    case 'wait':
      return Math.min(WAIT_MOST, 10 + 3 * Math.max(0, (n.n ?? 0) - WAIT_NEWS_DAYS));
  }
}

// What each hook logs. Each is called in one line from where the news happens, so it is kept here, out of their way.

/**
 * A fire, once the last of it is out: what caught first and the room it was in (none where fires burned in more than
 * one room at once), how much burned, who put the last of it out and how, and any fee.
 */
export function fireNews(ctx: SimContext, how: PutOut, by?: Staff): News | null {
  const s = ctx.s;
  const fire = s.fire;
  if (!fire) return null;
  const room = fire.room === undefined ? undefined : ctx.world.room(fire.room);
  const brigade = s.brigade;
  // the brigade charges as it puts the last of it out, just after this, but only once a call-out: a fire it puts out on
  // its way back to the truck costs nothing more
  const fee = fire.fee || (how === 'brigade' && brigade && !brigade.charged ? BRIGADE_FEE : 0);
  const early = !!brigade && brigade.state !== 'leaving' && !brigade.charged && how !== 'brigade';
  return {
    kind: 'fire',
    item: fire.item,
    n: fire.burnt,
    how,
    ...(fee && { fee }),
    ...(early && { early: true }),
    ...(room && { room: room.type }),
    ...(by && { by: by.name, role: by.role }),
    ids: { ...(by && { staff: by.id }), ...(room && { room: room.id }) },
  };
}

/** A guest on a really bad trip: who found the door, or who was talked down, and by whom. */
export function runnerNews(g: Guest, st?: Staff): News {
  if (!st) return { kind: 'runaway', how: 'door', who: g.name };
  return {
    kind: 'runaway',
    how: st.role === 'shaman' ? 'shaman' : 'calmed',
    who: g.name,
    by: st.name,
    role: st.role,
    ids: { staff: st.id, guest: g.id },
  };
}

/**
 * A visit, from its report: how a VIP left and the room that made up their mind, with what they said of it; or what the
 * health inspector found, and how a failed inspection was settled.
 */
export function visitNews(s: GameState, r: VisitReport): News {
  const rooms = r.rooms.filter((v) => v.room);
  if (r.visit === 'vip') {
    const how = r.outcome === 'delighted' ? 'delighted' : r.outcome === 'disappointed' ? 'disappointed' : 'satisfied';
    const sorted = [...rooms].sort((a, b) => (how === 'disappointed' ? a.score - b.score : b.score - a.score));
    const seen = sorted[0];
    const room = seen && s.rooms.find((o) => o.id === seen.room);
    return {
      kind: 'vip',
      day: r.day,
      how,
      who: r.title,
      rooms: rooms.length,
      ...(seen && { what: seen.note }),
      ...(room && { room: room.type, ids: { room: room.id } }),
      ...(how === 'delighted' && r.money > 0 && { fee: r.money }),
    };
  }
  return {
    kind: 'inspection',
    day: r.day,
    how: inspectionHow(r),
    n: r.score,
    rooms: rooms.length,
    ...(r.refused && { fee: r.refused }),
  };
}

/** How an inspection went, for the paper: mushrooms under the counter are the story, warning or no warning. */
function inspectionHow(r: VisitReport): NonNullable<NewsItem['how']> {
  if (r.outcome === 'paid off') return 'paid off';
  if (r.refused) return 'refused';
  const failed = r.outcome === 'failed' || r.outcome === 'warned';
  if (failed && r.rooms.some((v) => !v.room)) return 'mushrooms';
  if (failed) return r.outcome;
  return r.score ? 'passed' : 'clean';
}

/**
 * A mishap as it starts: warded off, ready for, kept at bay by something here, or not. Prepared for at a price, it was
 * ready, ward or no ward; prepared otherwise, a Shaman's ward held.
 */
export function mishapNews(m: Mishap, held: boolean, paid: boolean): News {
  const how = paid ? 'ready' : m.prepared ? 'warded' : held ? 'ready' : 'unready';
  return { kind: 'mishap', how, what: m.kind };
}

/** A machine that has overloaded, and the room it is in. */
export function overloadNews(ctx: SimContext, it: Item): News {
  const room = ctx.world.roomOfItem(it);
  return { kind: 'overload', item: it.type, ...(room && { room: room.type, ids: { room: room.id } }) };
}

/** A member of staff hired: news only for Amanda Jablonsky. */
export function hireNews(st: Staff): News | null {
  return st.name === AMANDA.name ? { kind: 'amanda', who: st.name, role: st.role, ids: { staff: st.id } } : null;
}

/** An emergency ended: how many were healed of how many needed, and of what. */
export function emergencyEnded(e: Emergency, condition: string): News {
  return {
    kind: 'emergency',
    how: e.healed >= e.target ? 'handled' : 'failed',
    n: e.healed,
    of: e.target,
    what: condition,
  };
}

/** A stress outbreak ended: contained or not, and how many left still stressed. */
export const outbreakNews = (o: Outbreak): News => ({
  kind: 'outbreak',
  how: o.lost <= o.lostMax ? 'contained' : 'escaped',
  n: o.lost,
});

/** The year's awards, if anything was won: Center of the Year first, then the first other award, and how many. */
export function awardsNews(results: readonly { award: AwardId; won: boolean }[], year: number): News | null {
  const won = results.filter((r) => r.won);
  const first = won.find((r) => r.award === 'center-of-the-year') ?? won[0];
  if (!first) return null;
  const center = first.award === 'center-of-the-year';
  return { kind: 'awards', ...(center && { how: 'center' }), what: first.award, n: year, of: won.length };
}

/** A guest asked back after a complaint, healed: who, and how the visit that left the complaint ended. */
export const madeRightNews = (g: Guest): News => ({
  kind: 'made-right',
  how: g.compEnd ?? 'stormed',
  who: g.name,
  ids: { guest: g.id },
});

/** A guest's wait, once it was long enough to be news. */
export function waitNews(g: Guest): News | null {
  const days = Math.floor(g.waited / DAY_SECONDS);
  return days >= WAIT_NEWS_DAYS ? { kind: 'wait', who: g.name, n: days } : null;
}
