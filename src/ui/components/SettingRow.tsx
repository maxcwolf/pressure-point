// One row of the settings: a switch, or a label saying why it cannot be changed.

import type { IconId } from '../../core/data';
import { css } from '../../styled-system/css';
import { toggleSwitch } from '../../styled-system/recipes';
import { cx } from '../lib/cx';
import { Icon } from './common/Icon';

/** The button on a row that steps through choices rather than switching, such as how long messages stay. */
export const choice = css({
  pointerEvents: 'auto',
  flex: 'none',
  border: '[2.5px solid {colors.navy}]',
  borderRadius: '10',
  py: '4',
  px: '12',
  fontWeight: 'bold',
  fontSize: '14',
  bg: 'cream',
  boxShadow: '[0 3px 0 {colors.ink.30}]',
});

export interface SettingRowProps {
  icon: IconId;
  name: string;
  desc: string;
  on: boolean;
  /** Why the setting cannot be changed, shown in place of the switch. */
  locked?: string;
  onToggle?: () => void;
}

/** One settings row: a switch, or a label when it cannot be changed. */
export function SettingRow({ icon, name, desc, on, locked = '', onToggle }: SettingRowProps) {
  return (
    // `locked` fades the row in the settings' look (SettingsPanel.tsx)
    <li class={locked ? 'locked' : ''}>
      <Icon id={icon} size={26} />
      <div>
        <b>{name}</b>
        <span>{desc}</span>
      </div>{' '}
      {locked ? (
        <em>{locked}</em>
      ) : (
        <button
          class={cx(toggleSwitch(), on && 'on')}
          role="switch"
          aria-checked={on ? 'true' : 'false'}
          aria-label={name}
          onClick={onToggle}
        >
          <span />
        </button>
      )}
    </li>
  );
}
