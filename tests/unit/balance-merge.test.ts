// The merge at the end of `yarn balance`: which games were asked for, and which of them left no log to merge, so a
// short merged log fails the run rather than passing for a whole one.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Playtest } from '../balance/bot';
import { collect, type Game, games, names } from '../balance/merge';

/** The games asked for by `BALANCE_CENTERS=willow,orchard BALANCE_SEEDS=1,2`, in order. */
const [a, b, c, d]: [Game, Game, Game, Game] = [
  { center: 'willow', seed: 1, index: 0 },
  { center: 'willow', seed: 2, index: 1 },
  { center: 'orchard', seed: 1, index: 2 },
  { center: 'orchard', seed: 2, index: 3 },
];
const ASKED = [a, b, c, d];

/** A game's log, with only what the merge reads. */
const log = (game: Game) => ({ center: game.center, seed: game.seed }) as Playtest;

describe('balance merge', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'pressure-point-balance-'));
    vi.stubEnv('BALANCE_CENTERS', 'willow,orchard');
    vi.stubEnv('BALANCE_SEEDS', '1,2');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Writes the log of each game into the parts folder, under its index. */
  const write = (...logs: [number, Playtest][]) => {
    for (const [index, l] of logs) writeFileSync(path.join(dir, `${index}.json`), JSON.stringify(l));
  };

  it('numbers the games center by center and seed by seed', () => {
    expect(games()).toEqual(ASKED);
  });

  it('plays every campaign center with three seeds when asked for nothing', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('BALANCE_CENTERS', undefined);
    vi.stubEnv('BALANCE_SEEDS', undefined);
    expect(games()).toHaveLength(15);
  });

  it('merges every log in order when none is missing', () => {
    write(...ASKED.map((g) => [g.index, log(g)] as [number, Playtest]).reverse());
    expect(collect(dir, games())).toEqual({ logs: ASKED.map(log), missing: [] });
  });

  it('names each game whose log was deleted, and merges the rest', () => {
    write([a.index, log(a)], [c.index, log(c)]);
    const { logs, missing } = collect(dir, games());
    expect(logs).toEqual([log(a), log(c)]);
    expect(missing).toEqual([b, d]);
    expect(names(missing)).toBe('willow seed 2; orchard seed 2');
  });

  it('finds every game missing when the parts folder itself is gone', () => {
    rmSync(dir, { recursive: true });
    expect(names(collect(dir, games()).missing)).toBe('willow seeds 1, 2; orchard seeds 1, 2');
  });

  it("counts another game's log in a game's place as missing", () => {
    write(...ASKED.map((g) => [g.index, log(g)] as [number, Playtest]));
    write([b.index, log({ ...b, center: 'exchange' })]);
    expect(names(collect(dir, games()).missing)).toBe('willow seed 2');
  });
});
