// Which discipline guests come for: popularity, following, the finest room and training, and what the panel says.
import { describe, expect, it } from 'vitest';

import {
  CAPACITY_ARRIVALS,
  centerOf,
  conditionOf,
  CONDITIONS,
  CONSULT_FEEDS,
  DAY_SECONDS,
  DISCIPLINES,
  FOLLOWING,
  followingPull,
  GUEST_CAP,
  LINE_PUT_OFF,
  MODALITIES,
} from '../../src/core/data';
import type { Discipline, Modality } from '../../src/core/data/types';
import { unfedAdvice } from '../../src/core/sim/advisor';
import type { SimContext } from '../../src/core/sim/context';
import {
  capacity,
  capacityArrivals,
  chooseCondition,
  type DisciplineDemand,
  fadeFollowing,
  followingOf,
  followVisit,
  lineArrivals,
  lineFactor,
  unfedStations,
  UNTRAINED_PULL,
} from '../../src/core/sim/demand';
import { admitGuests, type ArrivalPace, guestCap, guestsCounted, spawnGuest } from '../../src/core/sim/guests';
import { newGame } from '../../src/core/state/game';
import type { GameState, Guest } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import {
  capacityNote,
  demandAdvice,
  followingWord,
  limitNote,
  lineWord,
  paceNote,
  popularityWord,
  times,
} from '../../src/ui/lib/demand';
import { calendarTip } from '../../src/ui/lib/seasons';
import {
  addAcupuncture,
  addReiki,
  addSound,
  buildRoom,
  hire,
  LAYOUT,
  openCenter,
  run,
  runUntil,
  toasts,
} from './helpers';

/** The game's own context, for calling the simulation directly. */
const ctxOf = (c: { sim: unknown }) => (c.sim as { ctx: SimContext }).ctx;
/** Every technique of a discipline. */
const modsOf = (d: Discipline) => (Object.keys(MODALITIES) as Modality[]).filter((m) => MODALITIES[m].discipline === d);

/** A center with a Massage Suite and a Sound Bath Studio, everyone trained in everything, at the first star. */
function twoRooms() {
  const c = openCenter(1);
  c.s.stars = 1;
  addSound(c.sim);
  const healer = hire(c.sim, 'healer');
  c.therapist.quals = modsOf('massage');
  healer.quals = modsOf('sound');
  return { ...c, healer, ctx: ctxOf(c) };
}

/** A second massage table in the Massage Suite, beside the first. */
function addMassageTable(c: ReturnType<typeof twoRooms>) {
  for (let y = 5; y <= 8; y++)
    for (let x = 11; x <= 14; x++)
      for (let rot = 0; rot < 4; rot++)
        if (c.sim.world.canPlaceItem('massage_table', x, y, rot).ok && c.sim.placeItem('massage_table', x, y, rot))
          return;
  throw new Error('no room for a second table');
}

/** The guest limit's terms as calibrated in balance-log entry 37. */
const CAP_NOW = { base: 4, station: 2, consult: 2 };

/** One discipline's row of the demand. */
const row = (rows: DisciplineDemand[], d: Discipline) => rows.find((r) => r.discipline === d);

describe('which discipline guests come for', () => {
  it('goes by popularity, all else equal', () => {
    const c = twoRooms();
    c.s.following = { massage: 40, sound: 40 };
    const rows = c.sim.demand();
    const massage = row(rows, 'massage');
    const sound = row(rows, 'sound');
    expect(massage && sound).toBeTruthy();
    if (!massage || !sound) return;
    // the rooms and the local favourites aside, it is popularity that tells them apart
    /** Its pull without its room or the local favourites. */
    const plain = (r: DisciplineDemand) => r.pull / r.room.pull / r.flavour;
    expect(plain(sound) / plain(massage)).toBeCloseTo(DISCIPLINES.sound.popularity / DISCIPLINES.massage.popularity, 5);
    expect(massage.share + sound.share).toBeCloseTo(1, 5);
  });

  it('comes more for a discipline with a bigger following', () => {
    const c = twoRooms();
    c.s.following = { massage: 40, sound: 0 };
    const quiet = row(c.sim.demand(), 'sound')?.share ?? 0;
    c.s.following.sound = 80;
    const famous = row(c.sim.demand(), 'sound')?.share ?? 0;
    expect(famous).toBeGreaterThan(quiet * 1.5);
    expect(row(c.sim.demand(), 'sound')?.followed).toBe(followingPull(80));
  });

  it('comes less while nobody is trained in what guests want, and says what that is', () => {
    const c = twoRooms();
    const trained = row(c.sim.demand(), 'sound');
    c.healer.quals = ['sound'];
    const untrained = row(c.sim.demand(), 'sound');
    expect(trained?.training).toBe(1);
    expect(untrained?.training).toBeLessThan(1);
    expect(untrained?.training).toBeGreaterThanOrEqual(UNTRAINED_PULL);
    expect(untrained?.untrained).toEqual(['forks']);
    expect(untrained?.share ?? 1).toBeLessThan(trained?.share ?? 0);
  });

  it('picks a discipline by its pull, then a condition within it', () => {
    const c = twoRooms();
    const first = chooseCondition(c.ctx, 0, 0);
    const last = chooseCondition(c.ctx, 0.9999, 0.9999);
    /** The discipline that treats a condition. */
    const disciplineOf = (id: string) =>
      MODALITIES[CONDITIONS.find((x) => x.id === id)?.modality ?? 'swedish'].discipline;
    expect(disciplineOf(first)).toBe('massage');
    expect(disciplineOf(last)).toBe('sound');
  });

  it('falls back to the plainest massage when nothing is on offer', () => {
    const c = openCenter(1);
    c.s.rooms = [];
    expect(conditionOf(chooseCondition(ctxOf(c), 0.5, 0.5)).modality).toBe(DISCIPLINES.massage.base);
  });
});

describe('a following', () => {
  /** A guest come for a condition of a discipline, waiting for their treatment unless they are still on their way. */
  const guestFor = (d: Discipline, goal: Guest['goal'] = 'treat') =>
    ({ condition: CONDITIONS.find((x) => MODALITIES[x.modality].discipline === d)?.id, goal }) as Guest;

  it('grows with each guest healed, less as it grows, and shrinks with each let down', () => {
    const c = twoRooms();
    c.s.following = {};
    expect(followingOf(c.s, 'sound')).toBe(FOLLOWING.start);
    followVisit(c.ctx, guestFor('sound'), 'healed');
    expect(c.s.following.sound).toBeCloseTo(FOLLOWING.start + FOLLOWING.heal * (1 - FOLLOWING.start / 100), 5);
    c.s.following.sound = 50;
    followVisit(c.ctx, guestFor('sound'), 'healed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2);
    followVisit(c.ctx, guestFor('sound'), 'failed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2 - FOLLOWING.fail);
    followVisit(c.ctx, guestFor('sound'), 'stormed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2 - FOLLOWING.fail - FOLLOWING.walkout);
    // a guest put off by the price, or fed up at the desk before their treatment, says nothing about the treatment
    followVisit(c.ctx, guestFor('sound'), 'priced');
    followVisit(c.ctx, guestFor('sound', 'reception'), 'stormed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2 - FOLLOWING.fail - FOLLOWING.walkout);
  });

  it('fades by a twentieth over a month with nobody treated, and not on a day someone is', () => {
    const c = twoRooms();
    c.s.following = { massage: 50, sound: 50 };
    for (let day = 0; day < 30; day++) {
      followVisit(c.ctx, guestFor('sound'), 'failed');
      c.s.following.sound = 50;
      fadeFollowing(c.ctx);
    }
    expect(c.s.following.massage).toBeCloseTo(50 * (1 - FOLLOWING.fade / 30) ** 30, 5);
    expect(c.s.following.massage).toBeCloseTo(47.5, 0);
    expect(c.s.following.sound).toBe(50);
    // a guest who gave up before their treatment was not treated
    followVisit(c.ctx, guestFor('sound'), 'stormed');
    fadeFollowing(c.ctx);
    expect(c.s.following.sound).toBeLessThan(50 - FOLLOWING.walkout);
  });

  it('holds its own with fewer heals than failures from nothing, but needs more as it grows', () => {
    /** Where a following goes after one guest healed and one failed, at some healing rate, over many guests. */
    const settle = (rate: number, from: number) => {
      const c = twoRooms();
      c.s.following = { sound: from };
      for (let i = 0; i < 400; i++) followVisit(c.ctx, guestFor('sound'), (i * rate) % 1 < rate ? 'healed' : 'failed');
      return c.s.following.sound ?? 0;
    };
    expect(settle(0.45, 0)).toBeGreaterThan(5);
    expect(settle(0.45, 80)).toBeLessThan(40);
    expect(settle(0.75, 20)).toBeGreaterThan(60);
  });

  it('starts with massage known, and anything new with a little', () => {
    expect(newGame().following).toEqual({ massage: FOLLOWING.established });
    expect(followingOf(newGame(), 'reiki')).toBe(FOLLOWING.start);
  });

  it('carries on in an older save as if every discipline it had a room for were known', () => {
    const c = twoRooms();
    const old = JSON.parse(JSON.stringify(c.s)) as Partial<GameState>;
    delete old.following;
    upgradeSave(old as GameState);
    const s = old as GameState;
    expect(s.following).toEqual({ massage: FOLLOWING.established, sound: FOLLOWING.established });
  });

  it('is kept in play as its guests are treated', () => {
    const c = twoRooms();
    c.s.following = { massage: 40 };
    c.s.open = true;
    runUntil(c.sim, () => (c.s.stats.healedBy.sound ?? 0) > 0, 1500);
    expect(c.s.following.sound).toBeDefined();
  });
});

describe('how many guests arrive', () => {
  it('rises with each staffed treatment station past the first, a table for each practitioner and the mats they play', () => {
    const c = twoRooms();
    // one table and its therapist, and a Sound Healer playing the studio's two mats
    expect(capacity(c.ctx)).toEqual({
      stations: 3,
      by: { massage: 1, sound: 2 },
      away: 0,
      idle: 0,
      consults: 1,
      fed: 3,
      machines: [],
    });
    expect(capacityArrivals(capacity(c.ctx))).toBeCloseTo(1.24, 5);
    // a room with nobody to work in it brings nobody
    c.healer.state = 'leaving';
    expect(capacity(c.ctx)).toMatchObject({ stations: 1, by: { massage: 1 }, idle: 2, fed: 1 });
    expect(capacityArrivals(capacity(c.ctx))).toBe(1);
  });

  it('counts a second table only with a second practitioner to work it', () => {
    const c = twoRooms();
    addMassageTable(c);
    expect(capacity(c.ctx)).toMatchObject({ stations: 3, idle: 1 });
    hire(c.sim, 'therapist');
    expect(capacity(c.ctx)).toMatchObject({ stations: 4, by: { massage: 2, sound: 2 }, idle: 0 });
  });

  it('leaves out a station while its practitioner is away on a course or a house call', () => {
    const c = twoRooms();
    c.therapist.state = 'training';
    expect(capacity(c.ctx)).toMatchObject({ stations: 2, by: { sound: 2 }, away: 1, idle: 0 });
    c.therapist.state = 'away';
    expect(capacity(c.ctx)).toMatchObject({ stations: 2, away: 1 });
    // a break is part of the work
    c.therapist.state = 'onBreak';
    expect(capacity(c.ctx)).toMatchObject({ stations: 3, away: 0 });
  });

  it('draws for no more stations than the Consultation Rooms can keep in guests', () => {
    const c = twoRooms();
    addMassageTable(c);
    hire(c.sim, 'therapist');
    addAcupuncture(c.sim);
    hire(c.sim, 'acupuncturist');
    addReiki(c.sim);
    hire(c.sim, 'practitioner');
    // four tables and the mats, and one Consultant: four stations' worth draw
    expect(CONSULT_FEEDS).toBe(4);
    expect(capacity(c.ctx)).toMatchObject({ stations: 6, consults: 1, fed: 4 });
    expect(capacityArrivals(capacity(c.ctx))).toBeCloseTo(1.36, 5);
    c.consultant.state = 'leaving';
    expect(capacity(c.ctx)).toMatchObject({ stations: 6, consults: 0, fed: 0 });
  });

  describe('and says so when they cannot', () => {
    /** Six staffed stations and one Consultant, as above: two of them draw nobody. */
    function sixStations() {
      const c = twoRooms();
      addMassageTable(c);
      hire(c.sim, 'therapist');
      addAcupuncture(c.sim);
      hire(c.sim, 'acupuncturist');
      addReiki(c.sim);
      hire(c.sim, 'practitioner');
      return c;
    }

    it('in the advisor: another Consultation Room would let them draw, and another treatment room would not', () => {
      const c = sixStations();
      expect(unfedStations(capacity(c.ctx))).toBe(2);
      expect(unfedAdvice(c.ctx)).toBe(
        '2 staffed treatment stations draw no guests: every guest sees a Wellness Consultant first, and each Consultation Room keeps only 4 stations in guests. Another Consultation Room with a Wellness Consultant would let them draw, and let more in at once; another treatment room would draw nobody more.',
      );
      expect(c.sim.advice()).toBe(unfedAdvice(c.ctx));
    });

    it('asking for a Consultant first for a Consultation Room standing without one', () => {
      const c = sixStations();
      buildRoom(c.sim, 'consult', LAYOUT.training.rect, LAYOUT.training.door, [
        ['consult_desk', 6, 12],
        ['cabinet', 5, 14],
      ]);
      expect(unfedAdvice(c.ctx)).toContain(
        'A Wellness Consultant for the Consultation Room standing without one would let them draw',
      );
      hire(c.sim, 'consultant');
      expect(unfedStations(capacity(c.ctx))).toBe(0);
      expect(unfedAdvice(c.ctx)).toBe('');
    });

    it('and nothing while every staffed station draws', () => {
      const c = twoRooms();
      expect(unfedStations(capacity(c.ctx))).toBe(0);
      expect(unfedAdvice(c.ctx)).toBe('');
    });

    it('in a toast, once, the first day it happens', () => {
      const c = sixStations();
      c.sim.drain();
      run(c.sim, DAY_SECONDS * 1.1);
      expect(toasts(c.sim.drain()).filter((t) => t.includes('draw no guests'))).toEqual([unfedAdvice(c.ctx)]);
      run(c.sim, DAY_SECONDS * 2);
      expect(toasts(c.sim.drain()).filter((t) => t.includes('draw no guests'))).toEqual([]);
    });
  });

  it('draws six stations 1.6 times as often as one, and stops growing at 2.5 times', () => {
    expect(capacityArrivals({ fed: 0 })).toBe(1);
    expect(capacityArrivals({ fed: 1 })).toBe(1);
    expect(capacityArrivals({ fed: 6 })).toBeCloseTo(1.6, 5);
    expect(capacityArrivals({ fed: 14 })).toBeCloseTo(2.5, 5);
    expect(capacityArrivals({ fed: 30 })).toBe(CAPACITY_ARRIVALS.most);
  });

  it('sets the pace guests arrive at, with reputation the base and the difficulty on top', () => {
    const c = twoRooms();
    c.s.reputation = 50;
    c.s.open = true;
    const pace = c.sim.arrivalPace();
    // 20 seconds a guest at 50% reputation: 9 a month
    expect(pace.base).toBeCloseTo(9, 5);
    expect(pace.staffed).toBeCloseTo(1.24, 5);
    const parts = pace.parts.center * pace.parts.time * pace.parts.grade * pace.parts.rival * pace.parts.mishap;
    expect(pace.seconds).toBeCloseTo(20 / parts / 1.24 / pace.lines / pace.difficulty, 5);
    expect(pace.perMonth).toBeCloseTo(180 / pace.seconds, 5);
    // the next guest comes within three tenths either side of it
    c.s.spawnT = 0;
    admitGuests(c.ctx, 0.01);
    expect(c.s.spawnT).toBeGreaterThanOrEqual(pace.seconds * 0.7 - 1e-9);
    expect(c.s.spawnT).toBeLessThanOrEqual(pace.seconds * 1.3 + 1e-9);
    // a harder setting slows the same center down
    c.s.difficulty = { arrivals: 'harder' };
    expect(c.sim.arrivalPace().seconds).toBeGreaterThan(pace.seconds);
  });
});

describe('the guests let in at once', () => {
  it('are a few, and more for each staffed treatment station and staffed Consultation Room', () => {
    const c = twoRooms();
    const { base, station, consult } = GUEST_CAP;
    expect(GUEST_CAP).toEqual(CAP_NOW);
    expect(guestCap(c.ctx)).toBe(base + station * 3 + consult * 1);
    // a table nobody works lets nobody more in
    addMassageTable(c);
    expect(guestCap(c.ctx)).toBe(base + station * 3 + consult * 1);
    // and with no Consultant, no station is kept in guests
    c.consultant.state = 'leaving';
    expect(guestCap(c.ctx)).toBe(base);
  });

  it('turn the rest away once the building is full, and count them', () => {
    const c = twoRooms();
    c.s.open = true;
    const cap = guestCap(c.ctx);
    while (guestsCounted(c.s) < cap) spawnGuest(c.ctx);
    const away = c.s.tally.turnedAway ?? 0;
    c.s.spawnT = 0;
    admitGuests(c.ctx, 0.01);
    expect(guestsCounted(c.s)).toBe(cap);
    expect(c.s.tally.turnedAway).toBe(away + 1);
  });
});

describe('the pace, in words', () => {
  /** A center's pace: 28 a month at the Boardwalk in summer, with six staffed stations, unless told otherwise. */
  const pace = (over: Partial<ArrivalPace> = {}): ArrivalPace => ({
    base: 9,
    parts: { center: 1, time: 1.9, grade: 1.1, rival: 1, mishap: 1 },
    capacity: { stations: 6, by: { massage: 4, acupuncture: 2 }, away: 0, idle: 0, consults: 2, fed: 6, machines: [] },
    staffed: 1.6,
    lines: 0.92,
    difficulty: 1,
    tables: 28,
    machines: [],
    seconds: 180 / 28,
    perMonth: 28,
    ...over,
  });
  const boardwalk = centerOf(newGame('boardwalk'));
  const { base, station, consult } = GUEST_CAP;

  it('gives each factor with the count behind it', () => {
    expect(paceNote(pace(), 50, boardwalk)).toBe(
      'About 28 new guests a month: 9 at 50% reputation, ×1.6 for 6 staffed treatment stations, ×1.9 for the season, ×1.1 for its grade, less 8% kept away by long lines.',
    );
    const plain = { center: 1, time: 1, grade: 1, rival: 1, mishap: 1 };
    // one station, and what another would bring
    expect(
      paceNote(
        pace({
          capacity: { stations: 1, by: { massage: 1 }, away: 0, idle: 0, consults: 1, fed: 1, machines: [] },
          staffed: 1,
          parts: plain,
          lines: 1,
          perMonth: 9,
        }),
        50,
        boardwalk,
      ),
    ).toBe(
      'About 9 new guests a month: 9 at 50% reputation, 1 staffed treatment station (each one more brings 12% more).',
    );
    // more stations than the consultations keep in guests
    expect(
      paceNote(
        pace({
          capacity: { stations: 7, by: {}, away: 0, idle: 0, consults: 1, fed: 4, machines: [] },
          staffed: 1.36,
          parts: plain,
          lines: 1,
          perMonth: 12,
        }),
        40,
        boardwalk,
      ),
    ).toBe(
      'About 12 new guests a month: 9 at 40% reputation, ×1.36 for 4 of 7 staffed treatment stations (1 Consultation Room keeps only 4 in guests).',
    );
  });

  it('names the stations that draw nobody, and why', () => {
    expect(capacityNote(pace().capacity)).toBeNull();
    expect(capacityNote({ stations: 7, by: {}, away: 1, idle: 2, consults: 1, fed: 4, machines: [] })).toBe(
      '3 staffed treatment stations draw nobody more: every guest is seen in a Consultation Room first, and each keeps only 4 stations in guests. Another would let them draw, and let more in at once. 2 treatment stations have nobody on the payroll to work them: a practitioner for each would bring guests more often and let more in at once. 1 treatment station stands idle while its practitioner is away on a course or a house call, and draws nobody until they are back.',
    );
  });

  it('gives the limit, what it is made of, and who found it full, with the lever', () => {
    const cap = pace().capacity;
    const made = `${base}, and ${station} for each of 6 staffed treatment stations and ${consult} for each of 2 staffed Consultation Rooms`;
    expect(limitNote({ building: 20, own: null, inside: 18, away: 0 }, cap)).toBe(
      `The building lets in 20 guests at once: ${made}. 18 in now. Nobody has found it full this month.`,
    );
    expect(limitNote({ building: 20, own: 12, inside: 12, away: 5 }, cap)).toBe(
      `The building lets in 20 guests at once: ${made}. 12 in now. Your own limit is 12. 5 guests found it full this month and went elsewhere, with their fees: another staffed treatment station lets in ${station} more, or raise your own limit.`,
    );
    // where the consultation holds the stations back, a Consultation Room is the lever
    expect(
      limitNote({ building: 14, own: null, inside: 14, away: 3 }, { ...cap, stations: 7, consults: 1, fed: 4 }),
    ).toContain(`another staffed Consultation Room lets in ${consult + station * 3} more.`);
  });

  it("is in the date's hover as well", () => {
    expect(calendarTip(10, boardwalk, { p: pace(), reputation: 50 })).toBe(
      `Date and weather Winter: ×${boardwalk.seasons!.winter} the usual guests. Spring (×1) from day 1 of month 3, in 50 days. ${paceNote(pace(), 50, boardwalk)}`,
    );
  });
});

describe('a long line', () => {
  it('puts nobody off up to three waiting for each place, then a tenth more for each, up to half', () => {
    expect(lineFactor(0, 2)).toBe(1);
    expect(lineFactor(6, 2)).toBe(1);
    expect(lineFactor(8, 2)).toBeCloseTo(1 - LINE_PUT_OFF.each);
    expect(lineFactor(100, 1)).toBe(1 - LINE_PUT_OFF.most);
    // with nobody to see them, guests wait as if for one
    expect(lineFactor(5, 0)).toBeCloseTo(0.8);
  });

  it('counts the guests waiting for a discipline and lowers its pull', () => {
    const c = openCenter(1);
    runUntil(c.sim, () => c.s.guests.length >= 1, 300);
    const before = c.sim.demand().find((r) => r.discipline === 'massage')!;
    expect(before.line).toMatchObject({ places: 1, factor: 1 });
    // six guests waiting for the one therapist, as diagnosed guests do
    const g = c.s.guests[0]!;
    const massage = CONDITIONS.find((x) => MODALITIES[x.modality].discipline === 'massage')!;
    for (let i = 0; i < 6; i++)
      c.s.guests.push({ ...g, id: 9000 + i, goal: 'treat', state: 'waiting', condition: massage.id });
    const row = c.sim.demand().find((r) => r.discipline === 'massage')!;
    expect(row.line.waiting).toBeGreaterThanOrEqual(6);
    expect(row.line.factor).toBeLessThan(1);
    expect(row.pull).toBeCloseTo((before.pull * row.line.factor) / before.line.factor);
  });

  it('keeps those it puts off away altogether, so guests arrive less often', () => {
    /** A discipline drawing so many guests before its line puts some off. */
    const row = (pull: number, factor: number) =>
      ({ pull: pull * factor, line: { waiting: 0, places: 1, factor } }) as DisciplineDemand;
    expect(lineArrivals([])).toBe(1);
    expect(lineArrivals([row(1, 1), row(1, 1)])).toBe(1);
    // half of one of two equal disciplines put off: a quarter fewer guests in all
    expect(lineArrivals([row(1, 1), row(1, 0.5)])).toBeCloseTo(0.75);
  });
});

describe('the Guests panel', () => {
  const base: DisciplineDemand = {
    discipline: 'sound',
    popularity: 0.6,
    following: 50,
    followed: 1.5,
    room: { pull: 2 },
    conditions: 3,
    trained: 3,
    training: 1,
    untrained: [],
    line: { waiting: 0, places: 1, factor: 1 },
    flavour: 1,
    pull: 1.8,
    share: 0.3,
  };

  it('puts multipliers and words to the factors', () => {
    expect(times(1)).toBe('×1');
    expect(times(1.25)).toBe('×1.25');
    expect(times(0.6)).toBe('×0.6');
    expect(popularityWord(1)).toBe('Everyday');
    expect(popularityWord(0.6)).toBe('Niche');
    expect(followingWord(5)).toBe('Barely known');
    expect(followingWord(75)).toBe('Talked about everywhere');
  });

  it('says how long a line is, and that it puts guests off before anything else', () => {
    const long = { ...base, discipline: 'massage' as const, line: { waiting: 8, places: 2, factor: 0.9 } };
    expect(lineWord(long)).toBe('8 waiting for 2 Massage Therapists');
    expect(lineWord({ ...base, line: { waiting: 3, places: 4, factor: 1 } })).toBe('3 waiting for 4 mats');
    expect(lineWord({ ...base, line: { waiting: 2, places: 0, factor: 1 } })).toBe('2 waiting');
    expect(demandAdvice({ ...long, untrained: ['swedish'] })).toMatch(
      /^The line for massage therapy is putting new guests off: 8 waiting for 2 Massage Therapists\./,
    );
  });

  it('advises training first, then word of mouth, then the room, and nothing when all is well', () => {
    expect(demandAdvice({ ...base, untrained: ['forks'], trained: 2 })).toMatch(
      /^Guests needing Tuning Forks mostly stay away/,
    );
    expect(demandAdvice({ ...base, following: 10 })).toMatch(/^Few have heard of sound healing here yet/);
    expect(demandAdvice({ ...base, room: { pull: 1.1 } })).toMatch(
      /^A finer, quieter Sound Bath Studio would draw more/,
    );
    expect(demandAdvice(base)).toBeNull();
  });
});
