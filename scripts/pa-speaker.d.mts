// Types for pa-speaker.mjs, so the tests can use it.

export interface Filter {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}
export interface Tap {
  delay: number;
  gain: number;
}
type Samples = ArrayLike<number> & Iterable<number>;

export function highpass(rate: number, freq: number, q?: number): Filter;
export function lowpass(rate: number, freq: number, q?: number): Filter;
export function peaking(rate: number, freq: number, gainDb: number, q?: number): Filter;
export function filter(samples: Samples, f: Filter): Float64Array;
export function peak(samples: Samples): number;
export function normalize(samples: Float64Array, level: number): Float64Array;
export function saturate(samples: Float64Array, drive: number): Float64Array;
export function echoes(samples: Float64Array, rate: number, taps: readonly Tap[]): Float64Array;
export const HALL: readonly Tap[];
export function paSpeaker(samples: Samples, rate: number): Float64Array;
export function readWav(bytes: Uint8Array): { rate: number; samples: Float64Array };
export function writeWav(samples: Samples, rate: number): Uint8Array;
