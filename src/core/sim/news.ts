// The town paper. The quarter's news is logged as it happens, a line from wherever it happens, and the biggest story
// leads the issue printed on the payday that closes the quarter. It changes nothing in the simulation: it tells the
// quarter back, from facts that were told at the time.

import {
  ALSO_SCORE,
  AMANDA,
  ASPECT_NOTES,
  type AwardId,
  AWARDS,
  BENNY_COUNT,
  BRIGADE_FEE,
  CEILING,
  centerOf,
  CLASSIFIEDS,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  FIRE_PUT_OUT,
  FLORIST_BOUGHT,
  FLORIST_PLOT,
  FLORIST_WATCH,
  type HeadlineCase,
  HEADLINES,
  ITEMS,
  LETTER_SIGNS,
  MARKETS,
  type MishapId,
  MISHAPS,
  NEWS_KEPT,
  PAPER_LINES,
  PAPERS,
  PLANNING,
  QUARTER_MONTHS,
  QUIET_SCORE,
  ROLES,
  ROOMS,
  SALE_DAYS,
  SALE_DISCOUNT,
  SANDBOX_CENTER,
  STORIES,
  STRESS_HEADS_FOR,
  THE_ROAD,
  VICARAGE,
  WAIT_LEAD_DAYS,
} from '../data';
import { an, dateOf, money } from '../format';
import { sexOfName } from '../people';
import type {
  Emergency,
  GameState,
  Guest,
  Item,
  Mishap,
  NewsItem,
  Outbreak,
  Paper,
  PaperLetter,
  PaperLink,
  PutOut,
  Review,
  Staff,
  VisitReport,
} from '../state/types';
import type { SimContext } from './context';
import { emit } from './events';
import { returnGap } from './regulars';
import { snowedIn } from './twists';

/** Days to a quarter. */
const QUARTER_DAYS = DAYS_PER_MONTH * QUARTER_MONTHS;
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
  // there is one longest wait a quarter, and one accident on the floor, however many there were
  if (a.kind === 'wait' || a.kind === 'accident') return true;
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
      return 30;
    case 'wait':
      return Math.min(WAIT_MOST, 10 + 3 * Math.max(0, (n.n ?? 0) - WAIT_NEWS_DAYS));
  }
}

/** Whether a story may lead: a bribe nobody found out about is no headline, and a wait leads only once it is long. */
export const canLead = (n: NewsItem) =>
  !(n.kind === 'inspection' && n.how === 'paid off') && !(n.kind === 'wait' && (n.n ?? 0) < WAIT_LEAD_DAYS);

/**
 * The quarter's lead, the biggest story that may lead and scores enough, or none for a quiet quarter; and the "Also",
 * the next biggest that scores enough. Ties go to whichever came first.
 */
export function leadOf(log: readonly NewsItem[]): { lead: NewsItem | null; rest: NewsItem[] } {
  const ranked = [...log].sort((a, b) => scoreOf(b) - scoreOf(a) || a.day - b.day);
  const lead = ranked.find((n) => canLead(n) && scoreOf(n) >= QUIET_SCORE) ?? null;
  return { lead, rest: ranked.filter((n) => n !== lead && scoreOf(n) >= ALSO_SCORE) };
}

/** The headline cases a story can take, the one that fits it best first. */
export function casesOf(n: NewsItem, center: GameState['center']): HeadlineCase[] {
  switch (n.kind) {
    case 'opened':
      return [center === 'sandbox' ? 'opened-sandbox' : 'opened'];
    case 'fire': {
      const special: HeadlineCase | undefined = n.fee
        ? 'fire-brigade'
        : n.early
          ? 'fire-early'
          : n.how === 'beaten' && (n.n ?? 1) > 1
            ? 'fire-beaten'
            : n.how === 'sprinklers'
              ? 'fire-sprinklers'
              : undefined;
      return special ? [special, 'fire'] : ['fire'];
    }
    case 'runaway':
      return n.how === 'door' ? ['runaway-door'] : n.how === 'shaman' ? ['runaway-shaman'] : ['runaway-calmed'];
    case 'vip':
      return [
        n.how === 'delighted' ? 'vip-delighted' : n.how === 'disappointed' ? 'vip-disappointed' : 'vip-satisfied',
      ];
    case 'inspection':
      return [INSPECTION_CASES[n.how ?? 'failed'] ?? 'inspection-failed'];
    case 'mishap':
      if (n.how === 'warded') return ['mishap-warded'];
      if (n.how === 'ready') return ['mishap-ready'];
      if (n.how === 'flooded') return ['mishap-flood'];
      return [MISHAP_CASES[n.what as MishapId]];
    case 'left':
      return [n.how === 'poached' ? 'poached' : 'quit'];
    case 'emergency':
      return [n.how === 'failed' ? 'emergency-failed' : 'emergency-handled'];
    case 'outbreak':
      return [n.how === 'escaped' ? 'outbreak-escaped' : 'outbreak-contained'];
    case 'awards':
      return [n.how === 'center' ? 'awards-center' : 'awards-other'];
    case 'overload':
    case 'sale':
    case 'expert':
    case 'accident':
    case 'amanda':
    case 'overtook':
    case 'grade':
    case 'star':
    case 'wait':
      return [n.kind];
  }
}

/** Each inspection's case, by how it went. */
const INSPECTION_CASES: Partial<Record<NonNullable<NewsItem['how']>, HeadlineCase>> = {
  clean: 'inspection-clean',
  passed: 'inspection-passed',
  failed: 'inspection-failed',
  warned: 'inspection-warned',
  mushrooms: 'inspection-mushrooms',
  refused: 'inspection-refused',
  'paid off': 'inspection-paid',
};

/** Each mishap's case when nothing was ready for it. */
const MISHAP_CASES: Readonly<Record<MishapId, HeadlineCase>> = {
  power: 'mishap-power',
  storm: 'mishap-storm',
  freeze: 'mishap-freeze',
  wasps: 'mishap-wasps',
};

/** Fill a template's `{placeholders}` from what is known, or null if it asks for anything that is not. */
export function fill(template: string, known: Readonly<Record<string, string | undefined>>): string | null {
  const keys = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');
  if (keys.some((key) => known[key] === undefined)) return null;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => known[key] ?? '');
}

/** Words with their first letter capitalized, to start a sentence. */
export const capital = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** A small count in words, and a larger one in figures. */
export function inWords(n: number): string {
  return ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
}

/** A count of something in words: "one room", "3 rooms" past ten. */
export const counted = (n: number, what: string) => `${inWords(n)} ${what}${n === 1 ? '' : 's'}`;

/** "first", "second", up to "tenth", then "11th" and so on. */
export function ordinal(n: number): string {
  const word = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][n - 1];
  if (word) return word;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** A game day as the game writes a date: "day 14 of month 3". */
export function onDay(day: number, startMonth: number): string {
  const d = dateOf(day, startMonth);
  return `day ${d.day} of month ${d.month}`;
}

/** The first day of the quarter an issue printed now covers. */
const quarterFrom = (s: GameState) => (issueAt(s) - 1) * QUARTER_DAYS;

/** The quarter's months, the one closing as the paper prints included, oldest first. */
function quarterMonths(s: GameState): { arrived: number; healed: number }[] {
  return [...s.months.slice(-(QUARTER_MONTHS - 1)), s.tally];
}

/** How many guests were healed this quarter, in a sentence. */
function healedLine(s: GameState): string {
  const healed = quarterMonths(s).reduce((n, m) => n + m.healed, 0);
  return healed
    ? `${healed === 1 ? 'One guest was' : `${healed} guests were`} healed this quarter.`
    : 'No guests were healed this quarter.';
}

/** What a waiting guest had most of to look at: the commonest decoration in the building, or the ceiling. */
function commonest(s: GameState): string {
  const counts = new Map<string, number>();
  for (const it of s.items) {
    const def = ITEMS[it.type];
    if ((def.decor ?? 0) <= 0 || def.station) continue;
    counts.set(def.name, (counts.get(def.name) ?? 0) + 1);
  }
  let best = '';
  let most = 0;
  for (const [name, n] of counts) if (n > most) [best, most] = [name, n];
  return best ? `the ${best.toLowerCase()}` : CEILING;
}

/** What a VIP said of a room in a few words, from their note on it: the good of it, or the bad. */
export function noteOf(note: string, good: boolean): string | undefined {
  const clauses = note
    .replace(/\.$/, '')
    .split(/, (?:but|and|with) /)
    .map((c) => c.toLowerCase());
  return good ? clauses.find((c) => goods.has(c)) : clauses.find((c) => !goods.has(c) && !c.includes('gloomy'));
}

/** Every way a VIP says a room pleased them. */
const goods = new Set<string>(Object.values(ASPECT_NOTES).map((a) => a.good));

/** A day's length in words: "a day", "two days". */
const lasting = (days: number) => (days === 1 ? 'a day' : `${inWords(days)} days`);

/** What the paper calls the center: its name, or in the sandbox, which has none, just the center. */
export const centerName = (s: GameState) => (s.center === 'sandbox' ? SANDBOX_CENTER : centerOf(s).name);

/** Everything a story's headline and words may be filled from. */
function knownOf(s: GameState, n: NewsItem): Record<string, string | undefined> {
  const center = centerName(s);
  const room = n.room && ROOMS[n.room].name;
  const item = n.item && ITEMS[n.item].name;
  const role = n.role && ROLES[n.role].name;
  // a fire and a runner name the member of staff who saw to it; the staff's own news names them
  const staff =
    n.kind === 'fire' || n.kind === 'runaway'
      ? n.by
      : n.kind === 'left' || n.kind === 'expert' || n.kind === 'amanda'
        ? n.who
        : undefined;
  const guest = n.kind === 'runaway' || n.kind === 'wait' ? n.who : undefined;
  const mishap = n.kind === 'mishap' ? MISHAPS[n.what as MishapId] : undefined;
  const award = n.kind === 'awards' ? AWARDS[n.what as AwardId] : undefined;
  const sex = guest && sexOfName(guest);
  const known: Record<string, string | undefined> = {
    center,
    guest,
    staff,
    visitor: n.kind === 'vip' ? n.who : undefined,
    room,
    item,
    in: room ? ` in the ${room}` : '',
    role,
    arole: role && an(role),
    n: n.n === undefined ? undefined : String(n.n),
    target: n.of === undefined ? undefined : String(n.of),
    fee: n.fee ? money(n.fee) : undefined,
    prize: n.fee ? money(n.fee) : undefined,
    condition: n.kind === 'emergency' ? n.what : undefined,
    grade: n.kind === 'grade' && n.what ? an(n.what) : undefined,
    verdict: n.kind === 'vip' ? n.what : undefined,
    note: n.kind === 'vip' && n.what ? noteOf(n.what, n.how !== 'disappointed') : undefined,
    rooms: n.rooms === undefined ? undefined : counted(n.rooms, 'room'),
    problems: n.kind === 'inspection' && n.n !== undefined ? counted(n.n, 'problem') : undefined,
    mess: n.item && ITEMS[n.item].machine?.overload?.mess,
    mishap: mishap?.name.toLowerCase(),
    lasted: mishap && lasting(mishap.days),
    discount: String(Math.round(SALE_DISCOUNT * 100)),
    days: n.kind === 'wait' ? String(n.n) : n.kind === 'sale' ? String(SALE_DAYS) : undefined,
    local: guest ? (sex === 'female' ? 'Local woman' : sex === 'male' ? 'Local man' : 'Local guest') : undefined,
    thing: n.kind === 'wait' ? commonest(s) : undefined,
    where: STRESS_HEADS_FOR[s.center],
    guests: n.kind === 'outbreak' ? (n.n ? counted(n.n, 'guest') : 'nobody') : undefined,
    nth: n.kind === 'star' && n.n ? (n.n === 1 ? 'a' : ordinal(n.n)) : undefined,
    ordinal: n.kind === 'star' && n.n ? ordinal(n.n) : undefined,
    award: award?.name,
    won: award && (n.of ?? 1) > 1 ? `${award.name} and ${counted((n.of ?? 1) - 1, 'more award')}` : award?.name,
    year: n.kind === 'awards' ? String(n.n) : undefined,
    date: onDay(n.day, s.startMonth),
    healed: healedLine(s),
  };
  if (n.kind === 'fire') {
    known.burned =
      (n.n ?? 1) > 1 ? `${capital(counted(n.n ?? 1, 'thing'))} burned before it was out.` : 'Nothing else caught.';
    known.putout = putOutLine(n, known);
  }
  return known;
}

/** How a fire was put out, in the story, with the brigade's fee or its wasted trip where there was one. */
function putOutLine(n: NewsItem, known: Readonly<Record<string, string | undefined>>): string {
  const how = n.how && n.how in FIRE_PUT_OUT ? FIRE_PUT_OUT[n.how as PutOut] : undefined;
  const line = how ? (fill(how, known) ?? 'It was put out.') : 'It was put out.';
  if (n.how !== 'brigade' && n.fee) return `${line} The fire brigade charged ${money(n.fee)}.`;
  return n.early ? `${line} The fire brigade arrived to find it out, and did not charge.` : line;
}

/** A story's headline, in sentence case, from the first of its cases with a headline the news can fill. */
export function headlineOf(s: GameState, n: NewsItem, issue: number): { text: string; case: HeadlineCase } | null {
  const known = knownOf(s, n);
  for (const c of casesOf(n, s.center)) {
    const filled = HEADLINES[c].map((t) => fill(t, known)).filter((t): t is string => t !== null);
    const text = filled[issue % filled.length];
    if (text) return { text, case: c };
  }
  return null;
}

/** A story's words under its headline, filled from the news, or null if it asks for anything the news does not have. */
export const storyOf = (s: GameState, n: NewsItem, c: HeadlineCase) => fill(STORIES[c], knownOf(s, n));

/** The headline of a quiet quarter. */
function quietHeadline(s: GameState, issue: number): string {
  const options = HEADLINES.quiet.map((t) => fill(t, { center: centerName(s) })).filter((t) => t !== null);
  return options[issue % options.length] ?? '';
}

/** A headline as the "Also" prints it: as a sentence, capitalized and stopped. A bribe's is a sentence already. */
const asSentence = (text: string) => (/[.!?]$/.test(text) ? capital(text) : `${capital(text)}.`);

/** The names in a story that can be clicked, as they appear in it. */
function linksOf(s: GameState, n: NewsItem): PaperLink[] {
  const links: PaperLink[] = [];
  const known = knownOf(s, n);
  if (n.ids?.staff && known.staff) links.push({ text: known.staff, kind: 'staff', id: n.ids.staff });
  if (n.ids?.guest && known.guest) links.push({ text: known.guest, kind: 'guest', id: n.ids.guest });
  if (n.ids?.room && known.room) links.push({ text: known.room, kind: 'room', id: n.ids.room });
  return links;
}

/** How a letter is signed: by name and how loose it left them, by email, or not at all; a regular by their visits. */
export function signOf(s: GameState, r: Review): string {
  if (r.stars <= 1) return LETTER_SIGNS.bad;
  const regular = s.regulars.find((o) => o.name === r.name);
  // the visit count is theirs only while this review was their last visit, and they are not back for another
  const back = regular && s.guests.some((g) => g.regular === regular.id);
  if (regular && !back && regularReviewed(s, regular, r))
    return fill(LETTER_SIGNS.regular, { name: r.name, nth: ordinal(regular.visits) }) ?? r.name;
  return fill(r.stars >= 4 ? LETTER_SIGNS.good : LETTER_SIGNS.middling, { name: r.name }) ?? r.name;
}

/**
 * Whether a review is the one written at the end of a regular's latest visit: the one that set the day they are due
 * back, which is worked out from that very day, with that day still to come, so they have not been back since.
 */
function regularReviewed(s: GameState, regular: GameState['regulars'][number], r: Review): boolean {
  return s.day < regular.due && Math.abs(regular.due - (r.day + returnGap(regular))) < 1e-6;
}

/**
 * Two of the quarter's reviews, word for word under the reviewers' names: the highest-starred and the lowest, the
 * latest of each, none from before the quarter, and none the last issue printed or the other letter says word for word
 * if the quarter has others.
 */
export function lettersOf(s: GameState, from: number): PaperLetter[] {
  const printed = new Set(s.paper?.letters.map((l) => l.text));
  const quarter = s.reviews.filter((r) => r.day >= from);
  const fresh = quarter.filter((r) => !printed.has(r.text));
  const pool = fresh.length ? fresh : quarter;
  if (!pool.length) return [];
  const best = pool.reduce((a, b) => (b.stars >= a.stars ? b : a));
  const unlike = pool.filter((r) => r.text !== best.text);
  const others = unlike.length ? unlike : pool.filter((r) => r !== best);
  const worst = others.length ? others.reduce((a, b) => (b.stars <= a.stars ? b : a)) : undefined;
  return [best, ...(worst ? [worst] : [])].map((r) => ({ text: r.text, sign: signOf(s, r), stars: r.stars }));
}

/** The center's own column, one line, from what really happened where it says so. */
export function columnOf(s: GameState, issue: number, log: readonly NewsItem[]): Paper['column'] {
  const title = PAPERS[s.center].column;
  const from = quarterFrom(s);
  /** The line whose turn it is this issue. */
  const turn = <T>(lines: readonly T[]) => lines[issue % lines.length] as T;
  switch (s.center) {
    case 'willow': {
      const bought = s.land.some((l) => l.plot === FLORIST_PLOT);
      const text = bought ? FLORIST_BOUGHT : turn(FLORIST_WATCH);
      return { title, text: fill(text, { day: String(Math.floor(s.day)), center: centerName(s) }) ?? '' };
    }
    case 'exchange': {
      const before = s.months.at(-QUARTER_MONTHS);
      const moved = before ? Math.round(s.reputation - before.reputation) : null;
      const move = moved === null ? 'newly listed' : moved > 0 ? `up ${moved}` : moved < 0 ? `down ${-moved}` : 'flat';
      const calm = fill(MARKETS.calm, { move }) ?? '';
      const rival = s.rival.opened ? turn(MARKETS.rival) : MARKETS.closed;
      return { title, text: `${calm} ${rival} ${turn(MARKETS.rest)}` };
    }
    case 'boardwalk': {
      const now = quarterMonths(s).reduce((n, m) => n + m.arrived, 0);
      const last = s.months.slice(-(QUARTER_MONTHS * 2 - 1), -(QUARTER_MONTHS - 1));
      const count =
        last.length === QUARTER_MONTHS
          ? fill(BENNY_COUNT.both, { now: String(now), then: String(last.reduce((n, m) => n + m.arrived, 0)) })
          : fill(BENNY_COUNT.first, { now: String(now) });
      return { title, text: `${count ?? ''} ${turn(BENNY_COUNT.rest)}` };
    }
    case 'highpines': {
      const snow = centerOf(s).snow;
      let shut = 0;
      if (snow) for (let d = from; d < from + QUARTER_DAYS; d++) if (snowedIn(d + 0.5, snow, s.startMonth)) shut++;
      return { title, text: shut ? (fill(THE_ROAD.shut, { days: lasting(shut) }) ?? '') : THE_ROAD.open };
    }
    case 'orchard': {
      const lines = [
        s.guests.some((g) => g.condition === 'sourgrapes') ? VICARAGE.sourGrapes : null,
        log.some((n) => n.kind === 'mishap' && n.what === 'wasps') ? VICARAGE.wasps : null,
        VICARAGE.croquet,
      ];
      return { title, text: turn(lines) ?? VICARAGE.croquet };
    }
    case 'sandbox': {
      const sketch = s.sketches.filter((sk) => sk.day >= from).at(-1);
      const text = sketch
        ? fill(PLANNING.sketch, {
            room: an(ROOMS[sketch.type].name, true),
            w: String(sketch.w),
            h: String(sketch.h),
            date: onDay(sketch.day, s.startMonth),
          })
        : PLANNING.none;
      return { title, text: text ?? PLANNING.none };
    }
  }
}

/** The one classified: ZenMart's sale while one is on, its wanted advert after it hired someone away, or the lost and found. */
export function classifiedOf(s: GameState, issue: number, log: readonly NewsItem[]): string {
  if (s.rival.saleUntil > s.day)
    return fill(CLASSIFIEDS.sale, { discount: String(Math.round(SALE_DISCOUNT * 100)), days: String(SALE_DAYS) }) ?? '';
  const poached = log.filter((n) => n.kind === 'left' && n.how === 'poached' && n.role).at(-1);
  if (poached?.role) return fill(CLASSIFIEDS.wanted, { roles: `${ROLES[poached.role].name}s` }) ?? '';
  return CLASSIFIEDS.lost[issue % CLASSIFIEDS.lost.length] ?? '';
}

/** The front page: the lead's headline in capitals, its story and the names in it, or a quiet quarter's. */
function frontPage(s: GameState, lead: NewsItem | null, issue: number): Paper['lead'] & { links: PaperLink[] } {
  const head = lead ? headlineOf(s, lead, issue) : null;
  if (lead && head) {
    const story = storyOf(s, lead, head.case) ?? '';
    return { kind: lead.kind, headline: head.text.toUpperCase(), story: capital(story), links: linksOf(s, lead) };
  }
  const story = fill(STORIES.quiet, knownOf(s, quietItem(s))) ?? '';
  return { kind: 'quiet', headline: quietHeadline(s, issue).toUpperCase(), story: capital(story), links: [] };
}

/**
 * Print the paper for the quarter just closed, from its news log, and start the next quarter's log afresh: the lead
 * and its story, the next biggest as the "Also", two letters from the quarter's reviews, the center's column and one
 * classified. It is kept as printed, and the speakers say it is out.
 */
export function printIssue(ctx: SimContext): Paper {
  const s = ctx.s;
  const issue = issueAt(s);
  const log = s.news ?? [];
  const { lead, rest } = leadOf(log);
  const front = frontPage(s, lead, issue);
  const also = rest.map((n) => headlineOf(s, n, issue)).find((h) => h && h.text.toUpperCase() !== front.headline);
  const paper: Paper = {
    issue,
    day: s.day,
    name: PAPERS[s.center].name,
    motto: PAPERS[s.center].motto,
    lead: { kind: front.kind, headline: front.headline, story: front.story },
    ...(also && { also: asSentence(also.text) }),
    letters: lettersOf(s, quarterFrom(s)),
    column: columnOf(s, issue, log),
    classified: classifiedOf(s, issue, log),
    links: front.links,
    read: false,
  };
  s.paper = paper;
  s.news = [];
  emit(ctx, { type: 'announce', text: PAPER_LINES[(issue - 1) % PAPER_LINES.length] ?? '' });
  return paper;
}

/** Put the paper's message up: payday's words under its masthead and headlines, taking the player to whoever leads. */
export function paperToast(ctx: SimContext, paper: Paper, text: string) {
  const link = paper.links[0];
  const headline = {
    name: paper.name,
    issue: paper.issue,
    lead: paper.lead.headline,
    ...(paper.also && { also: paper.also }),
  };
  emit(ctx, {
    type: 'toast',
    text,
    kind: 'info',
    icon: 'ui-news',
    headline,
    ...(link && { about: { kind: link.kind, id: link.id } }),
  });
}

/** A stand-in for a quiet quarter's story to be filled from. */
const quietItem = (s: GameState): NewsItem => ({ kind: 'opened', day: s.day });

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

/** A guest's wait, once it was long enough to be news. */
export function waitNews(g: Guest): News | null {
  const days = Math.floor(g.waited / DAY_SECONDS);
  return days >= WAIT_NEWS_DAYS ? { kind: 'wait', who: g.name, n: days } : null;
}
