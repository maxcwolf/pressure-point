// Bottom left: the round buttons that open the build menus, and the one that takes up the Expand tool to buy land.

import './BuildButtons.css';

import { useGame, useHud } from '../hooks/use-hud';
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

/** One round button per build menu, and Expand. */
export function BuildButtons() {
  const hud = useHud();
  const { tools } = useGame();
  const expanding = tools.tool.kind === 'expand';
  return (
    <div id="buildbtns">
      {MENUS.map((m) => [
        <Button
          key={m.id}
          class={cx('round', hud.menu === m.id && 'on')}
          onPress={() => {
            hud.toggleMenu(m.id);
          }}
        >
          <i>{m.icon}</i>
          <span>{m.label}</span>
        </Button>,
        // Expand goes beside Rooms, the other way to build
        m.id === 'rooms' && (
          <Button
            key="expand"
            class={cx('round', expanding && 'on')}
            title="Buy the land around the building"
            onPress={() => {
              hud.closeMenu();
              if (expanding) tools.cancel();
              else tools.startExpand();
            }}
          >
            <i>🏡</i>
            <span>Expand</span>
          </Button>
        ),
      ])}
    </div>
  );
}
