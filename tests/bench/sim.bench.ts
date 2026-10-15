// How long the simulation takes to run as the crowd grows. Timings depend on the machine, so this
// reports rather than fails: run `yarn bench` before and after a change and compare. The figures
// are also written to test-results/bench-sim.json, so CI can keep them.
import { mkdirSync, writeFileSync } from 'node:fs';

import { it } from 'vitest';

import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import type { Sim } from '../../src/core/sim/sim';
import { addPostureLab, addRestroom, addStaffRoom, addTraining, hire, openCenter, run } from '../unit/helpers';

/** The crowd sizes to time. The game itself rarely has more than about fifty guests in at once. */
const CROWDS = [25, 50, 100, 200];

/** A full, staffed center, open for a while. */
function bigCenter() {
  const { sim, s } = openCenter(1);
  addStaffRoom(sim);
  addRestroom(sim);
  addTraining(sim);
  addPostureLab(sim);
  for (const role of ['caretaker', 'consultant', 'therapist', 'receptionist'] as const) hire(sim, role);
  run(sim, 60);
  return { sim, s };
}

/**
 * Let one more guest in, if there are fewer than this many, and keep everyone patient enough to stay for the timing.
 * One at a time, as the game admits them: a whole crowd let in at once would wait in step, every one of them
 * rethinking their place in line in the same frame, which never happens in play.
 */
function admit(sim: Sim, guests: number) {
  const ctx = (sim as unknown as { ctx: SimContext }).ctx;
  if (sim.s.guests.length < guests) spawnGuest(ctx);
  for (const g of sim.s.guests) g.patience = 100;
}

it('times the simulation as the crowd grows', () => {
  const results = CROWDS.map((guests) => {
    const { sim } = bigCenter();
    // a frame at top speed: 0.1 s of real time is 0.3 s of game time
    sim.s.speed = 3;
    // fill the center, untimed, and let it settle
    for (let i = 0; i < guests + 300; i++) {
      admit(sim, guests);
      sim.tick(0.1);
    }
    const frames = 600;
    const times: number[] = [];
    for (let i = 0; i < frames; i++) {
      // making up for those who leave, a guest at a time
      admit(sim, guests);
      const t = performance.now();
      sim.tick(0.1);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    /** The time below which this fraction of frames came in, in milliseconds. */
    const pct = (p: number) => Number((times[Math.min(frames - 1, Math.floor(frames * p))] ?? 0).toFixed(3));
    return { guests, inAtEnd: sim.s.guests.length, medianMs: pct(0.5), p95Ms: pct(0.95), worstMs: pct(1) };
  });
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/bench-sim.json', `${JSON.stringify(results, null, 2)}\n`);
  process.stdout.write('\nsimulation time per frame at top speed\n');
  for (const r of results)
    process.stdout.write(
      `  ${String(r.guests).padStart(4)} guests (${r.inAtEnd} in at the end): median ${r.medianMs} ms, 95% under ${r.p95Ms} ms, worst ${r.worstMs} ms\n`,
    );
});
