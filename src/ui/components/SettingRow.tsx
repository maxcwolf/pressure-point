// One row of the settings: a switch, or a label saying why it cannot be changed.

import type { IconId } from '../../core/data';
import { cx } from '../lib/cx';
import { Icon } from './common/Icon';

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
          class={cx('switch', on && 'on')}
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
