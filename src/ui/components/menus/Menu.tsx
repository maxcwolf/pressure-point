// The build menu that is open, above the buttons that open it.

import './Menu.css';

import type { ComponentChildren } from 'preact';

import { useHud } from '../../hooks/use-hud';
import { usePop } from '../../hooks/use-pop';
import type { MenuId } from '../../hud';
import { HireMenu } from './HireMenu';
import { ItemsMenu } from './ItemsMenu';
import { MoneyMenu } from './MoneyMenu';
import { RoomsMenu } from './RoomsMenu';
import { StaffMenu } from './StaffMenu';
import { TreatmentsMenu } from './TreatmentsMenu';

/** The contents of a menu. */
function contents(menu: MenuId): ComponentChildren {
  switch (menu) {
    case 'rooms':
      return <RoomsMenu />;
    case 'items':
      return <ItemsMenu />;
    case 'hire':
      return <HireMenu />;
    case 'staff':
      return <StaffMenu />;
    case 'treatments':
      return <TreatmentsMenu />;
    case 'finance':
      return <MoneyMenu />;
  }
}

/** Whichever build menu is open, popping in when it opens. */
export function Menu() {
  const { menu } = useHud();
  const pop = usePop(menu !== null);
  return (
    <div id="menu" class={pop}>
      {menu && contents(menu)}
    </div>
  );
}
