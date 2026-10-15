// Working with a game's difficulty: what a setting scales its number by, what a preset sets, and which preset, if any,
// a game's settings add up to.

import {
  type Difficulty,
  type Knob,
  KNOB_ORDER,
  KNOBS,
  type Level,
  LEVELS,
  type Preset,
  PRESET_ORDER,
  PRESETS,
} from './data';
import { at } from './util';

/** What a setting scales its number by in a game: exactly 1 when it is as usual. */
export const tuning = (s: { difficulty: Difficulty }, k: Knob) => KNOBS[k].factor[s.difficulty[k] ?? 'usual'];

/** Every setting at a preset's level. */
export function presetLevels(p: Preset): Difficulty {
  return Object.fromEntries(KNOB_ORDER.map((k) => [k, PRESETS[p].level]));
}

/** The preset a game's settings match, or null when they have been set one by one. */
export function presetOf(d: Difficulty): Preset | null {
  return PRESET_ORDER.find((p) => KNOB_ORDER.every((k) => (d[k] ?? 'usual') === PRESETS[p].level)) ?? null;
}

/** The next level round from this one: easier, usual, harder, then easier again. */
export const nextLevel = (l: Level): Level => at(LEVELS, (LEVELS.indexOf(l) + 1) % LEVELS.length);

/** Settings read back from storage, keeping only the ones that make sense. */
export function readDifficulty(raw: unknown): Difficulty {
  const out: Difficulty = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const k of KNOB_ORDER) {
    const level = (raw as Record<string, unknown>)[k];
    if (LEVELS.includes(level as Level)) out[k] = level as Level;
  }
  return out;
}
