// Ailments that go around town: a week's warning, then a month of guests who have caught one, on top of the usual, and
// the treatment for it opened early if it was still waiting on a star.

import type { CenterId, ConditionId } from './types';

/** Days between a wave's warning and its first guests. */
export const WAVE_WARNING_DAYS = 7;
/** Days a wave brings its guests. */
export const WAVE_DAYS = 30;
/** A wave's guests a month, as a share of the usual guests come for the tables: a third more, a quarter of everyone. */
export const WAVE_SHARE = 1 / 3;
/** Days after a center's first star that its wave starts. */
export const WAVE_AFTER_STAR = 45;
/** How far a wave moves on to keep its warning and first week clear of another event, and at most how often. */
export const WAVE_MOVE_DAYS = 7;
export const WAVE_MOVES = 4;
/** The days around a wave kept clear of other events: the warning week and the wave's first week. */
export const WAVE_CLEAR_DAYS = WAVE_WARNING_DAYS + 7;
/** A wave switched on part way through comes this many days later, so a tester need not wait. */
export const WAVE_SOON_DAYS = 7;

/** A wave a center has: the ailment that goes around, after which star, and why it is going around. */
export interface WaveDef {
  condition: ConditionId;
  /** The star the wave follows, before the next one. */
  afterStar: number;
  /** Why it is going around, as the dialog tells it. */
  cause: string;
}

/** Each center's waves. For now, one: Cold Feet at The Exchange, which opens Moxibustion before the second star. */
export const WAVES: Partial<Record<CenterId, WaveDef>> = {
  exchange: {
    condition: 'coldfeet',
    afterStar: 1,
    cause: 'The trading floor’s bonuses were announced, then postponed, and half of Mercer Street has them.',
  },
};
