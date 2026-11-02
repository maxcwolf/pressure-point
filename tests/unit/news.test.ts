import { describe, expect, it } from 'vitest';

import {
  CLASSIFIEDS,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  type HeadlineCase,
  HEADLINES,
  NEWS_KEPT,
  PAPER_LINES,
  PAPERS,
  STORIES,
  VICARAGE,
} from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { monthEnd } from '../../src/core/sim/economy';
import { drainEvents } from '../../src/core/sim/events';
import {
  awardsNews,
  canLead,
  casesOf,
  classifiedOf,
  columnOf,
  emergencyEnded,
  fill,
  headlineOf,
  hireNews,
  issueAt,
  leadOf,
  lettersOf,
  logNews,
  mishapNews,
  noteOf,
  outbreakNews,
  printIssue,
  quarterEnded,
  runnerNews,
  scoreOf,
  signOf,
  storyOf,
  visitNews,
  waitNews,
} from '../../src/core/sim/news';
import { returnGap } from '../../src/core/sim/regulars';
import { newGame } from '../../src/core/state/game';
import type { Guest, NewsItem, Staff, VisitReport } from '../../src/core/state/types';
import { openCenter, run } from './helpers';

/** A piece of news on a day. */
const item = (n: Omit<NewsItem, 'day'>, day = 10): NewsItem => ({ ...n, day });

/** A sample of every headline case, with every fact its headlines and story can ask for. */
const SAMPLES: Record<Exclude<HeadlineCase, 'quiet'>, NewsItem> = {
  opened: item({ kind: 'opened' }),
  'opened-sandbox': item({ kind: 'opened' }),
  fire: item({
    kind: 'fire',
    item: 'kneadmaster',
    n: 1,
    how: 'extinguisher',
    by: 'Hamish Crickmore',
    role: 'caretaker',
    room: 'massage',
  }),
  'fire-early': item({
    kind: 'fire',
    item: 'kneadmaster',
    n: 2,
    how: 'extinguisher',
    by: 'Hamish Crickmore',
    role: 'caretaker',
    room: 'massage',
    early: true,
  }),
  'fire-beaten': item({
    kind: 'fire',
    item: 'stone_kiln',
    n: 3,
    how: 'beaten',
    by: 'Hamish Crickmore',
    role: 'caretaker',
    room: 'massage',
  }),
  'fire-brigade': item({ kind: 'fire', item: 'kneadmaster', n: 1, how: 'brigade', fee: 2500, room: 'massage' }),
  'fire-sprinklers': item({ kind: 'fire', item: 'kneadmaster', n: 1, how: 'sprinklers', room: 'massage' }),
  'runaway-door': item({ kind: 'runaway', how: 'door', who: 'Ada Twinge' }),
  'runaway-calmed': item({ kind: 'runaway', how: 'calmed', who: 'Ada Twinge', by: 'Sam Kneader', role: 'therapist' }),
  'runaway-shaman': item({ kind: 'runaway', how: 'shaman', who: 'Ada Twinge', by: 'Rowan Sage', role: 'shaman' }),
  'vip-delighted': item({
    kind: 'vip',
    how: 'delighted',
    who: 'a retired surgeon',
    rooms: 3,
    what: 'Spotless, but far too noisy.',
    room: 'massage',
    fee: 1500,
  }),
  'vip-disappointed': item({
    kind: 'vip',
    how: 'disappointed',
    who: 'a lifestyle columnist',
    rooms: 4,
    what: 'Bare and drab, and grubby.',
    room: 'consult',
  }),
  'vip-satisfied': item({
    kind: 'vip',
    how: 'satisfied',
    who: 'a gadget reviewer',
    rooms: 3,
    what: 'In fine working order.',
    room: 'consult',
  }),
  'inspection-clean': item({ kind: 'inspection', how: 'clean', n: 0, rooms: 6 }),
  'inspection-passed': item({ kind: 'inspection', how: 'passed', n: 1, rooms: 6 }),
  'inspection-failed': item({ kind: 'inspection', how: 'failed', n: 4, rooms: 6 }),
  'inspection-warned': item({ kind: 'inspection', how: 'warned', n: 3, rooms: 6 }),
  'inspection-mushrooms': item({ kind: 'inspection', how: 'mushrooms', n: 1, rooms: 5 }),
  'inspection-refused': item({ kind: 'inspection', how: 'refused', n: 3, rooms: 6, fee: 960 }),
  'inspection-paid': item({ kind: 'inspection', how: 'paid off', n: 3, rooms: 6 }),
  'mishap-power': item({ kind: 'mishap', how: 'unready', what: 'power' }),
  'mishap-storm': item({ kind: 'mishap', how: 'unready', what: 'storm' }),
  'mishap-flood': item({ kind: 'mishap', how: 'flooded', what: 'storm', room: 'restroom' }),
  'mishap-freeze': item({ kind: 'mishap', how: 'unready', what: 'freeze' }),
  'mishap-wasps': item({ kind: 'mishap', how: 'unready', what: 'wasps' }),
  'mishap-ready': item({ kind: 'mishap', how: 'ready', what: 'wasps' }),
  'mishap-warded': item({ kind: 'mishap', how: 'warded', what: 'power' }),
  overload: item({ kind: 'overload', item: 'kneadmaster', room: 'massage' }),
  sale: item({ kind: 'sale' }),
  poached: item({ kind: 'left', how: 'poached', who: 'Sam Kneader', role: 'therapist' }),
  quit: item({ kind: 'left', how: 'quit', who: 'Sam Kneader', role: 'therapist' }),
  expert: item({ kind: 'expert', who: 'Sam Kneader', role: 'therapist' }),
  amanda: item({ kind: 'amanda', who: 'Amanda Jablonsky', role: 'therapist' }),
  overtook: item({ kind: 'overtook' }),
  'emergency-handled': item({ kind: 'emergency', how: 'handled', n: 6, of: 5, what: 'Desk Slump' }),
  'emergency-failed': item({ kind: 'emergency', how: 'failed', n: 2, of: 5, what: 'Desk Slump' }),
  'outbreak-contained': item({ kind: 'outbreak', how: 'contained', n: 1 }),
  'outbreak-escaped': item({ kind: 'outbreak', how: 'escaped', n: 7 }),
  grade: item({ kind: 'grade', what: 'Wellness Studio' }),
  star: item({ kind: 'star', n: 2 }),
  'awards-center': item({ kind: 'awards', how: 'center', what: 'center-of-the-year', n: 1, of: 3 }),
  'awards-other': item({ kind: 'awards', what: 'busiest', n: 2, of: 1 }),
  wait: item({ kind: 'wait', who: 'Ada Twinge', n: 11 }),
};

/** The center each sample is printed in: the sandbox opens with its own headline. */
const centerFor = (c: HeadlineCase) => (c === 'opened-sandbox' ? 'sandbox' : 'willow');

describe('every headline and story', () => {
  for (const [c, sample] of Object.entries(SAMPLES) as [Exclude<HeadlineCase, 'quiet'>, NewsItem][]) {
    it(`fills ${c} from a sample of its kind`, () => {
      const s = newGame(centerFor(c));
      expect(casesOf(sample, s.center)[0], 'the sample is of its case').toBe(c);
      // each headline of the case comes round in turn, by issue
      const printed = new Set<string>();
      for (let issue = 0; issue < HEADLINES[c].length; issue++) {
        const h = headlineOf(s, sample, issue);
        expect(h).not.toBeNull();
        printed.add(h?.text ?? '');
      }
      for (const text of printed) {
        expect(text).not.toMatch(/[{}]|undefined|NaN/);
      }
      expect(printed.size, 'every headline of the case can print').toBe(HEADLINES[c].length);
      const story = storyOf(s, sample, c);
      expect(story).not.toBeNull();
      expect(story).not.toMatch(/[{}]|undefined|NaN/);
    });
  }

  it('fills the quiet quarter, and leaves nothing it does not know', () => {
    const s = newGame('willow');
    expect(fill(HEADLINES.quiet[0] ?? '', { center: 'Willow Lane' })).toBe(
      'Willow Lane has quiet quarter; wind chimes questioned',
    );
    expect(fill('{center} and {nobody}', { center: 'Willow Lane' })).toBeNull();
    expect(STORIES.quiet).toContain('{healed}');
    expect(s.center).toBe('willow');
  });

  it('prints the real names, rooms and days from the log', () => {
    const s = newGame('willow');
    const fire = SAMPLES['fire-early'];
    const story = storyOf(s, fire, 'fire-early') ?? '';
    expect(story).toContain('Kneadmaster 9000 in the Massage Suite');
    expect(story).toContain('Hamish Crickmore, Caretaker, put it out with the Fire Extinguisher by the door.');
    expect(story).toContain('Two things burnt');
    expect(story).toContain('day 11 of month 3');
    expect(storyOf(s, SAMPLES['fire-brigade'], 'fire-brigade')).toContain('charged $2,500');
    expect(headlineOf(s, SAMPLES.wait, 0)?.text).toBe(
      'Local woman waits 11 days, can now describe the ceiling in detail',
    );
    expect(headlineOf(s, SAMPLES.grade, 0)?.text).toBe('Willow Lane now a Wellness Studio; sign painter booked');
    expect(headlineOf(s, SAMPLES.star, 0)?.text).toBe('Willow Lane earns second star, puts it somewhere safe');
  });

  it('quotes a VIP word for word, the good of a room they liked and the bad of one they did not', () => {
    const s = newGame('willow');
    expect(headlineOf(s, SAMPLES['vip-delighted'], 0)?.text).toBe(
      'a retired surgeon calls Massage Suite "spotless"; staff deny cleaning specially',
    );
    expect(headlineOf(s, SAMPLES['vip-disappointed'], 0)?.text).toBe(
      'a lifestyle columnist finds Consultation Room "bare and drab", asks for a taxi',
    );
    expect(noteOf('Spotless, but far too noisy.', false)).toBe('far too noisy');
    expect(noteOf('Too cold, with a gloomy air about it.', false)).toBe('too cold');
    // a delighted VIP who said nothing good of the room is not quoted as if they had
    const vague = { ...SAMPLES['vip-delighted'], what: 'Bare and drab.' };
    expect(headlineOf(s, vague, 0)?.text).toBe(
      'a retired surgeon leaves Willow Lane delighted; staff deny cleaning specially',
    );
  });
});

describe('the news log', () => {
  it('keeps the biggest stories when it is full', () => {
    const ctx = createContext(newGame('willow'));
    for (let i = 0; i < NEWS_KEPT; i++) logNews(ctx, { kind: 'sale', day: i });
    expect(ctx.s.news).toHaveLength(NEWS_KEPT);
    logNews(ctx, { kind: 'star', n: 1 });
    expect(ctx.s.news).toHaveLength(NEWS_KEPT);
    expect(ctx.s.news?.some((n) => n.kind === 'star')).toBe(true);
    // smaller than everything in it, a story is let go
    logNews(ctx, { kind: 'inspection', how: 'passed', n: 1 });
    expect(ctx.s.news?.some((n) => n.kind === 'inspection')).toBe(false);
  });

  it('keeps one longest wait, the longer', () => {
    const ctx = createContext(newGame('willow'));
    logNews(ctx, { kind: 'wait', who: 'Ada Twinge', n: 9 });
    logNews(ctx, { kind: 'wait', who: 'Percy Supple', n: 7 });
    logNews(ctx, { kind: 'wait', who: 'Bram Relaxworth', n: 12 });
    expect(ctx.s.news).toEqual([expect.objectContaining({ who: 'Bram Relaxworth', n: 12 })]);
  });

  it('tells one inspection once, as it was settled, and one storm as the flood it became', () => {
    const ctx = createContext(newGame('boardwalk'));
    logNews(ctx, { kind: 'inspection', day: 40, how: 'failed', n: 3, rooms: 6 });
    logNews(ctx, { kind: 'inspection', day: 40, how: 'refused', n: 3, rooms: 6, fee: 960 });
    logNews(ctx, mishapNews({ kind: 'storm', prepared: false } as never, false));
    logNews(ctx, { kind: 'mishap', how: 'flooded', what: 'storm', room: 'restroom' });
    expect(ctx.s.news?.map((n) => n.how)).toEqual(['refused', 'flooded']);
  });

  it('logs nothing for nothing', () => {
    const ctx = createContext(newGame('willow'));
    logNews(ctx, null);
    expect(ctx.s.news).toBeUndefined();
  });
});

describe('the scoring', () => {
  it('scores each kind its base and extras', () => {
    expect(scoreOf(SAMPLES['inspection-refused'])).toBe(70);
    expect(scoreOf(SAMPLES.fire)).toBe(65);
    expect(scoreOf(SAMPLES['fire-beaten'])).toBe(75);
    expect(scoreOf(SAMPLES['fire-brigade'])).toBe(75);
    expect(scoreOf(SAMPLES['awards-center'])).toBe(60);
    expect(scoreOf(SAMPLES['awards-other'])).toBe(40);
    expect(scoreOf(SAMPLES['runaway-door'])).toBe(55);
    expect(scoreOf(SAMPLES['runaway-calmed'])).toBe(35);
    expect(scoreOf(SAMPLES['vip-delighted'])).toBe(50);
    expect(scoreOf(SAMPLES['vip-disappointed'])).toBe(45);
    expect(scoreOf(SAMPLES['vip-satisfied'])).toBe(20);
    expect(scoreOf(SAMPLES['inspection-failed'])).toBe(50);
    expect(scoreOf(SAMPLES['inspection-clean'])).toBe(25);
    expect(scoreOf(SAMPLES['mishap-power'])).toBe(45);
    expect(scoreOf(SAMPLES['mishap-warded'])).toBe(30);
    expect(scoreOf(SAMPLES['emergency-failed'])).toBe(40);
    expect(scoreOf(SAMPLES.poached)).toBe(40);
    expect(scoreOf(SAMPLES.quit)).toBe(30);
    expect(scoreOf(SAMPLES.expert)).toBe(25);
  });

  it('scores a long wait by the day, but never above a real event, and lets it lead only from eight days', () => {
    expect(scoreOf(item({ kind: 'wait', n: 7 }))).toBe(13);
    expect(canLead(item({ kind: 'wait', n: 7 }))).toBe(false);
    expect(scoreOf(item({ kind: 'wait', n: 11 }))).toBe(25);
    expect(canLead(item({ kind: 'wait', n: 11 }))).toBe(true);
    expect(scoreOf(item({ kind: 'wait', n: 60 })), 'a whole quarter of waiting').toBe(35);
    expect(scoreOf(item({ kind: 'wait', n: 60 }))).toBeLessThan(scoreOf(SAMPLES.star));
  });

  it('leads with the biggest story and keeps the next for the "Also"', () => {
    const { lead, rest } = leadOf([SAMPLES.sale, SAMPLES['fire-early'], SAMPLES.star]);
    expect(lead?.kind).toBe('fire');
    expect(rest.map((n) => n.kind)).toEqual(['star', 'sale']);
  });

  it('never leads with a bribe nobody found out about, but may print it as the "Also"', () => {
    const { lead, rest } = leadOf([SAMPLES['inspection-paid'], SAMPLES.sale]);
    expect(lead?.kind).toBe('sale');
    expect(rest[0]?.how).toBe('paid off');
    expect(canLead(SAMPLES['inspection-paid'])).toBe(false);
  });

  it('has a quiet quarter when nothing scores enough to lead', () => {
    expect(leadOf([item({ kind: 'wait', n: 7 }), SAMPLES['inspection-passed']]).lead).toBeNull();
    expect(leadOf([]).lead).toBeNull();
  });
});

describe('the quarter', () => {
  it('prints on every third payday, numbered by the quarters run', () => {
    const paydays = [1, 2, 3, 4, 5, 6, 12, 13].map((m) => m * DAYS_PER_MONTH + 0.001);
    expect(paydays.map((day) => quarterEnded({ day }))).toEqual([false, false, true, false, false, true, true, false]);
    expect(issueAt({ day: 3 * DAYS_PER_MONTH })).toBe(1);
    expect(issueAt({ day: 12 * DAYS_PER_MONTH })).toBe(4);
  });

  it('prints the issue on top of the payday that closes a quarter, and the plain message on the others', () => {
    const { sim, s } = openCenter(3);
    run(sim, 2.5 * DAYS_PER_MONTH * DAY_SECONDS);
    const before = sim.drain().filter((e) => e.type === 'toast' && e.text.startsWith('Payday:'));
    expect(before.length, 'two plain paydays first').toBe(2);
    expect(before.every((e) => e.type === 'toast' && !e.headline)).toBe(true);
    run(sim, DAYS_PER_MONTH * DAY_SECONDS);
    const events = sim.drain();
    const payday = events.find((e) => e.type === 'toast' && e.text.startsWith('Payday:'));
    expect(payday?.type === 'toast' && payday.headline?.issue).toBe(1);
    expect(payday?.type === 'toast' && payday.headline?.name).toBe(PAPERS.sandbox.name);
    expect(events.some((e) => e.type === 'announce' && e.text === PAPER_LINES[0])).toBe(true);
    expect(s.paper?.issue).toBe(1);
    expect(s.paper?.lead.headline).toBe(s.paper?.lead.headline.toUpperCase());
    expect(s.paper?.read).toBe(false);
    expect(s.news?.every((n) => n.day >= 3 * DAYS_PER_MONTH)).toBe(true);
    run(sim, DAYS_PER_MONTH * DAY_SECONDS);
    const next = sim.drain().find((e) => e.type === 'toast' && e.text.startsWith('Payday:'));
    expect(next?.type === 'toast' && next.headline).toBeUndefined();
    expect(sim.readPaper()?.read).toBe(true);
  });

  it('leads the first issue of a year with the awards held as it begins', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.rivalOn = true;
    s.open = true;
    s.rival.opened = 0;
    s.rival.points = 200;
    s.stats.healed = 1000;
    s.day = 12 * DAYS_PER_MONTH + 0.001;
    logNews(ctx, { kind: 'sale', day: 350 });
    monthEnd(ctx);
    expect(s.paper?.issue).toBe(4);
    expect(s.paper?.lead.kind).toBe('sale');
    // the awards are held after the payday, so they are the new quarter's news
    drainEvents(ctx);
    logNews(ctx, awardsNews([{ award: 'center-of-the-year', won: true }], 1));
    expect(leadOf(s.news ?? []).lead?.kind).toBe('awards');
  });
});

describe('the rest of the page', () => {
  it('prints the quarter’s best and worst reviews, signed by their stars, and none twice', () => {
    const s = newGame('willow');
    s.day = 100;
    s.reviews = [
      { name: 'Old Timer', stars: 5, text: 'Before the quarter.', day: 80, feelings: [] },
      { name: 'Ada Kneadham', stars: 5, text: 'Much looser.', day: 95, feelings: [] },
      { name: 'Bea Middling', stars: 3, text: 'Fine.', day: 96, feelings: [] },
      { name: 'Cy Grump', stars: 1, text: 'I aged a year in that waiting area.', day: 97, feelings: [] },
    ];
    expect(lettersOf(s, 90)).toEqual([
      { text: 'Much looser.', sign: 'Yours, Ada Kneadham, much looser.', stars: 5 },
      { text: 'I aged a year in that waiting area.', sign: 'Name and address supplied.', stars: 1 },
    ]);
    expect(signOf(s, s.reviews[2]!)).toBe('Bea Middling, by email.');
    // the last issue's words are not printed again while the quarter has others
    s.paper = { letters: [{ text: 'Much looser.', sign: '', stars: 5 }] } as never;
    expect(lettersOf(s, 90).map((l) => l.text)).toEqual(['Fine.', 'I aged a year in that waiting area.']);
    expect(lettersOf(s, 200)).toEqual([]);
  });

  it('signs a regular’s letter with their visits, while it was their last', () => {
    const s = newGame('willow');
    const review = { name: 'Percy Supple', stars: 4, text: 'Lovely.', day: 50, feelings: [] };
    const regular = { id: 7, name: 'Percy Supple', look: {} as never, visits: 4, loyalty: 60, due: 0 };
    regular.due = review.day + returnGap(regular);
    s.regulars = [regular];
    expect(signOf(s, review)).toBe('Percy Supple (fourth visit).');
    // back since, their count may have moved on from the visit the letter was about
    s.day = regular.due + 1;
    regular.visits = 5;
    expect(signOf(s, review)).toBe('Yours, Percy Supple, much looser.');
  });

  it('runs each center’s column from what really happened', () => {
    const willow = newGame('willow');
    willow.day = 204;
    expect(columnOf(willow, 0, []).text).toBe('Day 204. Still empty. A man looked in the window on Tuesday.');
    willow.land = [{ plot: 'unit-next-door', tiles: [] } as never];
    expect(columnOf(willow, 0, []).text).toContain('Closed');
    const orchard = newGame('orchard');
    orchard.day = 90;
    expect(columnOf(orchard, 1, []).text, 'no wasps this quarter').toBe(VICARAGE.croquet);
    expect(columnOf(orchard, 1, [item({ kind: 'mishap', how: 'unready', what: 'wasps' })]).text).toBe(VICARAGE.wasps);
    const pines = newGame('highpines');
    pines.day = 360;
    expect(columnOf(pines, 4, []).title).toBe('The Road');
    const exchange = newGame('exchange');
    exchange.day = 90;
    expect(columnOf(exchange, 1, []).text).toContain('Calm: newly listed on the quarter.');
    expect(columnOf(exchange, 1, []).text).toContain('ZenMart: not yet listed.');
    const boardwalk = newGame('boardwalk');
    boardwalk.day = 90;
    expect(columnOf(boardwalk, 1, []).text).toContain('No count last quarter');
  });

  it('advertises ZenMart’s sale only while one is on, and its vacancy only after it hired someone away', () => {
    const s = newGame('willow');
    s.day = 90;
    expect(classifiedOf(s, 0, [])).toBe(CLASSIFIEDS.lost[0]);
    expect(classifiedOf(s, 0, [SAMPLES.poached])).toBe(
      'WANTED: Massage Therapists. Must have hands. Lanyard provided. ZenMart.',
    );
    s.rival.saleUntil = 95;
    expect(classifiedOf(s, 0, [])).toBe('ZENMART. Enlightenment, 25% off for 10 days. Terms apply to the soul.');
  });

  it('prints a quiet quarter, and takes the player to whoever leads', () => {
    const ctx = createContext(newGame('willow'));
    ctx.s.day = 90.001;
    const quiet = printIssue(ctx);
    expect(quiet.lead).toEqual({
      kind: 'quiet',
      headline: 'WILLOW LANE HAS QUIET QUARTER; WIND CHIMES QUESTIONED',
      story: 'Nothing at Willow Lane made the front page this quarter. No guests were healed this quarter.',
    });
    expect(quiet.links).toEqual([]);
    ctx.s.day = 180.001;
    logNews(ctx, { ...SAMPLES.expert, ids: { staff: 12 } });
    expect(printIssue(ctx).links).toEqual([{ text: 'Sam Kneader', kind: 'staff', id: 12 }]);
  });
});

describe('what each hook logs', () => {
  const guest = { id: 3, name: 'Ada Twinge', waited: 11 * DAY_SECONDS } as Guest;
  const shaman = { id: 4, name: 'Rowan Sage', role: 'shaman' } as Staff;

  it('logs a runner, a wait, a hire and the year’s awards from what happened', () => {
    expect(runnerNews(guest)).toEqual({ kind: 'runaway', how: 'door', who: 'Ada Twinge' });
    expect(runnerNews(guest, shaman)).toMatchObject({ how: 'shaman', by: 'Rowan Sage', ids: { staff: 4, guest: 3 } });
    expect(waitNews(guest)).toEqual({ kind: 'wait', who: 'Ada Twinge', n: 11 });
    expect(waitNews({ ...guest, waited: 2 * DAY_SECONDS })).toBeNull();
    expect(hireNews(shaman)).toBeNull();
    expect(hireNews({ ...shaman, name: 'Amanda Jablonsky', role: 'therapist' })?.kind).toBe('amanda');
    expect(awardsNews([{ award: 'busiest', won: false }], 1)).toBeNull();
    expect(
      awardsNews(
        [
          { award: 'busiest', won: true },
          { award: 'center-of-the-year', won: true },
        ],
        2,
      ),
    ).toEqual({ kind: 'awards', how: 'center', what: 'center-of-the-year', n: 2, of: 2 });
  });

  it('logs emergencies, outbreaks and mishaps as they ended', () => {
    expect(emergencyEnded({ healed: 2, target: 5 } as never, 'Desk Slump')).toMatchObject({
      how: 'failed',
      n: 2,
      of: 5,
    });
    expect(outbreakNews({ lost: 1, lostMax: 3 } as never)).toMatchObject({ how: 'contained', n: 1 });
    expect(mishapNews({ kind: 'power', prepared: true, ward: 'done' } as never, false).how).toBe('warded');
    expect(mishapNews({ kind: 'power', prepared: false } as never, true).how).toBe('ready');
  });

  it('logs a visit from its report, a settled inspection as it was settled', () => {
    const s = newGame('willow');
    s.rooms = [{ id: 9, type: 'massage' } as never];
    const vip: VisitReport = {
      visit: 'vip',
      name: 'V',
      title: 'a retired surgeon',
      day: 40,
      rooms: [
        { room: 9, name: 'Massage Suite', score: 90, note: 'Spotless.', problems: [] },
        { room: 10, name: 'Consultation Room', score: 60, note: 'Grubby.', problems: [] },
      ],
      score: 75,
      outcome: 'delighted',
      money: 1500,
      rep: 4,
    };
    expect(visitNews(s, vip)).toMatchObject({
      how: 'delighted',
      rooms: 2,
      what: 'Spotless.',
      room: 'massage',
      fee: 1500,
    });
    const counter = { room: 0, name: 'Shop Counter', score: 0, note: '', problems: ['magic mushrooms'] };
    const inspection: VisitReport = { ...vip, visit: 'inspector', rooms: [counter], score: 1, outcome: 'failed' };
    expect(visitNews(s, inspection)).toMatchObject({ how: 'mushrooms', rooms: 0 });
    expect(visitNews(s, { ...inspection, refused: 960 })).toMatchObject({ how: 'refused', fee: 960 });
    expect(visitNews(s, { ...inspection, outcome: 'paid off' }).how).toBe('paid off');
    expect(visitNews(s, { ...inspection, outcome: 'passed', score: 0 }).how).toBe('clean');
  });
});
