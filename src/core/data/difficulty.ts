// How hard a sandbox game is: a preset (Relaxed, Standard or Demanding) fills in a setting for each pressure the game
// puts on the player, and any of them can then be set on its own. Each setting is easier, as usual, or harder, and
// scales one of the numbers the game already uses. As usual, it scales by exactly 1, so changes nothing.

/** A pressure the difficulty can turn up or down. */
export type Knob =
  | 'arrivals'
  | 'patience'
  | 'applicants'
  | 'wear'
  | 'tiredness'
  | 'salaries'
  | 'fees'
  | 'loans'
  | 'trouble'
  | 'chances'
  | 'reputation';

/** How a setting is set: easier than usual, as usual, or harder. */
export type Level = 'easier' | 'usual' | 'harder';

/** The levels, from easiest to hardest. */
export const LEVELS: readonly Level[] = ['easier', 'usual', 'harder'];

/** A setting: what it is called and does, what the number it scales is multiplied by at each level, and the words for
 * each level. */
export interface KnobDef {
  name: string;
  icon: string;
  desc: string;
  factor: Readonly<Record<Level, number>>;
  words: Readonly<Record<Level, string>>;
}

export const KNOBS: Readonly<Record<Knob, KnobDef>> = {
  arrivals: {
    name: 'Guests',
    icon: '🚶',
    desc: 'How often guests arrive.',
    // divides the wait between arrivals
    factor: { easier: 1.25, usual: 1, harder: 0.8 },
    words: { easier: 'More often', usual: 'Usual', harder: 'Less often' },
  },
  patience: {
    name: 'Patience',
    icon: '⏳',
    desc: 'How fast guests lose patience waiting.',
    factor: { easier: 0.75, usual: 1, harder: 1.3 },
    words: { easier: 'Patient', usual: 'Usual', harder: 'Impatient' },
  },
  applicants: {
    name: 'Applicants',
    icon: '📨',
    desc: 'How often someone new applies for a job.',
    // multiplies the days between applicants
    factor: { easier: 0.6, usual: 1, harder: 1.5 },
    words: { easier: 'More often', usual: 'Usual', harder: 'Less often' },
  },
  wear: {
    name: 'Wear',
    icon: '🔧',
    desc: 'How quickly equipment wears out with use.',
    factor: { easier: 0.7, usual: 1, harder: 1.4 },
    words: { easier: 'Slower', usual: 'Usual', harder: 'Faster' },
  },
  tiredness: {
    name: 'Tiredness',
    icon: '🥱',
    desc: 'How quickly staff tire as they work.',
    factor: { easier: 0.8, usual: 1, harder: 1.25 },
    words: { easier: 'Slower', usual: 'Usual', harder: 'Faster' },
  },
  salaries: {
    name: 'Salaries',
    icon: '💵',
    desc: 'What staff ask to be paid.',
    factor: { easier: 0.85, usual: 1, harder: 1.2 },
    words: { easier: 'Lower', usual: 'Usual', harder: 'Higher' },
  },
  fees: {
    name: 'Fees',
    icon: '💰',
    desc: 'What a treatment brings in, at the same price level.',
    factor: { easier: 1.15, usual: 1, harder: 0.85 },
    words: { easier: 'Higher', usual: 'Usual', harder: 'Lower' },
  },
  loans: {
    name: 'Loans',
    icon: '🏦',
    desc: 'How much the bank will lend.',
    factor: { easier: 1.5, usual: 1, harder: 0.5 },
    words: { easier: 'Higher', usual: 'Usual', harder: 'Lower' },
  },
  trouble: {
    name: 'Trouble',
    icon: '⛈️',
    desc: 'How often mishaps, stress outbreaks and the health inspector come.',
    // multiplies the days between them
    factor: { easier: 1.5, usual: 1, harder: 0.7 },
    words: { easier: 'Less often', usual: 'Usual', harder: 'More often' },
  },
  chances: {
    name: 'Emergencies',
    icon: '🚨',
    desc: 'How often emergencies, staff challenges and house calls are offered, each with a reward.',
    // multiplies the days between them
    factor: { easier: 0.75, usual: 1, harder: 1.3 },
    words: { easier: 'More often', usual: 'Usual', harder: 'Less often' },
  },
  reputation: {
    name: 'Reputation',
    icon: '⭐',
    desc: 'How quickly a good name is earned.',
    factor: { easier: 1.25, usual: 1, harder: 0.8 },
    words: { easier: 'Faster', usual: 'Usual', harder: 'Slower' },
  },
};

/** The settings, in the order they are listed. */
export const KNOB_ORDER = Object.keys(KNOBS) as Knob[];

/** How a game is set, setting by setting. One left out is as usual. */
export type Difficulty = Partial<Record<Knob, Level>>;

/** A preset: a level for every setting at once. */
export type Preset = 'relaxed' | 'standard' | 'demanding';

export const PRESETS: Readonly<Record<Preset, { name: string; desc: string; level: Level }>> = {
  relaxed: { name: 'Relaxed', desc: 'Every pressure eased, to build at your own pace.', level: 'easier' },
  standard: { name: 'Standard', desc: 'The game as the campaign plays it.', level: 'usual' },
  demanding: { name: 'Demanding', desc: 'Every pressure turned up, for a real test.', level: 'harder' },
};

/** The presets, from easiest to hardest. */
export const PRESET_ORDER = Object.keys(PRESETS) as Preset[];
