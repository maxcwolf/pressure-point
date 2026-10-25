// Vitest's global setup for `yarn balance`: clears the per-game logs before the slots play, and merges them into the
// one file the playtest has always written (balance-results/balance.json, or BALANCE_OUT) once they are all done, in
// the order of the centers and seeds asked for. Both live in balance-results/, not test-results/: Playwright empties
// test-results/ whenever one of its runs starts, and an e2e run started beside `yarn balance` once took 44 of its 65
// games' logs without a word (25 October 2026). A game with no log now fails the run, by center and seed.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CAMPAIGN, type CenterId } from '../../src/core/data';
import type { Playtest } from './bot';

/** Where each game's log is written on its own, as `<game index>.json`. */
export const PARTS = 'balance-results/parts';

/** A game asked for: its center, its seed, and its place in the merged log. */
export interface Game {
  center: CenterId;
  seed: number;
  index: number;
}

/** Every game asked for, center by center and seed by seed, numbered in that order. */
export function games(): Game[] {
  /** Seeds per center, so one lucky run does not mislead. */
  const seeds = (process.env.BALANCE_SEEDS ?? '1,2,3').split(',').map(Number);
  const centers = (process.env.BALANCE_CENTERS?.split(',') ?? CAMPAIGN) as CenterId[];
  return centers
    .flatMap((center) => seeds.map((seed) => ({ center, seed })))
    .map((game, index) => ({ ...game, index }));
}

/**
 * The logs in `dir` of the games asked for, in order, and the games with none. A log for another game in a game's
 * place, from a second `yarn balance` in the same checkout, counts as none.
 */
export function collect(dir: string, asked: Game[]): { logs: Playtest[]; missing: Game[] } {
  const logs: Playtest[] = [];
  const missing: Game[] = [];
  for (const game of asked) {
    const file = join(dir, `${game.index}.json`);
    const log = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Playtest) : null;
    if (log?.center === game.center && log.seed === game.seed) logs.push(log);
    else missing.push(game);
  }
  return { logs, missing };
}

/** Games by center, as `willow seeds 2, 3; orchard seed 1`. */
export function names(games: Game[]): string {
  const seeds = new Map<CenterId, number[]>();
  for (const { center, seed } of games) seeds.set(center, [...(seeds.get(center) ?? []), seed]);
  return [...seeds].map(([center, s]) => `${center} ${s.length === 1 ? 'seed' : 'seeds'} ${s.join(', ')}`).join('; ');
}

/** Before the slots play: an empty folder for their logs. */
export function setup() {
  rmSync(PARTS, { recursive: true, force: true });
  mkdirSync(PARTS, { recursive: true });
}

/** After they have all played: their logs in one file, in order, and the run failed if any game has none. */
export function teardown() {
  const asked = games();
  const { logs, missing } = collect(PARTS, asked);
  const out = process.env.BALANCE_OUT ?? 'balance-results/balance.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(logs, null, 1)}\n`);
  rmSync(PARTS, { recursive: true, force: true });
  if (missing.length > 0)
    throw new Error(
      `${out} is short: it has ${logs.length} of the ${asked.length} games asked for. No log for ${names(missing)}. ` +
        `A game that failed leaves none, and so does anything that empties ${PARTS} while the slots play.`,
    );
}
