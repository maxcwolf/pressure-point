// Sound healing: a Sound Bath Studio where guests lie on mats while one Sound Healer plays for them all.
import { describe, expect, it } from 'vitest';

import {
  CENTERS,
  type ConditionId,
  conditionOf,
  MODALITIES,
  NOISE_NOTICE,
  ROOM_PULL,
  ROOMS,
  SESSION_WAIT,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { contextAnnouncement } from '../../src/core/sim/advisor';
import { prestige } from '../../src/core/sim/ambience';
import { createContext } from '../../src/core/sim/context';
import { bestRoom, roomPull } from '../../src/core/sim/demand';
import { rollCondition } from '../../src/core/sim/guests';
import { noiseAt, updateNoise } from '../../src/core/sim/noise';
import { leadOf, sessionPlaying, sessionWait } from '../../src/core/sim/sessions';
import type { Sim } from '../../src/core/sim/sim';
import { SOLD_BOWLS } from '../../src/core/state/game';
import type { GameState, Item } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { pullNote } from '../../src/ui/lib/demand';
import { sessionNote } from '../../src/ui/lib/sessions';
import {
  addReiki,
  addSound,
  addTraining,
  hire,
  inconsistencies,
  LAYOUT,
  openCenter,
  run,
  runUntil,
  treatmentCourses,
} from './helpers';

/** A center with a Sound Bath Studio open and a Sound Healer hired. */
function withStudio(seed = 1) {
  const c = openCenter(seed);
  c.s.stars = 1;
  const studio = addSound(c.sim);
  const healer = hire(c.sim, 'healer');
  const mats = c.s.items.filter((i) => i.type === 'sound_mat');
  const bowls = c.s.items.find((i) => i.type === 'singing_bowls')!;
  return { ...c, studio, healer, mats, bowls };
}

/** Play on, turning every guest not yet diagnosed into one condition. */
function playWith(sim: Sim, condition: ConditionId, seconds: number, each?: () => void) {
  for (let i = 0; i < seconds; i++) {
    for (const g of sim.s.guests) if (g.diagnosis === 0) g.condition = condition;
    run(sim, 1);
    each?.();
  }
}

/** The guests lying on the mats right now. */
const lying = (sim: Sim, mats: Item[]) => mats.filter((m) => sim.guest(m.serving)?.state === 'served').length;

describe('a group session', () => {
  it('waits for the mats to fill, or for the wait to run out, and plays until they empty', () => {
    expect(sessionWait(0, 0, 3, 1)).toBe(0);
    expect(sessionWait(0, 1, 3, 1)).toBe(1);
    expect(sessionPlaying(sessionWait(0, 1, 3, 1))).toBe(false);
    expect(sessionWait(SESSION_WAIT - 0.5, 1, 3, 1)).toBe(SESSION_WAIT);
    expect(sessionWait(0, 3, 3, 0.1), 'every mat taken').toBe(SESSION_WAIT);
    expect(sessionWait(SESSION_WAIT, 1, 3, 0.1), 'once started, it plays on').toBe(SESSION_WAIT);
    expect(sessionWait(SESSION_WAIT, 0, 3, 0.1), 'over once the mats are empty').toBe(0);
    expect(sessionPlaying(SESSION_WAIT)).toBe(true);
  });
});

describe('offering sound healing', () => {
  it('opens at the first star, in the sandbox, High Pines and The Orchard Estate only', () => {
    const { sim, s } = openCenter(1);
    expect(ROOMS.sound.unlock).toBe(1);
    expect(sim.unlocked('sound')).toBe(false);
    s.stars = 1;
    expect(sim.unlocked('sound')).toBe(true);
    expect(sim.unlocked('gong')).toBe(false);
    s.stars = 3;
    expect(sim.unlocked('overtone')).toBe(true);
    const here = Object.values(CENTERS).filter((c) => c.disciplines.includes('sound'));
    expect(here.map((c) => c.id).sort()).toEqual(['highpines', 'orchard', 'sandbox']);
  });

  it('takes the Singing Bowls and two mats to build', () => {
    expect(ROOMS.sound.required).toEqual(['singing_bowls', 'sound_mat', 'sound_mat']);
  });

  it('has healers who arrive knowing Singing Bowls and train only in sound techniques', () => {
    const { sim, s } = openCenter(1);
    s.stars = 3;
    addTraining(sim);
    const healer = hire(sim, 'healer');
    expect(healer.quals).toContain('sound');
    healer.quals = ['sound'];
    expect(treatmentCourses(sim.courses(healer))).toEqual(['forks', 'gong', 'crystalbowls', 'overtone']);
    expect(sim.train(healer.id, 'usui')).toBe(false);
  });
});

describe('treating guests on the mats', () => {
  it('has the healer posted at the bowls, and nobody at the mats', () => {
    const { sim, healer, mats, bowls } = withStudio(1);
    runUntil(sim, () => healer.state === 'atPost', 200);
    expect(healer.post).toBe(bowls.id);
    for (const m of mats) {
      expect(m.staffId).toBe(0);
      expect(sim.stationStaff(m)).toBe(healer);
    }
  });

  it('serves two guests at once, and heals them', () => {
    const { sim, s, mats } = withStudio(2);
    let together = 0;
    playWith(sim, 'tune', 900, () => {
      if (lying(sim, mats) === 2 && mats.every((m) => m.progress > 0)) together++;
    });
    expect(together, 'both mats progressing in the same session').toBeGreaterThan(0);
    expect(s.stats.healedBy.sound ?? 0).toBeGreaterThan(3);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('sends guests on the mats back to the line when the healer leaves mid-session', () => {
    const { sim, healer, mats } = withStudio(1);
    playWith(sim, 'tune', 600);
    runUntil(sim, () => lying(sim, mats) > 0, 600);
    sim.fire(healer.id);
    expect(lying(sim, mats)).toBe(0);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('waits for the second mat before it starts, but not for long', () => {
    const { sim, s, mats, bowls, healer } = withStudio(3);
    runUntil(sim, () => healer.state === 'atPost', 200);
    // only one guest in the whole center, sent to a mat
    runUntil(sim, () => s.guests.some((g) => g.goal === 'consult'), 300);
    s.guests.splice(1);
    const g = s.guests[0]!;
    g.condition = 'tune';
    g.diagnosis = 1;
    g.goal = 'treat';
    runUntil(sim, () => lying(sim, mats) === 1, 120);
    const mat = mats.find((m) => m.serving === g.id)!;
    run(sim, SESSION_WAIT / 2);
    expect(mat.progress).toBe(0);
    expect(sessionPlaying(bowls.progress)).toBe(false);
    run(sim, SESSION_WAIT);
    expect(mat.progress).toBeGreaterThan(0);
  });

  it('calls nobody to the mats without a healer, and asks for one', () => {
    const { sim, s } = openCenter(4);
    s.stars = 1;
    addSound(sim);
    const mats = s.items.filter((i) => i.type === 'sound_mat');
    playWith(sim, 'tune', 400);
    expect(lying(sim, mats)).toBe(0);
    const mat = mats.find((m) => m.queue.length >= 2);
    if (mat) expect(contextAnnouncement(createContext(s))).toBe('Sound Healer needed at the Sound Bath Studio.');
  });

  it('needs a Gong for a Gong Bath, and Crystal Bowls for Crystal Bowls', () => {
    const { sim, s, mats, healer } = withStudio(5);
    s.stars = 3;
    healer.quals = ['sound', 'forks', 'gong', 'crystalbowls', 'overtone'];
    const mat = mats[0]!;
    expect(sim.deliveryProblem(mat, healer, MODALITIES.gong)).toBe('no-equipment');
    expect(sim.deliveryProblem(mat, healer, MODALITIES.crystalbowls)).toBe('no-equipment');
    expect(sim.deliveryProblem(mat, healer, MODALITIES.forks)).toBe('');
    const { x, y } = LAYOUT.sound.rect;
    expect(sim.placeItem('gong', x + 2, y + 3, 0)).toBeNull();
    expect(sim.placeItem('crystal_bowls', x + 3, y + 3, 0)).not.toBeNull();
    expect(sim.deliveryProblem(mat, healer, MODALITIES.crystalbowls)).toBe('');
  });
});

describe('the noise of a gong', () => {
  it('carries outside the studio while a session plays, and never counts against the session itself', () => {
    const { sim, s, mats, bowls } = withStudio(6);
    s.stars = 2;
    const ctx = createContext(s);
    const { x, y } = LAYOUT.sound.rect;
    // turned to stand along the left wall, out of everyone's way
    expect(sim.placeItem('gong', x, y + 2, 1)).not.toBeNull();
    const corridor = { x: x + 1, y: y + 5 };
    runUntil(sim, () => s.guests.length > 0, 300);
    updateNoise(ctx);
    const quiet = { out: noiseAt(ctx, corridor.x, corridor.y), on: noiseAt(ctx, mats[0]!.x, mats[0]!.y) };
    // a session under way, with a guest on the mat
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    bowls.progress = SESSION_WAIT;
    mats[0]!.serving = g.id;
    g.state = 'served';
    g.station = mats[0]!.id;
    expect(leadOf(ctx, mats[0]!)).toBe(bowls);
    updateNoise(ctx);
    expect(noiseAt(ctx, corridor.x, corridor.y)).toBeGreaterThan(quiet.out + 1);
    expect(noiseAt(ctx, mats[0]!.x, mats[0]!.y)).toBeCloseTo(quiet.on, 5);
  });
});

describe('a fine Sound Bath Studio', () => {
  /** What a studio should draw, from its prestige, how peaceful its mats are, and how many there are. */
  const expected = (stars: number, calm: number, mats: number) =>
    Math.min(ROOM_PULL.max, 1 + ROOM_PULL.star * (stars - 1) + ROOM_PULL.calm * calm + ROOM_PULL.mat * (mats - 2));

  it('draws more guests who need sound healing: for its prestige, its peace and its mats to spare', () => {
    const { sim, s, studio } = withStudio(1);
    let ctx = createContext(s);
    updateNoise(ctx);
    const peaceful = roomPull(ctx, studio);
    expect(peaceful).toBeCloseTo(expected(prestige(ctx, studio), 1, 2), 5);
    expect(bestRoom(ctx, 'sound')).toEqual({ room: studio, pull: peaceful });
    // noisy enough that guests on the mats would say so
    ctx.noise.fill(NOISE_NOTICE);
    expect(roomPull(ctx, studio)).toBeCloseTo(peaceful - ROOM_PULL.calm, 5);
    // a third mat, in a room made bigger for it
    expect(sim.resizeRoom(studio.id, { x: 9, y: 10, w: 5, h: 4 })).toBe(true);
    expect(sim.placeItem('sound_mat', 9, 11, 0)).toBeTruthy();
    ctx = createContext(s);
    updateNoise(ctx);
    expect(roomPull(ctx, studio)).toBeCloseTo(expected(prestige(ctx, studio), 1, 3), 5);
  });

  it('draws nobody extra without a finished studio', () => {
    const { s } = openCenter(1);
    expect(bestRoom(createContext(s), 'sound')).toEqual({ pull: 1 });
  });

  it('makes guests who need sound healing turn up more often', () => {
    const { s, studio } = withStudio(1);
    /** The share of new guests who need sound healing, with this much noise in the studio. */
    const share = (noise: number) => {
      setSeed(4);
      const ctx = createContext(s);
      for (let y = studio.y; y < studio.y + studio.h; y++)
        for (let x = studio.x; x < studio.x + studio.w; x++) ctx.noise[ctx.world.idx(x, y)] = noise;
      let hits = 0;
      for (let i = 0; i < 3000; i++) if (conditionOf(rollCondition(ctx)).modality === 'sound') hits++;
      return hits / 3000;
    };
    expect(share(0)).toBeGreaterThan(share(NOISE_NOTICE) + 0.04);
  });

  it('says in the inspector how strongly it draws', () => {
    expect(pullNote(1, 'sound')).toBe(
      '🔔 A prestigious, peaceful room with mats to spare draws more guests who want sound healing.',
    );
    expect(pullNote(2.24, 'sound')).toBe(
      '🔔 Draws 2.2× the usual guests for sound healing, for its prestige, its peace and its mats.',
    );
    expect(pullNote(1.5, 'reiki')).toBe('✨ Draws 1.5× the usual guests for reiki, for its prestige and its peace.');
  });
});

describe('selling a Sound Mat', () => {
  it('is not allowed while the studio has only the two it requires, and is once it has a third', () => {
    const { sim, s, studio, mats } = withStudio(1);
    const money = s.money;
    for (const m of mats) expect(sim.canSell(m)).toBe(false);
    sim.sellItem(mats[0]!.id);
    expect(s.items).toContain(mats[0]);
    expect(s.money).toBe(money);
    expect(sim.missingItems(studio)).toEqual([]);
    // room for a third mat
    expect(sim.resizeRoom(studio.id, { x: 9, y: 10, w: 5, h: 4 })).toBe(true);
    const third = sim.placeItem('sound_mat', 9, 11, 0)!;
    expect(third).toBeTruthy();
    expect(sim.canSell(third)).toBe(true);
    sim.sellItem(third.id);
    expect(sim.missingItems(studio)).toEqual([]);
    expect(sim.canSell(mats[0]!)).toBe(false);
  });
});

describe('a broken Sound Mat', () => {
  it('sends whoever is lying on it back to the line, rather than leave them there for good', () => {
    const { sim, s, mats } = withStudio(1);
    let on: Item | undefined;
    for (let i = 0; i < 600 && !on; i++) {
      playWith(sim, 'tune', 1);
      on = mats.find((m) => sim.guest(m.serving)?.state === 'served');
    }
    expect(on, 'someone lay down on a mat').toBeTruthy();
    const g = sim.guest(on!.serving)!;
    // no Caretaker to mend it
    expect(s.staff.some((st) => st.role === 'caretaker')).toBe(false);
    on!.wear = 100;
    run(sim, 1);
    expect(on!.serving).toBe(0);
    expect(g.state).not.toBe('served');
    expect(g.station).not.toBe(on!.id);
    expect(inconsistencies(sim)).toEqual([]);
    // and in time their visit ends one way or another
    runUntil(sim, () => !s.guests.includes(g) || g.state === 'leaving', 900);
  });
});

describe('a save from before sound healing', () => {
  it('sells back Singing Bowls left in a Reiki Studio, and practitioners forget the sound bath', () => {
    const { sim, s } = openCenter(7);
    s.stars = 3;
    addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    const { x, y, w, h } = LAYOUT.reiki.rect;
    old.items.push({ ...old.items[0]!, id: 99999, type: 'singing_bowls', x: x + w - 1, y: y + h - 1, rot: 0 });
    old.staff.find((st) => st.id === practitioner.id)!.quals = ['usui', 'sound'];
    const money = old.money;
    upgradeSave(old);
    expect(old.items.some((i) => i.type === 'singing_bowls')).toBe(false);
    expect(old.money).toBe(money + SOLD_BOWLS);
    expect(old.staff.find((st) => st.id === practitioner.id)!.quals).toEqual(['usui']);
  });

  it('gives back the fee for a sound bath course a practitioner was part-way through', () => {
    const { sim, s } = openCenter(7);
    s.stars = 3;
    addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    const student = old.staff.find((st) => st.id === practitioner.id)!;
    student.training = { course: 'sound', progress: 0.4, seconds: 600, cost: 750 };
    const money = old.money;
    upgradeSave(old);
    expect(student.training).toBeNull();
    expect(old.money).toBe(money + 750);
  });
});

describe('a long session with sound healing', () => {
  it.each([1, 2])('stays healthy for half an hour of play (seed %i)', (seed) => {
    const { sim, s } = withStudio(seed);
    s.stars = 3;
    let healed = 0;
    for (let second = 0; second < 1800; second++) {
      if (s.offer) sim.acceptEmergency();
      for (const st of s.staff) if (st.raiseAsked) sim.giveRaise(st.id);
      run(sim, 1);
      if (second % 60 === 0) expect(inconsistencies(sim)).toEqual([]);
      healed = s.stats.healedBy.sound ?? 0;
    }
    expect(healed).toBeGreaterThan(0);
    expect(Number.isFinite(s.money)).toBe(true);
  });
});

describe('what the inspector says about a session', () => {
  it('says how many mats are taken, and whether it is playing or waiting', () => {
    expect(sessionNote(0, 2, false)).toBe('Mats free: 2 · waiting for guests');
    expect(sessionNote(1, 2, false)).toBe('1 of 2 mats taken · waiting a moment for more');
    expect(sessionNote(2, 2, true)).toBe('Playing for 2 of 2 mats');
    expect(sessionNote(1, 1, true)).toBe('Playing for 1 of 1 mat');
    expect(sessionNote(0, 0, false)).toBe('No mats in the room: place some to play for');
  });
});
