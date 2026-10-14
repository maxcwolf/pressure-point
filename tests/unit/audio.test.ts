import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Audio } from '../../src/audio';

/** How many notes the stand-in audio context has been asked to play. */
let notes = 0;

/** A stand-in for an audio parameter that takes every change and ignores it. */
function param() {
  return {
    value: 0,
    /** Ignored. */
    setValueAtTime: () => undefined,
    /** Ignored. */
    linearRampToValueAtTime: () => undefined,
    /** Ignored. */
    exponentialRampToValueAtTime: () => undefined,
    /** Ignored. */
    setTargetAtTime: () => undefined,
  };
}
/** A stand-in for an audio node that can be wired up to anything. */
function node() {
  return {
    gain: param(),
    /** Hand back what it was connected to, so connections chain. */
    connect: (to: unknown) => to,
  };
}
/** A stand-in for the browser's audio context that only counts the notes it is given. */
class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  /** A volume control. */
  createGain() {
    return node();
  }
  /** A note. */
  createOscillator() {
    notes++;
    return {
      ...node(),
      type: '',
      frequency: param(),
      /** Ignored. */
      start: () => undefined,
      /** Ignored. */
      stop: () => undefined,
    };
  }
  /** Carry on playing. */
  resume() {
    return Promise.resolve();
  }
}

/** Audio with music switched off in the player's preferences. */
function quietAudio() {
  const prefs = JSON.stringify({ sound: true, music: false });
  Object.assign(globalThis, {
    AudioContext: FakeContext,
    localStorage: {
      /** The player's saved preferences. */
      getItem: () => prefs,
      /** Ignored. */
      setItem: () => undefined,
    },
    window: { setInterval },
    document: {
      /** Ignored. */
      addEventListener: () => undefined,
    },
  });
  return new Audio();
}

describe('music', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notes = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not played at all while switched off', () => {
    const audio = quietAudio();
    expect(audio.music).toBe(false);
    audio.unlock();
    vi.advanceTimersByTime(60_000);
    expect(notes).toBe(0);
  });

  it('starts again once switched back on', () => {
    const audio = quietAudio();
    audio.unlock();
    audio.toggleMusic();
    vi.advanceTimersByTime(8_000);
    expect(notes).toBeGreaterThan(0);
  });
});
