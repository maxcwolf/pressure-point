// `yarn balance:report <after.json> [before.json]`: prints the markdown report of one run of `yarn balance`, or of
// two as before → after (tests/balance/report.ts, docs/balance/harness.md). Plain Node: the report is TypeScript
// with nothing to compile but its types, which Node strips by itself.
import { readFileSync } from 'node:fs';

import { report } from '../tests/balance/report.ts';

const [after, before] = process.argv.slice(2);
if (!after) {
  console.error('usage: yarn balance:report <after.json> [before.json]');
  process.exit(1);
}
/** A playtest log, read from its file. */
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
process.stdout.write(`${report(read(after), before ? read(before) : undefined)}\n`);
