// The public-address effect that turns the announcer's clean recordings into the clips the game plays.
import { describe, expect, it } from 'vitest';

import {
  echoes,
  filter,
  HALL,
  highpass,
  lowpass,
  normalize,
  paSpeaker,
  peak,
  peaking,
  readWav,
  saturate,
  writeWav,
} from '../../scripts/pa-speaker.mjs';

const RATE = 22050;

/** A second of a pure tone. */
const tone = (freq: number) => Float64Array.from({ length: RATE }, (_, i) => Math.sin((2 * Math.PI * freq * i) / RATE));

/** How loud a sound is once any filter has settled: the peak over its second half. */
const level = (samples: Float64Array) => peak(samples.subarray(samples.length / 2));

describe('the filters', () => {
  it('cut low rumble and high hiss but keep the voice', () => {
    const cut = highpass(RATE, 420);
    expect(level(filter(tone(100), cut))).toBeLessThan(0.1);
    expect(level(filter(tone(1500), cut))).toBeGreaterThan(0.9);
    const top = lowpass(RATE, 3400);
    expect(level(filter(tone(9000), top))).toBeLessThan(0.2);
    expect(level(filter(tone(500), top))).toBeGreaterThan(0.95);
  });

  it('lift the band around the horn by the decibels asked for', () => {
    expect(level(filter(tone(1800), peaking(RATE, 1800, 6)))).toBeCloseTo(10 ** (6 / 20), 1);
    expect(level(filter(tone(200), peaking(RATE, 1800, 6)))).toBeCloseTo(1, 1);
  });
});

describe('the loudness', () => {
  it('scales to the level asked for, leaving silence silent', () => {
    expect(peak(normalize(Float64Array.of(0.1, -0.4, 0.2), 0.8))).toBeCloseTo(0.8);
    expect([...normalize(new Float64Array(3), 1)]).toEqual([0, 0, 0]);
  });

  it('rounds off loud parts but barely touches quiet ones', () => {
    const [quiet, loud, top, low] = saturate(Float64Array.of(0.05, 0.6, 1, -0.6), 1.6);
    expect(quiet).toBeCloseTo(0.05 * (1.6 / Math.tanh(1.6)), 2);
    expect(loud).toBeGreaterThan(0.6);
    expect(top).toBeCloseTo(1);
    expect(low).toBeCloseTo(-loud!);
  });
});

describe('the echoes', () => {
  it('repeat a sound after each delay, quieter, and leave room for the last to finish', () => {
    const click = new Float64Array(10);
    click[0] = 1;
    const out = echoes(click, 100, [
      { delay: 0.05, gain: 0.5 },
      { delay: 0.2, gain: 0.25 },
    ]);
    expect(out).toHaveLength(30);
    expect([out[0], out[5], out[20]]).toEqual([1, 0.5, 0.25]);
  });
});

describe('the whole speaker', () => {
  it('drops the rumble under a voice, and fades out after it', () => {
    const voice = tone(1200).map((s, i) => s * 0.5 + Math.sin((2 * Math.PI * 80 * i) / RATE) * 0.5);
    const out = paSpeaker(voice, RATE);
    expect(peak(out)).toBeCloseTo(0.89);
    const longest = Math.max(...HALL.map((t) => t.delay));
    expect(out.length).toBe(RATE + Math.ceil(longest * RATE));
    // what is left of the 80 Hz rumble is a fraction of the 1200 Hz tone
    const rumble = level(filter(out.subarray(0, RATE), lowpass(RATE, 150)));
    expect(rumble).toBeLessThan(0.05);
  });
});

describe('WAV files', () => {
  it('read back what was written, to 16-bit precision', () => {
    const samples = Float64Array.of(0, 0.5, -0.5, 1, -1, 0.25);
    const back = readWav(writeWav(samples, 16000));
    expect(back.rate).toBe(16000);
    back.samples.forEach((s, i) => expect(s).toBeCloseTo(samples[i]!, 3));
  });

  it('refuse anything else', () => {
    expect(() => readWav(new Uint8Array(44))).toThrow(/not a WAV/);
  });
});
