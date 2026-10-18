// How smoothly the game draws, for the play statistics: the time each frame took, kept as counts rather than a list, so
// a long session costs no more memory than a short one.

import type { PlayProps } from './play-events';

/** A frame longer than this is a hitch the player can see: the game stops for a moment. */
export const HITCH_MS = 100;
/** Frames a second below which play feels slow. */
export const SLOW_FPS = 30;

/** Frame times and frame rates, as counts of how often each whole number came up. */
export class FrameStats {
  /** Frames seen at each whole number of milliseconds. */
  private readonly times = new Map<number, number>();
  /** Seconds seen at each whole frame rate. */
  private readonly rates = new Map<number, number>();
  private frames = 0;
  private hitches = 0;
  private longest = 0;
  /** Frames drawn in the second so far. */
  private thisSecond = 0;

  /** Note a frame that took this long. */
  frame(ms: number) {
    const whole = Math.round(ms);
    this.times.set(whole, (this.times.get(whole) ?? 0) + 1);
    this.frames++;
    this.thisSecond++;
    if (ms > HITCH_MS) this.hitches++;
    this.longest = Math.max(this.longest, ms);
  }

  /** A second has gone by: note how many frames it had. */
  second() {
    this.rates.set(this.thisSecond, (this.rates.get(this.thisSecond) ?? 0) + 1);
    this.thisSecond = 0;
  }

  /** The frame rate and frame times so far, for a summary: nothing until a second has been seen. */
  props(): PlayProps {
    const seconds = [...this.rates.values()].reduce((sum, n) => sum + n, 0);
    if (!seconds || !this.frames) return {};
    const slow = [...this.rates].filter(([fps]) => fps < SLOW_FPS).reduce((sum, [, n]) => sum + n, 0);
    return {
      fps_median: percentile(this.rates, 0.5),
      fps_slow_share: round2(slow / seconds),
      frame_ms_p50: percentile(this.times, 0.5),
      frame_ms_p95: percentile(this.times, 0.95),
      frame_ms_p99: percentile(this.times, 0.99),
      hitches: this.hitches,
      hitches_per_minute: round2(this.hitches / (seconds / 60)),
      longest_frame_ms: Math.round(this.longest),
    };
  }
}

/** The value a share `q` of the counted values are at or below. */
function percentile(counts: ReadonlyMap<number, number>, q: number): number {
  const sorted = [...counts].sort(([a], [b]) => a - b);
  const total = sorted.reduce((sum, [, n]) => sum + n, 0);
  let seen = 0;
  for (const [value, n] of sorted) {
    seen += n;
    if (seen >= total * q) return value;
  }
  return sorted.at(-1)?.[0] ?? 0;
}

/** A share to two places. */
const round2 = (n: number) => Math.round(n * 100) / 100;
