// The sandbox's difficulty: a preset that sets every pressure at once, and each one to change on its own.

import { type Difficulty, KNOB_ORDER, KNOBS, PRESET_ORDER, PRESETS } from '../../core/data';
import { nextLevel, presetLevels, presetOf } from '../../core/difficulty';
import { cx } from '../lib/cx';
import { IconText } from './common/Icon';

export interface DifficultySettingsProps {
  difficulty: Difficulty;
  /** Called with the settings changed. */
  onChange: (next: Difficulty) => void;
}

/** A button for each preset, the one the settings match lit, and a row for each setting with its level to click through. */
export function DifficultySettings({ difficulty, onChange }: DifficultySettingsProps) {
  const preset = presetOf(difficulty);
  return (
    <>
      <h4>Difficulty</h4>
      <div class="tabs presets" role="radiogroup" aria-label="Difficulty">
        {PRESET_ORDER.map((p) => (
          <button
            key={p}
            role="radio"
            class={cx('tab', preset === p && 'on')}
            aria-checked={preset === p ? 'true' : 'false'}
            onClick={() => {
              onChange(presetLevels(p));
            }}
          >
            {PRESETS[p].name}
          </button>
        ))}
      </div>
      <p class="sub preset-note">
        {preset ? PRESETS[preset].desc : 'Custom: each setting chosen on its own.'} Click a setting to change it, or
        point at it to see what it does.
      </p>
      <ul class="key-list difficulty-list">
        {KNOB_ORDER.map((k) => {
          const def = KNOBS[k];
          const level = difficulty[k] ?? 'usual';
          return (
            <li key={k} title={def.desc}>
              <span>
                <IconText id={def.icon}>{def.name}</IconText>
              </span>
              <button
                class={cx('choice', 'level', level)}
                aria-label={`${def.name}: ${def.words[level]}`}
                onClick={() => {
                  onChange({ ...difficulty, [k]: nextLevel(level) });
                }}
              >
                {def.words[level]}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
