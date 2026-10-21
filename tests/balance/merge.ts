// Vitest's global setup for `yarn balance`: clears the per-run logs before the slots play, and merges them into the
// one file the playtest has always written (test-results/balance.json, or BALANCE_OUT) once they are all done, in the
// order of the centers and seeds asked for.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Playtest } from './bot';

/** Where each run's log is written on its own, as `<run index>.json`. */
export const PARTS = 'test-results/balance-parts';

/** Before the slots play: an empty folder for their logs. */
export function setup() {
  rmSync(PARTS, { recursive: true, force: true });
  mkdirSync(PARTS, { recursive: true });
}

/** After they have all played: their logs in one file, in order. */
export function teardown() {
  const parts = readdirSync(PARTS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ index: Number(f.replace('.json', '')), file: join(PARTS, f) }))
    .sort((a, b) => a.index - b.index);
  const all = parts.map((p) => JSON.parse(readFileSync(p.file, 'utf8')) as Playtest);
  writeFileSync(process.env.BALANCE_OUT ?? 'test-results/balance.json', `${JSON.stringify(all, null, 1)}\n`);
  rmSync(PARTS, { recursive: true, force: true });
}
