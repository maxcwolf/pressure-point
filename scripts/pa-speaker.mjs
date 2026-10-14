// Makes a clean voice recording sound like it is coming over a public-address speaker in a big building:
// a narrow telephone-like band, a honk from the horn, a little distortion, and echoes from speakers
// further down the corridors. Works on mono samples between -1 and 1.

/** The coefficients of a second-order filter, normalized so a0 is 1. */
function coefficients(b0, b1, b2, a0, a1, a2) {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** A filter that cuts everything below a frequency. */
export function highpass(rate, freq, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * freq) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  return coefficients((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}

/** A filter that cuts everything above a frequency. */
export function lowpass(rate, freq, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * freq) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  return coefficients((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}

/** A filter that lifts (or dips) a band around a frequency by some decibels. */
export function peaking(rate, freq, gainDb, q = 1) {
  const w = (2 * Math.PI * freq) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const a = 10 ** (gainDb / 40);
  const cos = Math.cos(w);
  return coefficients(1 + alpha * a, -2 * cos, 1 - alpha * a, 1 + alpha / a, -2 * cos, 1 - alpha / a);
}

/** Run samples through a second-order filter. */
export function filter(samples, { b0, b1, b2, a1, a2 }) {
  const out = new Float64Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/** The loudest sample, ignoring sign. */
export function peak(samples) {
  let most = 0;
  for (const s of samples) most = Math.max(most, Math.abs(s));
  return most;
}

/** Scale samples so the loudest reaches a level. Silence stays silent. */
export function normalize(samples, level) {
  const most = peak(samples);
  return most === 0 ? Float64Array.from(samples) : samples.map((s) => (s * level) / most);
}

/** Round off the loudest parts, as an overdriven little speaker does. Quiet parts pass almost unchanged. */
export function saturate(samples, drive) {
  const top = Math.tanh(drive);
  return samples.map((s) => Math.tanh(s * drive) / top);
}

/** Add delayed, quieter copies of the samples, lengthening them so the last echo can fade out. */
export function echoes(samples, rate, taps) {
  const longest = Math.max(0, ...taps.map((t) => t.delay));
  const out = new Float64Array(samples.length + Math.ceil(longest * rate));
  out.set(samples);
  for (const { delay, gain } of taps) {
    const offset = Math.round(delay * rate);
    for (let i = 0; i < samples.length; i++) out[i + offset] += samples[i] * gain;
  }
  return out;
}

/** The echoes of a big building: one speaker close by, then others further off. */
export const HALL = [
  { delay: 0.031, gain: 0.42 },
  { delay: 0.12, gain: 0.28 },
  { delay: 0.24, gain: 0.17 },
  { delay: 0.39, gain: 0.1 },
  { delay: 0.56, gain: 0.05 },
];

/** Make a voice sound as if it is coming over a public-address speaker. */
export function paSpeaker(samples, rate) {
  let s = Float64Array.from(samples);
  for (const f of [
    highpass(rate, 420),
    highpass(rate, 420),
    lowpass(rate, 3400),
    lowpass(rate, 3400),
    peaking(rate, 1800, 6, 1.4),
  ])
    s = filter(s, f);
  s = saturate(normalize(s, 1), 1.6);
  s = echoes(s, rate, HALL);
  return normalize(s, 0.89);
}

/** Read 16-bit PCM samples from a WAV file, mixed down to mono. */
export function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  /** The four letters naming a chunk of the file. */
  const tag = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let rate = 0;
  let channels = 0;
  let bits = 0;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (tag(at) === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      rate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (tag(at) === 'data') {
      if (bits !== 16) throw new Error(`only 16-bit WAV files are read, not ${bits}-bit`);
      const frames = Math.floor(size / (2 * channels));
      const samples = new Float64Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += view.getInt16(body + (i * channels + c) * 2, true);
        samples[i] = sum / channels / 32768;
      }
      return { rate, samples };
    }
    at = body + size + (size % 2);
  }
  throw new Error('no sound in the WAV file');
}

/** Write mono samples as a 16-bit PCM WAV file. */
export function writeWav(samples, rate) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  /** Write the four letters naming a chunk of the file. */
  const tag = (at, text) =>
    bytes.set(
      [...text].map((c) => c.charCodeAt(0)),
      at,
    );
  tag(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return bytes;
}
