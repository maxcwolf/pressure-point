// Sound healing: a Sound Bath Studio where guests lie on mats while one Sound Healer plays for them all.
import { describe, expect, it } from 'vitest';

import { CENTERS, type ConditionId, MODALITIES, ROOMS, SESSION_WAIT } from '../../src/core/data';
import { contextAnnouncement } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { noiseAt, updateNoise } from '../../src/core/sim/noise';
import { leadOf, sessionPlaying, sessionWait } from '../../src/core/sim/sessions';
import type { Sim } from '../../src/core/sim/sim';
import { SOLD_BOWLS } from '../../src/core/state/game';
import type { GameState, Item } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
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
