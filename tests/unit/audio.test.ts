import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Audio } from '../../src/audio';

/** How many notes the stand-in audio context has been asked to play. */
let notes = 0;
/** Every volume the music has been asked to move to. */
let musicLevels: number[] = [];
/** The announcer's lines the stand-in page has been asked to play, in order. */
let spoken: FakeVoice[] = [];

/** A stand-in for an audio element, noting whether it is playing. */
class FakeVoice {
  src = '';
  volume = 1;
  playing = false;
  private ended: (() => void) | null = null;
  /** Remember what to do when the line ends. */
  addEventListener(_: string, done: () => void) {
    this.ended = done;
  }
  /** Start speaking. */
  play() {
    this.playing = true;
    spoken.push(this);
    return Promise.resolve();
  }
  /** Stop speaking. */
  pause() {
    this.playing = false;
  }
  /** Reach the end of the line. */
  finish() {
    this.playing = false;
    this.ended?.();
  }
}

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
    /** Note where the volume is heading. */
    setTargetAtTime: (level: number) => void musicLevels.push(level),
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
    window: { setInterval, setTimeout },
    document: {
      /** Ignored. */
      addEventListener: () => undefined,
      /** A stand-in audio element. */
      createElement: () => new FakeVoice(),
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

describe('the announcer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    musicLevels = [];
    spoken = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Audio with the music on, unlocked as if the player had clicked. */
  function playing() {
    const audio = quietAudio();
    audio.unlock();
    audio.toggleMusic();
    musicLevels = [];
    return audio;
  }

  it('speaks just after the chime, with the music turned down until the line ends', () => {
    const audio = playing();
    audio.speak('line.mp3');
    expect(spoken).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(spoken.map((v) => v.src)).toEqual(['line.mp3']);
    expect(musicLevels).toEqual([0.12]);
    spoken[0]!.finish();
    expect(musicLevels).toEqual([0.12, 0.5]);
  });

  it('cuts off one line to say the next', () => {
    const audio = playing();
    audio.speak('first.mp3');
    vi.advanceTimersByTime(1000);
    audio.speak('second.mp3');
    vi.advanceTimersByTime(1000);
    expect(spoken.map((v) => [v.src, v.playing])).toEqual([
      ['first.mp3', false],
      ['second.mp3', true],
    ]);
  });

  it('stays quiet while sound is off, and stops when sound is switched off', () => {
    const audio = playing();
    audio.speak('line.mp3');
    vi.advanceTimersByTime(1000);
    audio.toggleSound();
    expect(spoken[0]!.playing).toBe(false);
    audio.speak('again.mp3');
    vi.advanceTimersByTime(1000);
    expect(spoken).toHaveLength(1);
  });
});
