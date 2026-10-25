// The sandbox's difficulty: a preset that sets every pressure at once, and each one to change on its own.

import { type Difficulty, KNOB_ORDER, KNOBS, PRESET_ORDER, PRESETS } from '../../core/data';
import { nextLevel, presetLevels, presetOf } from '../../core/difficulty';
import { css } from '../../styled-system/css';
import { tabButton, tabStrip } from '../../styled-system/recipes';
import { cx } from '../lib/cx';
import { IconText } from './common/Icon';

/** The presets, a little apart. */
const presets = css({ gap: 's' });

/** What the preset the settings match is like, between the presets and the settings. */
const presetNote = css({ m: '[6px 0 8px]' });

/**
 * A setting's level, to click through: a choice button as the settings have them (SettingRow.tsx), but smaller and all
 * one width, green while it is easier than usual and red while it is harder.
 */
const levelButton = css({
  pointerEvents: 'auto',
  flex: 'none',
  border: '[2.5px solid {colors.navy}]',
  borderRadius: '[10px]',
  p: '[2px 8px]',
  fontWeight: 'bold',
  fontSize: '[13px]',
  bg: 'cream',
  boxShadow: '[0 3px 0 rgba(36, 56, 74, 0.3)]',
  minW: '[92px]',
  '&.easier': { bg: '[#d8efd9]' },
  '&.harder': { bg: '[#f6d6cf]' },
});

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
      <div class={cx(tabStrip(), presets)} role="radiogroup" aria-label="Difficulty">
        {PRESET_ORDER.map((p) => (
          <button
            key={p}
            role="radio"
            class={cx(tabButton(), preset === p && 'on')}
            aria-checked={preset === p ? 'true' : 'false'}
            onClick={() => {
              onChange(presetLevels(p));
            }}
          >
            {PRESETS[p].name}
          </button>
        ))}
      </div>
      <p class={cx('sub', presetNote)}>
        {preset ? PRESETS[preset].desc : 'Custom: each setting chosen on its own.'} Click a setting to change it, or
        point at it to see what it does.
      </p>
      {/* `key-list` puts the settings in two columns, in the settings' look (SettingsPanel.tsx) */}
      <ul class="key-list">
        {KNOB_ORDER.map((k) => {
          const def = KNOBS[k];
          const level = difficulty[k] ?? 'usual';
          return (
            <li key={k} title={def.desc}>
              <span>
                <IconText id={def.icon}>{def.name}</IconText>
              </span>
              <button
                class={cx(levelButton, level)}
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
