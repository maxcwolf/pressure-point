// Tiny synthesized sound effects, a generative lounge loop, and the announcer's recorded lines.

import type { SfxName } from '../core/sim/events';
import { at } from '../core/util';
import { loadAudio, saveAudio } from '../storage/settings';

type Note = [freq: number, start: number, dur: number, gain?: number, type?: OscillatorType];

const SFX: Record<SfxName, Note[]> = {
  blip: [[660, 0, 0.06, 0.12, 'triangle']],
  place: [
    [220, 0, 0.09, 0.2, 'sine'],
    [330, 0.04, 0.1, 0.14, 'sine'],
  ],
  error: [
    [160, 0, 0.14, 0.16, 'sawtooth'],
    [120, 0.1, 0.18, 0.16, 'sawtooth'],
  ],
  cash: [
    [1175, 0, 0.08, 0.1, 'triangle'],
    [1568, 0.07, 0.2, 0.1, 'triangle'],
  ],
  sell: [
    [784, 0, 0.08, 0.1, 'triangle'],
    [523, 0.07, 0.16, 0.1, 'triangle'],
  ],
  hire: [
    [523, 0, 0.1, 0.12, 'triangle'],
    [659, 0.09, 0.1, 0.12, 'triangle'],
    [784, 0.18, 0.2, 0.12, 'triangle'],
  ],
  build: [
    [392, 0, 0.1, 0.14, 'triangle'],
    [523, 0.09, 0.1, 0.14, 'triangle'],
    [659, 0.18, 0.1, 0.14, 'triangle'],
    [784, 0.27, 0.3, 0.14, 'triangle'],
  ],
  heal: [
    [880, 0, 0.12, 0.09, 'sine'],
    [1109, 0.1, 0.12, 0.09, 'sine'],
    [1319, 0.2, 0.4, 0.09, 'sine'],
  ],
  fail: [
    [311, 0, 0.18, 0.12, 'triangle'],
    [233, 0.16, 0.34, 0.12, 'triangle'],
  ],
  payday: [
    [659, 0, 0.1, 0.1, 'square'],
    [523, 0.1, 0.2, 0.1, 'square'],
  ],
  announce: [
    [784, 0, 0.3, 0.1, 'sine'],
    [622, 0.28, 0.5, 0.1, 'sine'],
  ],
  fanfare: [
    [523, 0, 0.14, 0.14, 'triangle'],
    [659, 0.13, 0.14, 0.14, 'triangle'],
    [784, 0.26, 0.14, 0.14, 'triangle'],
    [1047, 0.39, 0.5, 0.16, 'triangle'],
    [784, 0.39, 0.5, 0.08, 'sine'],
  ],
  // a guest set off on a really bad trip: a startled cry, falling away
  yelp: [
    [520, 0, 0.1, 0.14, 'sawtooth'],
    [380, 0.08, 0.16, 0.12, 'sawtooth'],
  ],
  // something has caught fire: a fire alarm's two notes, high and low, three times over
  alarm: [
    [880, 0, 0.18, 0.07, 'square'],
    [660, 0.2, 0.18, 0.07, 'square'],
    [880, 0.4, 0.18, 0.07, 'square'],
    [660, 0.6, 0.18, 0.07, 'square'],
    [880, 0.8, 0.18, 0.07, 'square'],
    [660, 1.0, 0.24, 0.07, 'square'],
  ],
};

// Dreamy four-chord loop: Fmaj7, Em7, Dm7, Cmaj7
const CHORDS = [
  [174.6, 220, 261.6, 329.6],
  [164.8, 196, 246.9, 293.7],
  [146.8, 174.6, 220, 261.6],
  [130.8, 164.8, 196, 246.9],
];
const SCALE = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7];

/** The music's usual volume. */
const MUSIC_LEVEL = 0.5;
/** The music's volume while the announcer speaks. */
const MUSIC_UNDER_VOICE = 0.12;
/** How loud the announcer is. */
const VOICE_LEVEL = 0.8;
/** An engine's rumble: its note, the lowpass over it, and how loud it is at its loudest. */
const RUMBLE_HZ = 55;
const RUMBLE_LOWPASS = 180;
const RUMBLE_LEVEL = 0.04;
/**
 * A fire truck's siren: the note it wails about, how far either side of it the wail swings and how many times a second,
 * and how loud it is at its loudest.
 */
const SIREN_HZ = 775;
const SIREN_SWING = 125;
const SIREN_RATE = 2;
const SIREN_LEVEL = 0.035;
/** How long after the chime starts the announcer begins to speak, in milliseconds. */
const VOICE_DELAY = 700;

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private bar = 0;
  /** The line the announcer is saying, or about to say. */
  private voice: HTMLAudioElement | null = null;
  private voiceTimer = 0;
  /** The loudness an engine's rumble plays at, set while one runs nearby; started the first time it is wanted. */
  private rumbleGain: GainNode | null = null;
  private rumbleAt = 0;
  /** The loudness the fire truck's siren plays at, set while it comes; started the first time it is wanted. */
  private sirenGain: GainNode | null = null;
  private sirenAt = 0;
  sound: boolean;
  music: boolean;

  constructor() {
    const prefs = loadAudio();
    this.sound = prefs.sound;
    this.music = prefs.music;
  }

  /** Must be called from a user gesture before anything is audible. */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.music ? MUSIC_LEVEL : 0;
    this.musicGain.connect(this.master);
    this.scheduleMusic();
    window.setInterval(() => this.scheduleMusic(), 4000);
    // go quiet while the window is hidden or minimized
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        void this.ctx?.suspend();
        this.hush();
      } else void this.ctx?.resume();
    });
  }

  /** Remember the sound and music switches. */
  private save() {
    saveAudio({ sound: this.sound, music: this.music });
  }
  /** Turn sound effects on or off. */
  toggleSound() {
    this.sound = !this.sound;
    if (!this.sound) this.hush();
    this.save();
  }
  /** Turn the music on or off. */
  toggleMusic() {
    this.music = !this.music;
    if (this.ctx) this.musicGain.gain.setTargetAtTime(this.music ? MUSIC_LEVEL : 0, this.ctx.currentTime, 0.2);
    this.save();
  }

  /**
   * Rumble like an engine running, this loud from 0 (silent) to 1: a low sawtooth under a lowpass, left running and
   * faded in and out. Nothing while sound is off.
   */
  rumble(level: number) {
    const ctx = this.ctx;
    const want = this.sound ? level : 0;
    if (!ctx || (!this.rumbleGain && want <= 0) || Math.abs(want - this.rumbleAt) < 0.01) return;
    this.rumbleAt = want;
    if (!this.rumbleGain) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = RUMBLE_HZ;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = RUMBLE_LOWPASS;
      this.rumbleGain = ctx.createGain();
      this.rumbleGain.gain.value = 0;
      osc.connect(low).connect(this.rumbleGain).connect(this.master);
      osc.start();
    }
    this.rumbleGain.gain.setTargetAtTime(want * RUMBLE_LEVEL, ctx.currentTime, 0.3);
  }

  /**
   * Wail like a fire truck's siren, this loud from 0 (silent) to 1: one note swung up and down by a slow oscillator,
   * left running and faded in and out. Nothing while sound is off.
   */
  siren(level: number) {
    const ctx = this.ctx;
    const want = this.sound ? level : 0;
    if (!ctx || (!this.sirenGain && want <= 0) || Math.abs(want - this.sirenAt) < 0.01) return;
    this.sirenAt = want;
    if (!this.sirenGain) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = SIREN_HZ;
      const wail = ctx.createOscillator();
      wail.frequency.value = SIREN_RATE;
      const swing = ctx.createGain();
      swing.gain.value = SIREN_SWING;
      wail.connect(swing).connect(osc.frequency);
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      osc.connect(this.sirenGain).connect(this.master);
      osc.start();
      wail.start();
    }
    this.sirenGain.gain.setTargetAtTime(want * SIREN_LEVEL, ctx.currentTime, 0.3);
  }

  /** Schedule a single note that fades in quickly and dies away. */
  private tone(
    dest: AudioNode,
    freq: number,
    at: number,
    dur: number,
    gain: number,
    type: OscillatorType,
    attack = 0.008,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Play a sound effect, unless sound is off. */
  play(name: SfxName) {
    if (!this.ctx || !this.sound) return;
    const now = this.ctx.currentTime;
    for (const [f, start, dur, gain = 0.12, type = 'triangle'] of SFX[name])
      this.tone(this.master, f, now + start, dur, gain, type);
  }

  /** Have the announcer say a recorded line just after the chime, with the music turned down. Nothing while sound is off. */
  speak(url: string) {
    if (!this.ctx || !this.sound) return;
    this.hush();
    const voice = document.createElement('audio');
    voice.src = url;
    voice.volume = VOICE_LEVEL;
    voice.addEventListener('ended', () => {
      if (this.voice === voice) this.hush();
    });
    this.voice = voice;
    this.voiceTimer = window.setTimeout(() => {
      this.underVoice(true);
      voice.play().catch(() => {
        if (this.voice === voice) this.hush();
      });
    }, VOICE_DELAY);
  }

  /** Stop the announcer, if they are speaking or about to, and bring the music back up. */
  private hush() {
    clearTimeout(this.voiceTimer);
    if (!this.voice) return;
    this.voice.pause();
    this.voice = null;
    this.underVoice(false);
  }

  /** Turn the music down under the announcer, or back up to its usual level. */
  private underVoice(down: boolean) {
    if (!this.ctx || !this.music) return;
    this.musicGain.gain.setTargetAtTime(down ? MUSIC_UNDER_VOICE : MUSIC_LEVEL, this.ctx.currentTime, 0.15);
  }

  /** Queue the next four-second bar: a soft pad plus a few plucked notes. Nothing at all while the music is off. */
  private scheduleMusic() {
    const ctx = this.ctx;
    if (ctx?.state !== 'running' || !this.music) return;
    const start = ctx.currentTime + 0.1;
    const chord = at(CHORDS, this.bar++ % CHORDS.length);
    for (const f of chord) this.tone(this.musicGain, f, start, 4.6, 0.035, 'sine', 1.2);
    this.tone(this.musicGain, at(chord, 0) / 2, start, 3.8, 0.06, 'triangle', 0.05);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.45) continue;
      const f = at(SCALE, Math.floor(Math.random() * SCALE.length));
      this.tone(this.musicGain, f, start + i * 0.5, 0.9, 0.028, 'triangle', 0.01);
    }
  }
}
