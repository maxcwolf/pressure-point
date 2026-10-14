// Bottom left: the round buttons that open the build menus.

import './BuildButtons.css';

import { useHud } from '../hooks/use-hud';
import type { MenuId } from '../hud';
import { cx } from '../lib/cx';
import { Button } from './common/Button';

const MENUS: readonly { id: MenuId; icon: string; label: string }[] = [
  { id: 'rooms', icon: '🏗️', label: 'Rooms' },
  { id: 'items', icon: '🪴', label: 'Items' },
  { id: 'hire', icon: '🤝', label: 'Hire' },
  { id: 'staff', icon: '👥', label: 'Staff' },
  { id: 'treatments', icon: '💆', label: 'Treatments' },
  { id: 'finance', icon: '💰', label: 'Money' },
  { id: 'policy', icon: '📋', label: 'Policy' },
  { id: 'stats', icon: '📊', label: 'Stats' },
];

/** One round button per build menu. */
export function BuildButtons() {
  const hud = useHud();
  return (
    <div id="buildbtns">
      {MENUS.map((m) => (
        <Button
          key={m.id}
          class={cx('round', hud.menu === m.id && 'on')}
          onPress={() => {
            hud.toggleMenu(m.id);
          }}
        >
          <i>{m.icon}</i>
          <span>{m.label}</span>
        </Button>
      ))}
    </div>
  );
}
