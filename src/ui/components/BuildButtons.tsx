// Bottom left: the round buttons that open the build menus, and the one that takes up the Expand tool to buy land.

import './BuildButtons.css';

import type { IconId } from '../../core/data';
import { useGame, useHud } from '../hooks/use-hud';
import type { MenuId } from '../hud';
import { cx } from '../lib/cx';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

const MENUS: readonly { id: MenuId; icon: IconId; label: string }[] = [
  { id: 'rooms', icon: 'ui-rooms', label: 'Rooms' },
  { id: 'items', icon: 'ui-items', label: 'Items' },
  { id: 'hire', icon: 'ui-hire', label: 'Hire' },
  { id: 'staff', icon: 'ui-staff', label: 'Staff' },
  { id: 'treatments', icon: 'ui-treatments', label: 'Treatments' },
  { id: 'finance', icon: 'ui-money', label: 'Money' },
  { id: 'policy', icon: 'ui-policy', label: 'Policy' },
  { id: 'stats', icon: 'ui-stats', label: 'Stats' },
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
          <Icon id={m.icon} size={30} />
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
            <Icon id="ui-expand" size={30} />
            <span>Expand</span>
          </Button>
        ),
      ])}
    </div>
  );
}
