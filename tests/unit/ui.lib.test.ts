import { describe, expect, it } from 'vitest';

import { ITEM_MENU, ITEMS, MODALITIES, type Offering, RANK_XP, ROOMS } from '../../src/core/data';
import type { Job } from '../../src/core/state/types';
import { cureShare, seen, starText } from '../../src/ui/lib/casebook';
import {
  available,
  filterItems,
  hireableRoles,
  itemKind,
  itemOffered,
  placeFilters,
  placeLabel,
  placeName,
} from '../../src/ui/lib/catalog';
import { barHeights, CHART_HEIGHT } from '../../src/ui/lib/chart';
import { cx } from '../../src/ui/lib/cx';
import { deliveryNote, disciplineNote } from '../../src/ui/lib/delivery';
import { offerTimeLeft, timeLeftLabel, wholeDaysLeft } from '../../src/ui/lib/emergency';
import { pleasantness } from '../../src/ui/lib/overlays';
import { placedFlags } from '../../src/ui/lib/plan';
import { courseName, guestStatus, promotionNote, staffStatus } from '../../src/ui/lib/status';
import { saveFacts, titleBadges } from '../../src/ui/lib/title';
import { newRoomsText, treatmentsUnlockedAt } from '../../src/ui/lib/unlocks';
import { weatherNote } from '../../src/ui/lib/weather';
import { hire, openCenter, run, runUntil } from './helpers';

/** Every discipline switched on. */
const allOn = () => true;
/** Acupuncture switched off. */
const massageOnly = (d: Offering) => d === 'massage';

describe('joining class names', () => {
  it('keeps what applies and drops the rest', () => {
    expect(cx('card', false, undefined, 'poor', null, '')).toBe('card poor');
    expect(cx()).toBe('');
  });
});

describe('what a blueprint still needs', () => {
  it('ticks off required furniture as it is placed, one tick per piece', () => {
    expect(placedFlags(['toilet', 'sink'], ['sink'])).toEqual([true, false]);
    expect(placedFlags(['toilet', 'sink'], [])).toEqual([true, true]);
  });

  it('counts two of the same item separately', () => {
    expect(placedFlags(['sofa', 'sofa'], ['sofa'])).toEqual([false, true]);
    expect(placedFlags(['sofa', 'sofa'], ['sofa', 'sofa'])).toEqual([false, false]);
  });
});

describe('what the menus offer', () => {
  it('always offers what belongs to no discipline', () => {
    expect(available(undefined, () => false)).toBe(true);
    expect(available('acupuncture', massageOnly)).toBe(false);
    expect(available('acupuncture', allOn)).toBe(true);
  });

  it('lists a discipline role once its room can be built', () => {
    expect(hireableRoles(0, allOn)).not.toContain('acupuncturist');
    expect(hireableRoles(1, allOn)).toContain('acupuncturist');
    expect(hireableRoles(3, massageOnly)).not.toContain('acupuncturist');
    expect(hireableRoles(0, massageOnly)).toEqual(['receptionist', 'consultant', 'therapist', 'caretaker']);
  });

  it('says where an item goes', () => {
    expect(placeLabel(ITEMS.bench)).toBe('Corridor');
    expect(placeLabel(ITEMS.plant)).toBe('Anywhere');
    expect(placeLabel(ITEMS.massage_table)).toBe('Massage Suite');
  });

  it('hides the furniture of a discipline that is switched off', () => {
    expect(itemOffered(ITEMS.acu_table, massageOnly)).toBe(false);
    expect(itemOffered(ITEMS.acu_table, allOn)).toBe(true);
    expect(itemOffered(ITEMS.bench, massageOnly)).toBe(true);
  });
});

describe('the monthly net chart', () => {
  it('scales the biggest month to the full height, whichever way it went', () => {
    expect(barHeights([100, -200, 50])).toEqual([CHART_HEIGHT / 2, CHART_HEIGHT, CHART_HEIGHT / 4]);
  });

  it('keeps a sliver for a month near zero, and copes with no history', () => {
    expect(barHeights([0, 1000])[0]).toBe(4);
    expect(barHeights([0])).toEqual([4]);
    expect(barHeights([])).toEqual([]);
  });
});

describe('why a table can or cannot deliver a treatment', () => {
  it('has nothing to add when all is well, and says so when nobody is there yet', () => {
    expect(deliveryNote('', MODALITIES.swedish, 'Ada Lovelace')).toBe('');
    expect(deliveryNote('', MODALITIES.swedish, undefined)).toBe('once staffed');
  });

  it('names the therapist, the missing equipment or the cold stones', () => {
    expect(deliveryNote('unqualified', MODALITIES.deep, 'Ada Lovelace')).toBe('Ada is not qualified');
    expect(deliveryNote('no-equipment', MODALITIES.stone, 'Ada Lovelace')).toBe('needs a Stone Warmer');
    expect(deliveryNote('cold', MODALITIES.stone, 'Ada Lovelace')).toBe('stones are cold');
  });
});

describe('what it takes to offer a discipline', () => {
  it('says where it is delivered once its room is built', () => {
    expect(disciplineNote('massage', true, 0)).toBe('Delivered in the Massage Suite by Massage Therapists.');
  });

  it('says when its room unlocks', () => {
    expect(disciplineNote('reiki', false, 1)).toBe('The Reiki Studio unlocks at star 2.');
  });

  it('says what to build and whom to hire, in good English', () => {
    expect(disciplineNote('massage', false, 0)).toMatch(/^Build a Massage Suite and hire a Massage Therapist to/);
    expect(disciplineNote('acupuncture', false, 1)).toMatch(
      /^Build an Acupuncture Clinic and hire an Acupuncturist to/,
    );
    expect(disciplineNote('reiki', false, 2)).toMatch(/^Build a Reiki Studio and hire a Reiki Practitioner to/);
  });
});

describe('what a star unlocks', () => {
  it('lists needling at star one', () => {
    expect(treatmentsUnlockedAt(1, allOn).join(' ')).toContain('Needling');
  });

  it('says treatment rooms bring in new guests, and what any other room is for', () => {
    expect(newRoomsText(1, allOn)).toBe(
      `${ROOMS.acupuncture.icon} Acupuncture Clinic, ${ROOMS.sound.icon} Sound Bath Studio. Build one and hire its staff to bring in a new kind of guest. ${ROOMS.recovery.icon} Recovery Lounge: ${ROOMS.recovery.desc}`,
    );
    expect(newRoomsText(1, massageOnly)).toBe(`${ROOMS.recovery.icon} Recovery Lounge: ${ROOMS.recovery.desc}`);
    expect(newRoomsText(3, allOn)).toBe('');
  });

  it('leaves out anything from a discipline that is switched off', () => {
    expect(newRoomsText(1, massageOnly)).not.toContain('Acupuncture');
    expect(treatmentsUnlockedAt(1, massageOnly).join(' ')).not.toContain('Needling');
  });
});

describe('describing what people are doing', () => {
  it('names courses', () => {
    expect(courseName('skill')).toBe('professional development');
    expect(courseName('deep')).toBe('Deep Tissue massage');
  });

  it('follows a guest from the door to the way home', () => {
    const { sim, s } = openCenter(3);
    runUntil(sim, () => s.guests.length > 0, 120);
    const g = s.guests[0]!;
    expect(guestStatus(g, sim)).toBe('Arriving');
    runUntil(sim, () => g.state === 'served' && g.goal === 'reception', 120);
    expect(guestStatus(g, sim)).toBe('Checking in');
    runUntil(sim, () => g.state === 'leaving', 600);
    expect(guestStatus(g, sim)).toMatch(/^(Going home healed|Going home, still knotted|Leaving in a huff|Leaving)$/);
  });

  it('says what staff are up to', () => {
    const { sim } = openCenter(3);
    const caretaker = hire(sim, 'caretaker');
    expect(staffStatus(caretaker, sim)).toBe('Arriving for their first day');
    runUntil(sim, () => caretaker.state === 'idle', 60);
    expect(staffStatus(caretaker, sim)).toBe('Looking for something to clean');
    run(sim, 1);
    const receptionist = sim.s.staff.find((x) => x.role === 'receptionist')!;
    runUntil(sim, () => receptionist.state === 'atPost', 60);
    expect(staffStatus(receptionist, sim)).toMatch(/^(Working|Waiting for a guest)$/);
  });

  it('says which chore someone is on, not litter for every one that is not watering', () => {
    const { sim, s, massage } = openCenter(3);
    const caretaker = hire(sim, 'caretaker');
    const table = s.items.find((i) => i.type === 'massage_table')!;
    const hamper = sim.placeItem('linen_hamper', 16, 10, 0)!;
    const cooler = sim.placeItem('water_cooler', 18, 10, 0)!;
    caretaker.state = 'doingJob';
    /** What the Caretaker is said to be doing on a chore. */
    const on = (kind: Job['kind'], id: number) => {
      caretaker.job = { kind, id };
      return staffStatus(caretaker, sim);
    };
    expect(on('clean', table.id)).toBe('Changing the linens');
    expect(on('launder', hamper.id)).toBe('Laundering the linens');
    expect(on('refresh', cooler.id)).toBe('Getting a drink');
    expect(on('smudge', massage.id)).toBe('Clearing bad vibes with sage');
  });
});

describe('the title screen', () => {
  const info = { id: 'auto', name: 'Autosave', savedAt: 0, day: 0, money: 12345, stars: 1, healed: 26 };

  it('sums up the latest save in a few lines', () => {
    expect(saveFacts(info).map((f) => f.text)).toEqual(['1 star', '$12,345', '26 healed', 'Day 1, Month 1, Year 1']);
    expect(saveFacts({ ...info, stars: 2 })[0]?.text).toBe('2 stars');
  });

  it('lights a badge for each discipline new games include, and dims those switched off', () => {
    const badges = titleBadges(allOn);
    expect(badges.map((b) => b.on)).toEqual([true, true, true, true, true]);
    expect(badges.at(-1)?.label).toBe('Shamanism: open for business');
    const off = titleBadges(massageOnly);
    expect(off[1]).toMatchObject({ on: false, label: 'Acupuncture: switched off in Settings' });
    // massage cannot be switched off, so its badge stays lit whatever is asked
    expect(titleBadges(() => false)[0]?.on).toBe(true);
  });
});

describe('filtering the Items menu', () => {
  it('sorts every item into a kind by what it is for', () => {
    expect(itemKind('reception_desk')).toBe('equipment');
    expect(itemKind('stone_warmer')).toBe('equipment');
    expect(itemKind('singing_bowls')).toBe('equipment');
    expect(itemKind('bench')).toBe('comfort');
    expect(itemKind('arcade_machine')).toBe('comfort');
    expect(itemKind('bin')).toBe('comfort');
    expect(itemKind('toilet')).toBe('comfort');
    expect(itemKind('statue')).toBe('decor');
    expect(itemKind('plant')).toBe('decor');
    expect(itemKind('sofa')).toBe('staff');
    expect(itemKind('bookcase')).toBe('staff');
  });

  it('offers a filter for the corridors and for each room that has items of its own', () => {
    const places = placeFilters(ITEM_MENU);
    expect(places.slice(0, 2)).toEqual(['all', 'corridor']);
    expect(places).toEqual(expect.arrayContaining(['massage', 'acupuncture', 'reiki', 'staffroom', 'training']));
    expect(places).not.toContain('consult');
    expect(placeName('all')).toBe('Everywhere');
    expect(placeName('reiki')).toBe('Reiki Studio');
  });

  it("shows a room's own items and whatever can go anywhere, of the kind asked for", () => {
    const studio = filterItems(ITEM_MENU, 'reiki', 'all');
    expect(studio).toEqual(expect.arrayContaining(['crystal_grid', 'plant', 'statue']));
    expect(studio).not.toContain('bench');
    expect(filterItems(ITEM_MENU, 'reiki', 'equipment')).toEqual(['crystal_grid']);
    expect(filterItems(ITEM_MENU, 'sound', 'equipment')).toEqual(['sound_mat', 'gong', 'crystal_bowls']);
    const corridorDecor = filterItems(ITEM_MENU, 'corridor', 'decor');
    expect(corridorDecor).toEqual(expect.arrayContaining(['fountain', 'statue']));
    expect(corridorDecor.every((t) => ['corridor', 'any'].includes(ITEMS[t].where))).toBe(true);
    expect(filterItems(ITEM_MENU, 'all', 'all')).toEqual([...ITEM_MENU]);
    expect(filterItems(ITEM_MENU, 'restroom', 'staff')).toEqual([]);
  });
});

describe('the time left on an emergency offer', () => {
  it('runs down from the whole offer to nothing', () => {
    expect(offerTimeLeft(18, 10)).toEqual({ days: 8, share: 1 });
    expect(offerTimeLeft(18, 14)).toEqual({ days: 4, share: 0.5 });
    expect(offerTimeLeft(18, 20)).toEqual({ days: 0, share: 0 });
  });

  it('is said in whole days, and less than a day at the end', () => {
    expect(timeLeftLabel(4.2)).toBe('5 days left');
    expect(timeLeftLabel(1)).toBe('1 day left');
    expect(timeLeftLabel(0.4)).toBe('less than a day left');
  });

  it('is not a day out when the days left come out a hair over a whole number', () => {
    // offered on day 1.3 with eight days to decide, then five days on: (1.3 + 8) - (1.3 + 5) is 3.000000000000001
    const { days } = offerTimeLeft(1.3 + 8, 1.3 + 5);
    expect(timeLeftLabel(days)).toBe('3 days left');
    expect(wholeDaysLeft(days)).toBe(3);
    expect(wholeDaysLeft(2.5)).toBe(3);
    expect(wholeDaysLeft(-1)).toBe(0);
  });
});

describe('the casebook', () => {
  it('counts every way a visit ended, and the share of treatments that worked', () => {
    const c = { healed: 6, failed: 2, stormed: 1, sent: 1, priced: 3, worse: 2 };
    expect(seen(c)).toBe(15);
    expect(cureShare(c)).toBe(75);
    expect(cureShare({ ...c, healed: 0, failed: 0 })).toBeNull();
  });

  it('shows a review as filled and empty stars', () => {
    expect(starText(3)).toBe('★★★☆☆');
    expect(starText(5)).toBe('★★★★★');
  });
});

describe('the overlays', () => {
  it('rate a spot from how fast patience drains there', () => {
    expect(pleasantness(1.12)).toBe(0.5);
    expect(pleasantness(0.87)).toBeCloseTo(1);
    expect(pleasantness(1.37)).toBeCloseTo(0);
    expect(pleasantness(0.7)).toBe(1);
    expect(pleasantness(1.4)).toBe(0);
  });
});

describe('what a promotion still needs', () => {
  it('says to fill the slots when the experience is there but the training is not', () => {
    const { receptionist } = openCenter(1);
    receptionist.skill = 2;
    receptionist.general = ['service'];
    receptionist.xp = RANK_XP[1]! + 1;
    // not enough experience yet: nothing to say
    expect(promotionNote(receptionist, false)).toBe('');
    receptionist.xp = RANK_XP[2]!;
    expect(promotionNote(receptionist, false)).toBe(
      'To be promoted, fill every qualification slot (1 of 2 filled) with a course in a Training Room.',
    );
    // fully trained, or already asking: nothing more is needed
    expect(promotionNote(receptionist, true)).toBe('');
    receptionist.promotion = true;
    expect(promotionNote(receptionist, false)).toBe('');
  });
});

describe('the weather beside the date', () => {
  it('says how warm it is outside, and whether that calls for heating or cooling', () => {
    expect(weatherNote(68.4, true)).toMatchObject({ text: '68°F', need: '' });
    const cold = weatherNote(28, true);
    expect(cold).toMatchObject({ text: '28°F', need: 'heat' });
    expect(cold?.title).toBe(
      '28°F outside. Indoors it is about 50°F before any heating or cooling: too cold, so Radiators are needed.',
    );
    expect(weatherNote(100, true)?.need).toBe('cool');
    expect(weatherNote(100, true)?.title).toMatch(/Air Conditioners are needed/);
  });

  it('says nothing with the weather switched off', () => {
    expect(weatherNote(28, false)).toBeNull();
  });
});
